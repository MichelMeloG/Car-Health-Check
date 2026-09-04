import type { SQLiteDatabase } from 'expo-sqlite';

import { RAW_OBD_RETENTION_DAYS } from './obdRetention';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT,
      model TEXT NOT NULL,
      brand TEXT,
      nickname TEXT,
      year INTEGER,
      engine TEXT,
      transmission TEXT,
      fuel TEXT,
      color TEXT,
      plate TEXT,
      vin TEXT,
      odometer_km INTEGER,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT,
      vehicle_id TEXT,
      transaction_id TEXT,
      category TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      occurred_at TEXT NOT NULL,
      supplier TEXT,
      odometer_km INTEGER,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS app_preferences (
      owner_id TEXT PRIMARY KEY NOT NULL,
      active_vehicle_id TEXT,
      multi_vehicle_migrated INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maintenance_events (
      id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, vehicle_id TEXT NOT NULL, transaction_id TEXT,
      service_type TEXT NOT NULL, occurred_at TEXT NOT NULL, odometer_km INTEGER,
      workshop TEXT, labor_cents INTEGER NOT NULL DEFAULT 0, parts_cents INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '', evidence_level TEXT NOT NULL DEFAULT 'declared',
      updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, sync_state TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS fuel_entries (
      id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, vehicle_id TEXT NOT NULL, transaction_id TEXT,
      occurred_at TEXT NOT NULL, odometer_km INTEGER NOT NULL, liters REAL NOT NULL,
      total_cents INTEGER NOT NULL, fuel_type TEXT NOT NULL, station TEXT, tank_full INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, sync_state TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, vehicle_id TEXT NOT NULL,
      title TEXT NOT NULL, due_date TEXT, due_odometer_km INTEGER, completed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, sync_state TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS scan_sessions (
      id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, vehicle_id TEXT NOT NULL,
      captured_at TEXT NOT NULL, quality_score REAL NOT NULL, telemetry_json TEXT NOT NULL,
      dtcs_json TEXT NOT NULL, raw_json TEXT NOT NULL, updated_at TEXT NOT NULL,
      protocol TEXT, adapter_name TEXT, supported_pids_json TEXT NOT NULL DEFAULT '[]',
      missing_pids_json TEXT NOT NULL DEFAULT '[]', pid_bitmaps_json TEXT NOT NULL DEFAULT '{}',
      dtc_groups_json TEXT NOT NULL DEFAULT '{"stored":[],"pending":[],"permanent":[]}',
      segments_json TEXT NOT NULL DEFAULT '[]', quality_json TEXT NOT NULL DEFAULT '{}',
      raw_retention_until TEXT,
      deleted INTEGER NOT NULL DEFAULT 0, sync_state TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, vehicle_id TEXT, action TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS consents (
      id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, consent_type TEXT NOT NULL,
      granted INTEGER NOT NULL, updated_at TEXT NOT NULL, sync_state TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS financial_transactions (
      id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, vehicle_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'fuel', 'maintenance')),
      category TEXT NOT NULL, amount_cents INTEGER NOT NULL, occurred_at TEXT NOT NULL,
      supplier_or_workshop TEXT, odometer_km INTEGER, notes TEXT NOT NULL DEFAULT '',
      source_entity_type TEXT, source_entity_id TEXT, updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0, sync_state TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  await addColumnIfMissing(db, 'vehicles', 'owner_id TEXT');
  await addColumnIfMissing(db, 'vehicles', 'brand TEXT');
  await addColumnIfMissing(db, 'vehicles', 'nickname TEXT');
  await addColumnIfMissing(db, 'vehicles', 'engine TEXT');
  await addColumnIfMissing(db, 'vehicles', 'transmission TEXT');
  await addColumnIfMissing(db, 'vehicles', 'fuel TEXT');
  await addColumnIfMissing(db, 'vehicles', 'color TEXT');
  await addColumnIfMissing(db, 'vehicles', 'plate TEXT');
  await addColumnIfMissing(db, 'vehicles', 'vin TEXT');
  await addColumnIfMissing(db, 'vehicles', 'deleted INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'vehicles', "sync_state TEXT NOT NULL DEFAULT 'pending'");
  await addColumnIfMissing(db, 'expenses', 'owner_id TEXT');
  await addColumnIfMissing(db, 'expenses', 'deleted INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'expenses', "sync_state TEXT NOT NULL DEFAULT 'pending'");
  await addColumnIfMissing(db, 'expenses', 'vehicle_id TEXT');
  await addColumnIfMissing(db, 'expenses', 'transaction_id TEXT');
  await addColumnIfMissing(db, 'expenses', 'supplier TEXT');
  await addColumnIfMissing(db, 'maintenance_events', 'transaction_id TEXT');
  await addColumnIfMissing(db, 'fuel_entries', 'transaction_id TEXT');
  await addColumnIfMissing(db, 'scan_sessions', 'protocol TEXT');
  await addColumnIfMissing(db, 'scan_sessions', 'adapter_name TEXT');
  await addColumnIfMissing(db, 'scan_sessions', "supported_pids_json TEXT NOT NULL DEFAULT '[]'");
  await addColumnIfMissing(db, 'scan_sessions', "missing_pids_json TEXT NOT NULL DEFAULT '[]'");
  await addColumnIfMissing(db, 'scan_sessions', "pid_bitmaps_json TEXT NOT NULL DEFAULT '{}'");
  await addColumnIfMissing(
    db,
    'scan_sessions',
    "dtc_groups_json TEXT NOT NULL DEFAULT '{\"stored\":[],\"pending\":[],\"permanent\":[]}'",
  );
  await addColumnIfMissing(db, 'scan_sessions', "segments_json TEXT NOT NULL DEFAULT '[]'");
  await addColumnIfMissing(db, 'scan_sessions', "quality_json TEXT NOT NULL DEFAULT '{}'");
  await addColumnIfMissing(db, 'scan_sessions', 'raw_retention_until TEXT');
  // Scans criados antes desta política também precisam perder os bytes brutos da nuvem.
  // Marcá-los como pending força uma gravação do resumo sem raw_json/pid_bitmaps_json.
  await db.execAsync(`
    UPDATE scan_sessions
    SET raw_retention_until = CASE
          WHEN datetime(captured_at) IS NOT NULL
            THEN strftime('%Y-%m-%dT%H:%M:%fZ', captured_at, '+${RAW_OBD_RETENTION_DAYS} days')
          ELSE '1970-01-01T00:00:00.000Z'
        END,
        sync_state = 'pending'
    WHERE raw_json <> '{}'
      AND (raw_retention_until IS NULL OR raw_retention_until = '')
  `);
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS expenses_owner_vehicle_occurred_at ON expenses(owner_id, vehicle_id, occurred_at DESC)',
  );
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS maintenance_owner_vehicle_date ON maintenance_events(owner_id, vehicle_id, occurred_at DESC)',
  );
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS fuel_owner_vehicle_date ON fuel_entries(owner_id, vehicle_id, occurred_at DESC)',
  );
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS reminders_owner_vehicle ON reminders(owner_id, vehicle_id, completed)',
  );
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS scans_owner_vehicle_date ON scan_sessions(owner_id, vehicle_id, captured_at DESC)',
  );
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS transactions_owner_vehicle_date ON financial_transactions(owner_id, vehicle_id, occurred_at DESC)',
  );
  await migrateFinancialTransactions(db);
}

