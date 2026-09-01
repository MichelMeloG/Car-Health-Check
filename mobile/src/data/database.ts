import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT,
      model TEXT NOT NULL,
      year INTEGER,
      odometer_km INTEGER,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT,
      category TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      occurred_at TEXT NOT NULL,
      odometer_km INTEGER,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  await addColumnIfMissing(db, 'vehicles', 'owner_id TEXT');
  await addColumnIfMissing(db, 'vehicles', 'deleted INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'vehicles', "sync_state TEXT NOT NULL DEFAULT 'pending'");
  await addColumnIfMissing(db, 'expenses', 'owner_id TEXT');
  await addColumnIfMissing(db, 'expenses', 'deleted INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'expenses', "sync_state TEXT NOT NULL DEFAULT 'pending'");
}

async function addColumnIfMissing(db: SQLiteDatabase, table: string, definition: string) {
  const column = definition.split(' ')[0];
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}
