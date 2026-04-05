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
    var bc = await p.query('SELECT data FROM booked_calls ORDER BY created_at DESC LIMIT 500');
    var cd = await p.query('SELECT data FROM closed_deals ORDER BY created_at DESC LIMIT 500');
    var eod = await p.query('SELECT data FROM eod_reports ORDER BY created_at DESC LIMIT 500');
    var cp = await p.query('SELECT email, data FROM closer_profiles');
    var cr = await p.query('SELECT email, data FROM commission_rates');
    var cm = await p.query('SELECT data FROM custom_messages ORDER BY created_at DESC LIMIT 100');
    return {
      bookedCalls: bc.rows.map(function(r) { return r.data; }),
      closedDeals: cd.rows.map(function(r) { return r.data; }),
      eodReports: eod.rows.map(function(r) { return r.data; }),
      closerProfiles: cp.rows.reduce(function(a, r) { a[r.email] = r.data; return a; }, {}),
      commissionRates: cr.rows.reduce(function(a, r) { a[r.email] = r.data; return a; }, {}),
      customMessages: cm.rows.map(function(r) { return r.data; }),
    };
  } catch (e) {
    console.error('[DB] Load error:', e.message);
    return null;
  }
}

export async function saveBookedCall(entry) {
  return query('INSERT INTO booked_calls (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2', [entry.id, JSON.stringify(entry)]);
}

export async function saveClosedDeal(entry) {
  return query('INSERT INTO closed_deals (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2', [entry.id, JSON.stringify(entry)]);
}

export async function saveEODReport(entry) {
  return query('INSERT INTO eod_reports (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2', [entry.id, JSON.stringify(entry)]);
}

export async function saveCloserProfile(email, data) {
  return query('INSERT INTO closer_profiles (email, data) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET data = $2, updated_at = NOW()', [email.toLowerCase(), JSON.stringify(data)]);
}

export async function saveCommissionRate(email, data) {
  return query('INSERT INTO commission_rates (email, data) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET data = $2, updated_at = NOW()', [email.toLowerCase(), JSON.stringify(data)]);
}

export async function updateDealInDB(entry) {
  return query('UPDATE closed_deals SET data = $1 WHERE id = $2', [JSON.stringify(entry), entry.id]);
}

export async function saveCustomMessage(entry) {
  return query('INSERT INTO custom_messages (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2', [entry.id, JSON.stringify(entry)]);
}

export async function deleteCustomMessageDB(id) {
  return query('DELETE FROM custom_messages WHERE id = $1', [id]);
}