async function migrateFinancialTransactions(db: SQLiteDatabase) {
  await db.execAsync(`
    INSERT OR IGNORE INTO financial_transactions
      (id, owner_id, vehicle_id, type, category, amount_cents, occurred_at, supplier_or_workshop, odometer_km, notes, source_entity_type, source_entity_id, updated_at, deleted, sync_state)
    SELECT 'transaction_expense_' || id, owner_id, vehicle_id, 'expense', category, amount_cents, occurred_at, supplier, odometer_km, description, 'expense', id, updated_at, deleted, 'pending'
    FROM expenses WHERE owner_id IS NOT NULL AND vehicle_id IS NOT NULL;
    UPDATE expenses SET transaction_id = 'transaction_expense_' || id WHERE transaction_id IS NULL;

    UPDATE financial_transactions
    SET supplier_or_workshop = (
      SELECT supplier FROM expenses
      WHERE expenses.id = financial_transactions.source_entity_id
    )
    WHERE type = 'expense'
      AND (supplier_or_workshop IS NULL OR supplier_or_workshop = '')
      AND source_entity_type = 'expense';

    INSERT OR IGNORE INTO financial_transactions
      (id, owner_id, vehicle_id, type, category, amount_cents, occurred_at, supplier_or_workshop, odometer_km, notes, source_entity_type, source_entity_id, updated_at, deleted, sync_state)
    SELECT 'transaction_maintenance_' || id, owner_id, vehicle_id, 'maintenance', 'Manutenção', labor_cents + parts_cents, occurred_at, workshop, odometer_km, notes, 'maintenance', id, updated_at, deleted, 'pending'
    FROM maintenance_events;
    UPDATE maintenance_events SET transaction_id = 'transaction_maintenance_' || id WHERE transaction_id IS NULL;

    INSERT OR IGNORE INTO financial_transactions
      (id, owner_id, vehicle_id, type, category, amount_cents, occurred_at, supplier_or_workshop, odometer_km, source_entity_type, source_entity_id, updated_at, deleted, sync_state)
    SELECT 'transaction_fuel_' || id, owner_id, vehicle_id, 'fuel', 'Combustível', total_cents, occurred_at, station, odometer_km, 'fuel', id, updated_at, deleted, 'pending'
    FROM fuel_entries;
    UPDATE fuel_entries SET transaction_id = 'transaction_fuel_' || id WHERE transaction_id IS NULL;
  `);
}

async function addColumnIfMissing(db: SQLiteDatabase, table: string, definition: string) {
  const column = definition.split(' ')[0];
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

/**
 * Respostas brutas servem apenas para depuração do próprio usuário. Elas ficam no aparelho por
 * um período limitado e são removidas localmente, preservando o resumo estruturado do check-up.
 */
export async function purgeExpiredObdRawResponses(
  db: SQLiteDatabase,
  ownerId: string,
  timestamp = new Date().toISOString(),
) {
  const result = await db.runAsync(
    `UPDATE scan_sessions
     SET raw_json = '{}', pid_bitmaps_json = '{}', raw_retention_until = NULL, updated_at = ?, sync_state = 'pending'
     WHERE owner_id = ?
       AND deleted = 0
       AND raw_retention_until IS NOT NULL
       AND raw_retention_until <= ?
       AND raw_json <> '{}'`,
    [timestamp, ownerId, timestamp],
  );
  return result.changes;
}
