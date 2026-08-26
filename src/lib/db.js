import pg from 'pg';
var Pool = pg.Pool;

var pool = null;

function getPool() {
  if (!pool) {
    var connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.log('[DB] No DATABASE_URL — running without database (in-memory only)');
      return null;
    }

    // Railway internal URLs don't need SSL. Public URLs do.
    var isInternal = connectionString.includes('.railway.internal');

    pool = new Pool({
      connectionString: connectionString,
      ssl: isInternal ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', function(err) {
      console.error('[DB] Pool error:', err.message);
      pool = null;
    });
    console.log('[DB] Pool created (' + (isInternal ? 'internal' : 'public') + ' connection)');
  }
  return pool;
}

export async function query(text, params) {
  var p = getPool();
  if (!p) return null;
  try {
    return await p.query(text, params);
  } catch (e) {
    console.error('[DB] Query error:', e.message, '| Query:', text.substring(0, 80));
    if (e.message.includes('Connection terminated') || e.message.includes('ECONNREFUSED')) {
      pool = null;
    }
    throw e;
  }
}

export async function initDatabase() {
  var p = getPool();
  if (!p) return false;
  try {
    await p.query('CREATE TABLE IF NOT EXISTS booked_calls (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW())');
    await p.query('CREATE TABLE IF NOT EXISTS closed_deals (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW())');
    await p.query('CREATE TABLE IF NOT EXISTS eod_reports (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW())');
    await p.query('CREATE TABLE IF NOT EXISTS closer_profiles (email TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())');
    await p.query('CREATE TABLE IF NOT EXISTS commission_rates (email TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMP DEFAULT NOW())');
    await p.query('CREATE TABLE IF NOT EXISTS custom_messages (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW())');

    // After-call reports: the recap a closer files once the call is over.
    await p.query("CREATE TABLE IF NOT EXISTS after_call_reports (id TEXT PRIMARY KEY, data JSONB NOT NULL, workspace_id TEXT DEFAULT 'default', created_at TIMESTAMP DEFAULT NOW())").catch(function() {});
    await p.query('CREATE INDEX IF NOT EXISTS idx_after_call_created ON after_call_reports (created_at DESC)').catch(function() {});

    // Every outbound WhatsApp notification, whether it succeeded or not. This is the
    // audit trail for "did the group actually get told about that deal?".
    await p.query('CREATE TABLE IF NOT EXISTS message_log (id TEXT PRIMARY KEY, data JSONB NOT NULL, workspace_id TEXT DEFAULT \'default\', created_at TIMESTAMP DEFAULT NOW())').catch(function() {});
    await p.query('CREATE INDEX IF NOT EXISTS idx_message_log_created ON message_log (created_at DESC)').catch(function() {});

    // ===== MULTI-WORKSPACE =====
    // App-level settings (WhatsApp credentials, group IDs, scheduler toggles).
    // Without this the config lived only in server memory and was wiped by every
    // redeploy, which silently stopped all WhatsApp sending until it was re-entered.
    await p.query("CREATE TABLE IF NOT EXISTS app_config (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMP DEFAULT NOW())").catch(function() {});

    // Per-user accounts: credentials (scrypt hash + salt) and workspace membership.
    await p.query("CREATE TABLE IF NOT EXISTS app_users (email TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())").catch(function() {});

    await p.query("CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())").catch(function() {});

    await p.query("CREATE TABLE IF NOT EXISTS workspace_users (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, email TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW())").catch(function() {});

    var migrateTables = ['booked_calls', 'closed_deals', 'eod_reports', 'closer_profiles', 'commission_rates', 'custom_messages'];
    for (var i = 0; i < migrateTables.length; i++) {
      await p.query("ALTER TABLE " + migrateTables[i] + " ADD COLUMN IF NOT EXISTS workspace_id TEXT DEFAULT 'default'").catch(function() {});
      await p.query("UPDATE " + migrateTables[i] + " SET workspace_id = 'default' WHERE workspace_id IS NULL").catch(function() {});
      await p.query("CREATE INDEX IF NOT EXISTS idx_" + migrateTables[i] + "_ws ON " + migrateTables[i] + " (workspace_id)").catch(function() {});
    }

    await p.query(
      "INSERT INTO workspaces (id, data) VALUES ('default', $1) ON CONFLICT (id) DO NOTHING",
      [JSON.stringify({
        name: 'Influence2Impact',
        slug: 'i2i',
        ownerEmail: 'shorty21taylor@gmail.com',
        teamPassword: 'I2I2026!',
        branding: { primaryColor: '#a3a3a3', secondaryColor: '#22c55e', companyName: 'Influence2Impact' },
        onboarding: { companyName: 'Influence2Impact', industry: 'Sales Coaching', teamSize: '5-10' },
        active: true,
        createdAt: new Date().toISOString(),
      })]
    ).catch(function() {});

    console.log('[DB] Tables ready');
    return true;
  } catch (e) {
    console.error('[DB] Init error:', e.message);
    return false;
  }
}

