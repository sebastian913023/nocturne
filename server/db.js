const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'nocturne.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id               INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idea                  TEXT NOT NULL,
    name                  TEXT NOT NULL,
    tagline               TEXT NOT NULL,
    domain                TEXT NOT NULL,
    category              TEXT NOT NULL,
    one_liner             TEXT NOT NULL,
    plan_status           TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id    TEXT,
    stripe_subscription_id TEXT,
    metrics_json          TEXT NOT NULL,
    report_json           TEXT NOT NULL,
    report_date           TEXT NOT NULL,
    roadmap_json          TEXT NOT NULL,
    agents_json           TEXT NOT NULL,
    funnel_json           TEXT NOT NULL,
    campaigns_json        TEXT NOT NULL,
    money_json            TEXT NOT NULL,
    transactions_json     TEXT NOT NULL,
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    time_label  TEXT NOT NULL,
    agent       TEXT NOT NULL,
    color       TEXT NOT NULL,
    text        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_chat_business ON chat_messages(business_id, id);
  CREATE INDEX IF NOT EXISTS idx_activity_business ON activity_log(business_id, id);
`);

module.exports = db;
