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
    pool = new Pool({
      connectionString: connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', function(err) {
      console.error('[DB] Pool error:', err.message);
    });
    console.log('[DB] Pool created');
  }
  return pool;
}

export async function query(text, params) {
  var p = getPool();
  if (!p) return null;
  try {
    var result = await p.query(text, params);
    return result;
  } catch (e) {
    console.error('[DB] Query error:', e.message);
    console.error('[DB] Query:', text.substring(0, 200));
    throw e;
  }
}

export async function initDatabase() {
  var p = getPool();
  if (!p) {
    console.log('[DB] Skipping init — no database configured');
    return false;
  }

  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS booked_calls (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS closed_deals (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS eod_reports (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS closer_profiles (
        email TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS commission_rates (
        email TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS custom_messages (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('[DB] Tables initialized');
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
    var bookedCalls = await p.query('SELECT data FROM booked_calls ORDER BY created_at DESC LIMIT 500');
    var closedDeals = await p.query('SELECT data FROM closed_deals ORDER BY created_at DESC LIMIT 500');
    var eodReports = await p.query('SELECT data FROM eod_reports ORDER BY created_at DESC LIMIT 500');
    var closerProfiles = await p.query('SELECT email, data FROM closer_profiles');
    var commissionRates = await p.query('SELECT email, data FROM commission_rates');
    var customMessages = await p.query('SELECT data FROM custom_messages');

    return {
      bookedCalls: bookedCalls.rows.map(function(r) { return r.data; }),
      closedDeals: closedDeals.rows.map(function(r) { return r.data; }),
      eodReports: eodReports.rows.map(function(r) { return r.data; }),
      closerProfiles: closerProfiles.rows.reduce(function(acc, r) { acc[r.email] = r.data; return acc; }, {}),
      commissionRates: commissionRates.rows.reduce(function(acc, r) { acc[r.email] = r.data; return acc; }, {}),
      customMessages: customMessages.rows.map(function(r) { return r.data; }),
    };
  } catch (e) {
    console.error('[DB] Load error:', e.message);
    return null;
  }
}

export async function saveBookedCall(entry) {
  return query(
    'INSERT INTO booked_calls (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
    [entry.id, JSON.stringify(entry)]
  );
}

export async function saveClosedDeal(entry) {
  return query(
    'INSERT INTO closed_deals (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
    [entry.id, JSON.stringify(entry)]
  );
}

export async function saveEODReport(entry) {
  return query(
    'INSERT INTO eod_reports (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
    [entry.id, JSON.stringify(entry)]
  );
}

export async function saveCloserProfile(email, data) {
  return query(
    'INSERT INTO closer_profiles (email, data) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET data = $2, updated_at = NOW()',
    [email.toLowerCase(), JSON.stringify(data)]
  );
}

export async function saveCommissionRate(email, data) {
  return query(
    'INSERT INTO commission_rates (email, data) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET data = $2, updated_at = NOW()',
    [email.toLowerCase(), JSON.stringify(data)]
  );
}

export async function saveCustomMessage(entry) {
  return query(
    'INSERT INTO custom_messages (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
    [entry.id, JSON.stringify(entry)]
  );
}

export async function deleteCustomMessageFromDB(id) {
  return query('DELETE FROM custom_messages WHERE id = $1', [id]);
}

export async function updateDealInDB(entry) {
  return query(
    'UPDATE closed_deals SET data = $1 WHERE id = $2',
    [JSON.stringify(entry), entry.id]
  );
}
