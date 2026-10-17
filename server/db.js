const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set (see .env.example)');
}

// Vercel runs many short-lived function instances concurrently, each with
// its own pool, vs. Railway's single long-lived process — cap it lower
// there so instances don't collectively exhaust Neon's connection limit.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: process.env.VERCEL ? 3 : 10 });

// An idle client being dropped (Neon scale-to-zero, network blip) must not
// crash the process; the pool replaces it on next use.
pool.on('error', (e) => console.error('[db] idle client error:', e.message));

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id                     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idea                   TEXT NOT NULL,
    name                   TEXT NOT NULL,
    tagline                TEXT NOT NULL,
    domain                 TEXT NOT NULL,
    category               TEXT NOT NULL,
    one_liner              TEXT NOT NULL,
    plan_status            TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    metrics_json           TEXT NOT NULL,
    report_json            TEXT NOT NULL,
    report_date            TEXT NOT NULL,
    roadmap_json           TEXT NOT NULL,
    agents_json            TEXT NOT NULL,
    funnel_json            TEXT NOT NULL,
    campaigns_json         TEXT NOT NULL,
    money_json             TEXT NOT NULL,
    transactions_json      TEXT NOT NULL,
    autonomy               TEXT NOT NULL DEFAULT 'approval',
    spend_cap              INTEGER NOT NULL DEFAULT 25,
    digest                 TEXT NOT NULL DEFAULT '8am',
    agent_enabled_json     TEXT NOT NULL DEFAULT '{}',
    agents_busy_json       TEXT NOT NULL DEFAULT '[]',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    title       TEXT NOT NULL,
    detail      TEXT NOT NULL,
    amount      TEXT,
    owner       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at  TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    time_label  TEXT NOT NULL,
    agent       TEXT NOT NULL,
    color       TEXT NOT NULL,
    text        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_chat_business ON chat_messages(business_id, id);
  CREATE INDEX IF NOT EXISTS idx_activity_business ON activity_log(business_id, id);
  CREATE INDEX IF NOT EXISTS idx_approvals_business ON approvals(business_id, id);
`;

function query(text, params) {
  return pool.query(text, params);
}

// Runs fn(client) inside one transaction; client.query() calls are atomic.
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Called once at boot, before the server accepts requests.
async function init() {
  await pool.query(SCHEMA);
}

module.exports = { query, tx, init };