export async function loadFromDatabase() {
  var p = getPool();
  if (!p) return null;
  try {
    var bc = await p.query('SELECT data, workspace_id FROM booked_calls ORDER BY created_at DESC LIMIT 500');
    var cd = await p.query('SELECT data, workspace_id FROM closed_deals ORDER BY created_at DESC LIMIT 500');
    var eod = await p.query('SELECT data, workspace_id FROM eod_reports ORDER BY created_at DESC LIMIT 500');
    var cp = await p.query('SELECT email, data, workspace_id FROM closer_profiles');
    var cr = await p.query('SELECT email, data, workspace_id FROM commission_rates');
    var cm = await p.query('SELECT data, workspace_id FROM custom_messages ORDER BY created_at DESC LIMIT 100');
    var ml = await p.query('SELECT data, workspace_id FROM message_log ORDER BY created_at DESC LIMIT 300').catch(function() { return { rows: [] }; });
    var ac = await p.query('SELECT data, workspace_id FROM after_call_reports ORDER BY created_at DESC LIMIT 500').catch(function() { return { rows: [] }; });

    // workspace_id is the authoritative column; mirror it onto the in-memory record
    // so every consumer can read record.workspaceId without another query.
    function withWs(r) {
      var d = r.data || {};
      d.workspaceId = r.workspace_id || 'default';
      return d;
    }

    return {
      bookedCalls: bc.rows.map(withWs),
      closedDeals: cd.rows.map(withWs),
      eodReports: eod.rows.map(withWs),
      closerProfiles: cp.rows.reduce(function(a, r) { a[r.email] = withWs(r); return a; }, {}),
      commissionRates: cr.rows.reduce(function(a, r) { a[r.email] = withWs(r); return a; }, {}),
      customMessages: cm.rows.map(withWs),
      messageLog: (ml && ml.rows ? ml.rows : []).map(withWs),
      afterCallReports: (ac && ac.rows ? ac.rows : []).map(withWs),
    };
  } catch (e) {
    console.error('[DB] Load error:', e.message);
    return null;
  }
}

export async function saveBookedCall(entry) {
  return query('INSERT INTO booked_calls (id, data, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, workspace_id = $3', [entry.id, JSON.stringify(entry), entry.workspaceId || 'default']);
}

export async function saveClosedDeal(entry) {
  return query('INSERT INTO closed_deals (id, data, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, workspace_id = $3', [entry.id, JSON.stringify(entry), entry.workspaceId || 'default']);
}

export async function saveEODReport(entry) {
  return query('INSERT INTO eod_reports (id, data, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, workspace_id = $3', [entry.id, JSON.stringify(entry), entry.workspaceId || 'default']);
}

export async function saveCloserProfile(email, data) {
  return query('INSERT INTO closer_profiles (email, data) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET data = $2, updated_at = NOW()', [email.toLowerCase(), JSON.stringify(data)]);
}

