const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'medidash.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      mongo_id        TEXT    UNIQUE,
      name            TEXT    NOT NULL,
      age             INTEGER,
      gender          TEXT,
      blood_type      TEXT,
      primary_condition TEXT,
      status          TEXT    DEFAULT 'Stable',
      smoking_status  TEXT,
      allergies       TEXT,
      medications     TEXT,
      last_visit      TEXT,
      created_at      TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vitals (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id  INTEGER NOT NULL,
      source      TEXT    DEFAULT 'EHR',
      heart_rate  INTEGER,
      systolic    INTEGER,
      diastolic   INTEGER,
      spo2        REAL,
      temperature REAL,
      resp_rate   INTEGER,
      recorded_at TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS lab_results (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id  INTEGER NOT NULL,
      test_name   TEXT    NOT NULL,
      value       REAL,
      unit        TEXT,
      ref_low     REAL,
      ref_high    REAL,
      flag        TEXT,
      recorded_at TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS imaging (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id  INTEGER NOT NULL,
      modality    TEXT    NOT NULL,
      body_part   TEXT,
      finding     TEXT,
      impression  TEXT,
      status      TEXT    DEFAULT 'Final',
      recorded_at TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS timeline (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id  INTEGER NOT NULL,
      event_type  TEXT    NOT NULL,
      title       TEXT    NOT NULL,
      detail      TEXT,
      source      TEXT,
      event_date  TEXT    DEFAULT (date('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS wearable_data (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id  INTEGER NOT NULL,
      metric      TEXT    NOT NULL,
      value       REAL,
      recorded_at TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id  INTEGER NOT NULL,
      severity    TEXT    DEFAULT 'warning',
      message     TEXT    NOT NULL,
      source      TEXT,
      resolved    INTEGER DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      time       TEXT    NOT NULL,
      purpose    TEXT,
      room       TEXT,
      priority   INTEGER DEFAULT 0,
      completed  INTEGER DEFAULT 0,
      date       TEXT    DEFAULT (date('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS stats (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      total_patients  INTEGER DEFAULT 0,
      active_monitors INTEGER DEFAULT 0,
      critical_alerts INTEGER DEFAULT 0,
      data_sources    INTEGER DEFAULT 0
    );
  `);

  // Migration: add mongo_id column if missing (existing databases)
  const cols = db.prepare("PRAGMA table_info(patients)").all();
  if (!cols.find(c => c.name === 'mongo_id')) {
    db.exec("ALTER TABLE patients ADD COLUMN mongo_id TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_mongo_id ON patients(mongo_id)");
  }
}

module.exports = { getDb };
