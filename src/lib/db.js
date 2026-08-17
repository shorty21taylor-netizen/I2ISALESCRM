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

// Tables that carry tenant-scoped records.
var SCOPED_TABLES = ['booked_calls', 'closed_deals', 'eod_reports', 'closer_profiles', 'commission_rates', 'custom_messages'];

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
    await p.query('CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())');

    // Multi-tenancy migration — additive and idempotent, safe to run on every boot.
    for (var i = 0; i < SCOPED_TABLES.length; i++) {
      var t = SCOPED_TABLES[i];
      await p.query('ALTER TABLE ' + t + ' ADD COLUMN IF NOT EXISTS workspace_id TEXT');
      await p.query('CREATE INDEX IF NOT EXISTS idx_' + t + '_workspace ON ' + t + ' (workspace_id)');
    }

    console.log('[DB] Tables ready');
    return true;
  } catch (e) {
    console.error('[DB] Init error:', e.message);
    return false;
  }
}

// Assign a workspace to every legacy row that predates multi-tenancy.
// Booked calls and deals resolve by program; EOD reports have no program, so they
// go to whichever brand they collected more cash for (ties -> fallback).
export async function backfillWorkspaces(myfmPrograms, myfmId, fallbackId) {
  var p = getPool();
  if (!p) return 0;
  var updated = 0;
  try {
    var programList = myfmPrograms.map(function(s) { return s.toLowerCase(); });

    var tables = ['booked_calls', 'closed_deals'];
    for (var i = 0; i < tables.length; i++) {
      var r = await p.query(
        'UPDATE ' + tables[i] + " SET workspace_id = CASE WHEN lower(trim(coalesce(data->>'program',''))) = ANY($1) THEN $2 ELSE $3 END" +
        ' WHERE workspace_id IS NULL',
        [programList, myfmId, fallbackId]
      );
      updated += r.rowCount || 0;
    }

    var eod = await p.query(
      "UPDATE eod_reports SET workspace_id = CASE WHEN coalesce((data->>'cashCollectedMYFM')::numeric, 0) > coalesce((data->>'cashCollectedI2I')::numeric, 0) THEN $1 ELSE $2 END" +
      ' WHERE workspace_id IS NULL',
      [myfmId, fallbackId]
    );
    updated += eod.rowCount || 0;

    var rest = ['closer_profiles', 'commission_rates', 'custom_messages'];
    for (var j = 0; j < rest.length; j++) {
      var rr = await p.query('UPDATE ' + rest[j] + ' SET workspace_id = $1 WHERE workspace_id IS NULL', [fallbackId]);
      updated += rr.rowCount || 0;
    }

    if (updated > 0) console.log('[DB] Backfilled workspace_id on', updated, 'legacy rows');
    return updated;
  } catch (e) {
    console.error('[DB] Backfill error:', e.message);
    return 0;
  }
}

export async function loadWorkspaces() {
  var p = getPool();
  if (!p) return null;
  try {
    var r = await p.query('SELECT data FROM workspaces ORDER BY created_at ASC');
    return r.rows.map(function(row) { return row.data; });
  } catch (e) {
    console.error('[DB] Load workspaces error:', e.message);
    return null;
  }
}

export async function saveWorkspace(ws) {
  return query('INSERT INTO workspaces (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()', [ws.id, JSON.stringify(ws)]);
}

export async function deleteWorkspaceDB(id) {
  return query('DELETE FROM workspaces WHERE id = $1', [id]);
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

    // The workspace_id column is authoritative; mirror it onto the in-memory record
    // so every consumer can read record.workspaceId without touching the DB.
    function withWorkspace(r) {
      var d = r.data || {};
      if (r.workspace_id) d.workspaceId = r.workspace_id;
      return d;
    }

    return {
      bookedCalls: bc.rows.map(withWorkspace),
      closedDeals: cd.rows.map(withWorkspace),
      eodReports: eod.rows.map(withWorkspace),
      closerProfiles: cp.rows.reduce(function(a, r) { a[r.email] = withWorkspace(r); return a; }, {}),
      commissionRates: cr.rows.reduce(function(a, r) { a[r.email] = withWorkspace(r); return a; }, {}),
      customMessages: cm.rows.map(withWorkspace),
    };
  } catch (e) {
    console.error('[DB] Load error:', e.message);
    return null;
  }
}

export async function saveBookedCall(entry) {
  return query('INSERT INTO booked_calls (id, data, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, workspace_id = $3', [entry.id, JSON.stringify(entry), entry.workspaceId || null]);
}

export async function saveClosedDeal(entry) {
  return query('INSERT INTO closed_deals (id, data, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, workspace_id = $3', [entry.id, JSON.stringify(entry), entry.workspaceId || null]);
}

export async function saveEODReport(entry) {
  return query('INSERT INTO eod_reports (id, data, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, workspace_id = $3', [entry.id, JSON.stringify(entry), entry.workspaceId || null]);
}

export async function saveCloserProfile(email, data) {
  return query('INSERT INTO closer_profiles (email, data, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET data = $2, workspace_id = $3, updated_at = NOW()', [email.toLowerCase(), JSON.stringify(data), data.workspaceId || null]);
}

export async function saveCommissionRate(email, data) {
  return query('INSERT INTO commission_rates (email, data, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET data = $2, workspace_id = $3, updated_at = NOW()', [email.toLowerCase(), JSON.stringify(data), data.workspaceId || null]);
}

export async function updateDealInDB(entry) {
  return query('UPDATE closed_deals SET data = $1, workspace_id = $2 WHERE id = $3', [JSON.stringify(entry), entry.workspaceId || null, entry.id]);
}

export async function saveCustomMessage(entry) {
  return query('INSERT INTO custom_messages (id, data, workspace_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, workspace_id = $3', [entry.id, JSON.stringify(entry), entry.workspaceId || null]);
}

export async function deleteCustomMessageDB(id) {
  return query('DELETE FROM custom_messages WHERE id = $1', [id]);
}

export async function deleteBookedCall(id) {
  return query('DELETE FROM booked_calls WHERE id = $1', [id]);
}

export async function deleteClosedDeal(id) {
  return query('DELETE FROM closed_deals WHERE id = $1', [id]);
}

export async function deleteEODReport(id) {
  return query('DELETE FROM eod_reports WHERE id = $1', [id]);
}

export async function deleteCloserProfile(email) {
  return query('DELETE FROM closer_profiles WHERE email = $1', [email.toLowerCase()]);
}