export async function saveCommissionRate(email, data) {
  return query('INSERT INTO commission_rates (email, data) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET data = $2, updated_at = NOW()', [email.toLowerCase(), JSON.stringify(data)]);
}

export async function updateDealInDB(entry) {
  return query('UPDATE closed_deals SET data = $1, workspace_id = $2 WHERE id = $3', [JSON.stringify(entry), entry.workspaceId || 'default', entry.id]);
}

export async function saveCustomMessage(entry) {
  return query('INSERT INTO custom_messages (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2', [entry.id, JSON.stringify(entry)]);
}

export async function saveAfterCallReport(entry) {
  return query(
    'INSERT INTO after_call_reports (id, data, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, workspace_id = $3',
    [entry.id, JSON.stringify(entry), entry.workspaceId || 'default']
  );
}

export async function saveMessageLogEntry(entry) {
  return query(
    'INSERT INTO message_log (id, data, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2',
    [entry.id, JSON.stringify(entry), entry.workspaceId || 'default']
  );
}

export async function loadMessageLog(limit) {
  var r = await query('SELECT data, workspace_id FROM message_log ORDER BY created_at DESC LIMIT $1', [limit || 300]);
  if (!r) return [];
  return r.rows.map(function(row) { var d = row.data || {}; d.workspaceId = row.workspace_id || 'default'; return d; });
}

export async function deleteCustomMessageDB(id) {
  return query('DELETE FROM custom_messages WHERE id = $1', [id]);
}

// ===== MULTI-WORKSPACE =====

export async function saveWorkspace(ws) {
  return query('INSERT INTO workspaces (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()', [ws.id, JSON.stringify(ws)]);
}

export async function loadWorkspaces() {
  var r = await query('SELECT id, data FROM workspaces ORDER BY created_at ASC');
  if (!r) return [];
  return r.rows.map(function(row) { var w = row.data; w.id = row.id; return w; });
}

export async function loadWorkspace(id) {
  var r = await query('SELECT data FROM workspaces WHERE id = $1', [id]);
  if (!r || r.rows.length === 0) return null;
  var w = r.rows[0].data; w.id = id; return w;
}

export async function saveWorkspaceUser(user) {
  return query('INSERT INTO workspace_users (id, workspace_id, email, data) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET data = $4', [user.id, user.workspaceId, user.email.toLowerCase(), JSON.stringify(user)]);
}

export async function findUserWorkspace(email) {
  var r = await query('SELECT workspace_id, data FROM workspace_users WHERE email = $1 LIMIT 1', [email.toLowerCase()]);
  if (!r || r.rows.length === 0) return null;
  return { workspaceId: r.rows[0].workspace_id, user: r.rows[0].data };
}

export async function loadWorkspaceUsers(workspaceId) {
  var r = await query('SELECT data FROM workspace_users WHERE workspace_id = $1 ORDER BY created_at ASC', [workspaceId]);
  if (!r) return [];
  return r.rows.map(function(row) { return row.data; });
}

// ===== APP CONFIG (WhatsApp credentials + scheduler settings) =====

export async function saveAppConfig(key, data) {
  return query(
    'INSERT INTO app_config (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
    [key, JSON.stringify(data)]
  );
}

export async function loadAppConfig(key) {
  var r = await query('SELECT data FROM app_config WHERE id = $1', [key]);
  if (!r || r.rows.length === 0) return null;
  return r.rows[0].data;
}

// ===== APP USERS =====

export async function saveAppUser(user) {
  return query(
    'INSERT INTO app_users (email, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (email) DO UPDATE SET data = $2, updated_at = NOW()',
    [user.email.toLowerCase(), JSON.stringify(user)]
  );
}

export async function loadAppUsers() {
  var r = await query('SELECT data FROM app_users ORDER BY created_at ASC');
  if (!r) return [];
  return r.rows.map(function(row) { return row.data; });
}

export async function deleteAppUserDB(email) {
  return query('DELETE FROM app_users WHERE email = $1', [email.toLowerCase()]);
}
