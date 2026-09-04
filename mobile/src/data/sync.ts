import type { SQLiteDatabase } from 'expo-sqlite';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';

import { firestore } from '../services/firebase';

type StoredExpense = {
  id: string;
  vehicle_id: string;
  transaction_id: string | null;
  category: string;
  amount_cents: number;
  occurred_at: string;
  supplier: string | null;
  odometer_km: number | null;
  description: string;
  updated_at: string;
  deleted: number;
  sync_state: string;
};

type StoredVehicle = {
  id: string;
  model: string;
  brand: string | null;
  nickname: string | null;
  year: number | null;
  engine: string | null;
  transmission: string | null;
  fuel: string | null;
  color: string | null;
  plate: string | null;
  vin: string | null;
  odometer_km: number | null;
  updated_at: string;
  deleted: number;
  sync_state: string;
};

type StoredTransaction = {
  id: string;
  updated_at: string;
};

function isNewer(remote: unknown, local: string) {
  return typeof remote === 'string' && remote > local;
}

function evidenceLevel(value: unknown) {
  return ['declared', 'documented', 'verified', 'corroborated'].includes(String(value))
    ? String(value)
    : 'declared';
}

/** Last-write-wins por updatedAt. IDs locais estáveis tornam retries idempotentes. */
export async function syncUserData(db: SQLiteDatabase, userId: string) {
  const userRef = doc(firestore, 'users', userId);
  const [
    remoteVehicles,
    remoteExpenses,
    remoteTransactions,
    remoteMaintenance,
    remoteFuelEntries,
    remoteReminders,
    remoteScans,
  ] = await Promise.all([
    getDocs(collection(userRef, 'vehicles')),
    getDocs(collection(userRef, 'expenses')),
    getDocs(collection(userRef, 'financialTransactions')),
    getDocs(collection(userRef, 'maintenance')),
    getDocs(collection(userRef, 'fuelEntries')),
    getDocs(collection(userRef, 'reminders')),
    getDocs(collection(userRef, 'scanSessions')),
  ]);

  const localVehicles = await db.getAllAsync<StoredVehicle>(
    'SELECT id, model, brand, nickname, year, engine, transmission, fuel, color, plate, vin, odometer_km, updated_at, deleted, sync_state FROM vehicles WHERE owner_id = ?',
    userId,
  );
  const localExpenses = await db.getAllAsync<StoredExpense>(
    'SELECT id, vehicle_id, transaction_id, category, amount_cents, occurred_at, supplier, odometer_km, description, updated_at, deleted, sync_state FROM expenses WHERE owner_id = ?',
    userId,
  );
  const localTransactions = await db.getAllAsync<StoredTransaction>(
    'SELECT id, updated_at FROM financial_transactions WHERE owner_id = ?',
    userId,
  );
  const [localMaintenance, localFuelEntries, localReminders, localScans] = await Promise.all([
    db.getAllAsync<StoredTransaction>(
      'SELECT id, updated_at FROM maintenance_events WHERE owner_id = ?',
      userId,
    ),
    db.getAllAsync<StoredTransaction>(
      'SELECT id, updated_at FROM fuel_entries WHERE owner_id = ?',
      userId,
    ),
    db.getAllAsync<StoredTransaction>(
      'SELECT id, updated_at FROM reminders WHERE owner_id = ?',
      userId,
    ),
    db.getAllAsync<StoredTransaction>(
      'SELECT id, updated_at FROM scan_sessions WHERE owner_id = ?',
      userId,
    ),
  ]);
  const vehicleById = new Map(localVehicles.map((item) => [item.id, item]));
  const expenseById = new Map(localExpenses.map((item) => [item.id, item]));
  const transactionById = new Map(localTransactions.map((item) => [item.id, item]));
  const maintenanceById = new Map(localMaintenance.map((item) => [item.id, item]));
  const fuelById = new Map(localFuelEntries.map((item) => [item.id, item]));
  const reminderById = new Map(localReminders.map((item) => [item.id, item]));
  const scanById = new Map(localScans.map((item) => [item.id, item]));

  for (const snapshot of remoteVehicles.docs) {
    const remote = snapshot.data();
    const local = vehicleById.get(snapshot.id);
    if (!local || isNewer(remote.updatedAt, local.updated_at)) {
      await db.runAsync(
        `INSERT OR REPLACE INTO vehicles
          (id, owner_id, model, brand, nickname, year, engine, transmission, fuel, color, plate, vin, odometer_km, updated_at, deleted, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        snapshot.id,
        userId,
        String(remote.model ?? ''),
        typeof remote.brand === 'string' ? remote.brand : null,
        typeof remote.nickname === 'string' ? remote.nickname : null,
        typeof remote.year === 'number' ? remote.year : null,
        typeof remote.engine === 'string' ? remote.engine : null,
        typeof remote.transmission === 'string' ? remote.transmission : null,
        typeof remote.fuel === 'string' ? remote.fuel : null,
        typeof remote.color === 'string' ? remote.color : null,
        typeof remote.plate === 'string' ? remote.plate : null,
        typeof remote.vin === 'string' ? remote.vin : null,
        typeof remote.odometerKm === 'number' ? remote.odometerKm : null,
        typeof remote.updatedAt === 'string' ? remote.updatedAt : new Date(0).toISOString(),
        remote.deleted ? 1 : 0,
      );
    }
  }

  for (const snapshot of remoteExpenses.docs) {
    const remote = snapshot.data();
    const local = expenseById.get(snapshot.id);
    if (!local || isNewer(remote.updatedAt, local.updated_at)) {
      await db.runAsync(
        `INSERT OR REPLACE INTO expenses
          (id, owner_id, vehicle_id, transaction_id, category, amount_cents, occurred_at, supplier, odometer_km, description, updated_at, deleted, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        snapshot.id,
        userId,
        String(remote.vehicleId ?? 'vehicle_primary'),
        typeof remote.transactionId === 'string'
          ? remote.transactionId
          : `transaction_expense_${snapshot.id}`,
        String(remote.category ?? ''),
        typeof remote.amountCents === 'number' ? remote.amountCents : 0,
        String(remote.occurredAt ?? ''),
        typeof remote.supplier === 'string' ? remote.supplier : null,
        typeof remote.odometerKm === 'number' ? remote.odometerKm : null,
        String(remote.description ?? ''),
        typeof remote.updatedAt === 'string' ? remote.updatedAt : new Date(0).toISOString(),
        remote.deleted ? 1 : 0,
      );
      const remoteUpdatedAt =
        typeof remote.updatedAt === 'string' ? remote.updatedAt : new Date(0).toISOString();
      await db.runAsync(
        "INSERT OR IGNORE INTO financial_transactions (id, owner_id, vehicle_id, type, category, amount_cents, occurred_at, supplier_or_workshop, odometer_km, notes, source_entity_type, source_entity_id, updated_at, deleted, sync_state) VALUES (?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, 'expense', ?, ?, ?, 'synced')",
        [
          typeof remote.transactionId === 'string'
            ? remote.transactionId
            : `transaction_expense_${snapshot.id}`,
          userId,
          String(remote.vehicleId ?? 'vehicle_primary'),
          String(remote.category ?? 'Outros'),
          typeof remote.amountCents === 'number' ? remote.amountCents : 0,
          String(remote.occurredAt ?? ''),
          typeof remote.supplier === 'string' ? remote.supplier : null,
          typeof remote.odometerKm === 'number' ? remote.odometerKm : null,
          String(remote.description ?? ''),
          snapshot.id,
          remoteUpdatedAt,
          remote.deleted ? 1 : 0,
        ],
      );
    }
  }

  for (const snapshot of remoteTransactions.docs) {
    const remote = snapshot.data();
    const local = transactionById.get(snapshot.id);
    if (!local || isNewer(remote.updatedAt, local.updated_at)) {
      await db.runAsync(
        `INSERT OR REPLACE INTO financial_transactions
          (id, owner_id, vehicle_id, type, category, amount_cents, occurred_at, supplier_or_workshop, odometer_km, notes, source_entity_type, source_entity_id, updated_at, deleted, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        snapshot.id,
        userId,
        String(remote.vehicleId ?? 'vehicle_primary'),
        ['expense', 'fuel', 'maintenance'].includes(String(remote.type))
          ? String(remote.type)
          : 'expense',
        String(remote.category ?? 'Outros'),
        typeof remote.amountCents === 'number' ? remote.amountCents : 0,
        String(remote.occurredAt ?? ''),
        typeof remote.supplierOrWorkshop === 'string' ? remote.supplierOrWorkshop : null,
        typeof remote.odometerKm === 'number' ? remote.odometerKm : null,
        String(remote.notes ?? ''),
        typeof remote.sourceEntityType === 'string' ? remote.sourceEntityType : null,
        typeof remote.sourceEntityId === 'string' ? remote.sourceEntityId : null,
        typeof remote.updatedAt === 'string' ? remote.updatedAt : new Date(0).toISOString(),
        remote.deleted ? 1 : 0,
      );
    }
  }

  for (const snapshot of remoteMaintenance.docs) {
    const remote = snapshot.data();
    const local = maintenanceById.get(snapshot.id);
    if (!local || isNewer(remote.updatedAt, local.updated_at)) {
      const updatedAt =
        typeof remote.updatedAt === 'string' ? remote.updatedAt : new Date(0).toISOString();
      const transactionId =
        typeof remote.transactionId === 'string'
          ? remote.transactionId
          : `transaction_maintenance_${snapshot.id}`;
      const vehicleId = String(remote.vehicleId ?? 'vehicle_primary');
      const laborCents = typeof remote.laborCents === 'number' ? remote.laborCents : 0;
      const partsCents = typeof remote.partsCents === 'number' ? remote.partsCents : 0;
      const occurredAt = String(remote.occurredAt ?? '');
      const workshop = typeof remote.workshop === 'string' ? remote.workshop : null;
      const notes = String(remote.notes ?? '');
      await db.runAsync(
        `INSERT OR REPLACE INTO maintenance_events
          (id, owner_id, vehicle_id, transaction_id, service_type, occurred_at, odometer_km, workshop, labor_cents, parts_cents, notes, evidence_level, updated_at, deleted, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          snapshot.id,
          userId,
          vehicleId,
          transactionId,
          String(remote.serviceType ?? 'Manutenção'),
          occurredAt,
          typeof remote.odometerKm === 'number' ? remote.odometerKm : null,
          workshop,
          laborCents,
          partsCents,
          notes,
          evidenceLevel(remote.evidenceLevel),
          updatedAt,
          remote.deleted ? 1 : 0,
        ],
      );
      await db.runAsync(
        "INSERT OR IGNORE INTO financial_transactions (id, owner_id, vehicle_id, type, category, amount_cents, occurred_at, supplier_or_workshop, odometer_km, notes, source_entity_type, source_entity_id, updated_at, deleted, sync_state) VALUES (?, ?, ?, 'maintenance', 'Manutenção', ?, ?, ?, ?, ?, 'maintenance', ?, ?, ?, 'synced')",
        [
          transactionId,
          userId,
          vehicleId,
          laborCents + partsCents,
          occurredAt,
          workshop,
          typeof remote.odometerKm === 'number' ? remote.odometerKm : null,
          notes,
          snapshot.id,
          updatedAt,
          remote.deleted ? 1 : 0,
        ],
      );
    }
  }

  for (const snapshot of remoteFuelEntries.docs) {
    const remote = snapshot.data();
    const local = fuelById.get(snapshot.id);
    if (!local || isNewer(remote.updatedAt, local.updated_at)) {
      const updatedAt =
        typeof remote.updatedAt === 'string' ? remote.updatedAt : new Date(0).toISOString();
      const transactionId =
        typeof remote.transactionId === 'string'
          ? remote.transactionId
          : `transaction_fuel_${snapshot.id}`;
      const vehicleId = String(remote.vehicleId ?? 'vehicle_primary');
      const occurredAt = String(remote.occurredAt ?? '');
      const totalCents = typeof remote.totalCents === 'number' ? remote.totalCents : 0;
      const station = typeof remote.station === 'string' ? remote.station : null;
      const odometerKm = typeof remote.odometerKm === 'number' ? remote.odometerKm : 0;
      await db.runAsync(
        `INSERT OR REPLACE INTO fuel_entries
          (id, owner_id, vehicle_id, transaction_id, occurred_at, odometer_km, liters, total_cents, fuel_type, station, tank_full, updated_at, deleted, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          snapshot.id,
          userId,
          vehicleId,
          transactionId,
          occurredAt,
          odometerKm,
          typeof remote.liters === 'number' ? remote.liters : 0,
          totalCents,
          String(remote.fuelType ?? 'Combustível'),
          station,
          remote.tankFull ? 1 : 0,
          updatedAt,
          remote.deleted ? 1 : 0,
        ],
      );
      await db.runAsync(
        "INSERT OR IGNORE INTO financial_transactions (id, owner_id, vehicle_id, type, category, amount_cents, occurred_at, supplier_or_workshop, odometer_km, notes, source_entity_type, source_entity_id, updated_at, deleted, sync_state) VALUES (?, ?, ?, 'fuel', 'Combustível', ?, ?, ?, ?, '', 'fuel', ?, ?, ?, 'synced')",
        [
          transactionId,
          userId,
          vehicleId,
          totalCents,
          occurredAt,
          station,
          odometerKm,
          snapshot.id,
          updatedAt,
          remote.deleted ? 1 : 0,
        ],
      );
    }
  }

  for (const snapshot of remoteReminders.docs) {
    const remote = snapshot.data();
    const local = reminderById.get(snapshot.id);
    if (!local || isNewer(remote.updatedAt, local.updated_at)) {
      await db.runAsync(
        `INSERT OR REPLACE INTO reminders
          (id, owner_id, vehicle_id, title, due_date, due_odometer_km, completed, updated_at, deleted, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          snapshot.id,
          userId,
          String(remote.vehicleId ?? 'vehicle_primary'),
          String(remote.title ?? 'Lembrete'),
          typeof remote.dueDate === 'string' ? remote.dueDate : null,
          typeof remote.dueOdometerKm === 'number' ? remote.dueOdometerKm : null,
          remote.completed ? 1 : 0,
          typeof remote.updatedAt === 'string' ? remote.updatedAt : new Date(0).toISOString(),
          remote.deleted ? 1 : 0,
        ],
      );
    }
  }

  for (const snapshot of remoteScans.docs) {
    const remote = snapshot.data();
    const local = scanById.get(snapshot.id);
    const remoteHasRawDiagnostics =
      (typeof remote.rawJson === 'string' && remote.rawJson !== '{}') ||
      (typeof remote.pidBitmapsJson === 'string' && remote.pidBitmapsJson !== '{}');
    if (!local || isNewer(remote.updatedAt, local.updated_at)) {
      await db.runAsync(
        `INSERT OR REPLACE INTO scan_sessions
          (id, owner_id, vehicle_id, captured_at, quality_score, telemetry_json, dtcs_json, raw_json, protocol, adapter_name, supported_pids_json, missing_pids_json, pid_bitmaps_json, dtc_groups_json, segments_json, quality_json, raw_retention_until, updated_at, deleted, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          snapshot.id,
          userId,
          String(remote.vehicleId ?? 'vehicle_primary'),
          String(remote.capturedAt ?? ''),
          typeof remote.qualityScore === 'number' ? remote.qualityScore : 0,
          typeof remote.telemetryJson === 'string' ? remote.telemetryJson : '{}',
          typeof remote.dtcsJson === 'string' ? remote.dtcsJson : '[]',
          '{}',
          typeof remote.protocol === 'string' ? remote.protocol : null,
          typeof remote.adapterName === 'string' ? remote.adapterName : null,
          typeof remote.supportedPidsJson === 'string' ? remote.supportedPidsJson : '[]',
          typeof remote.missingPidsJson === 'string' ? remote.missingPidsJson : '[]',
          '{}',
          typeof remote.dtcGroupsJson === 'string'
            ? remote.dtcGroupsJson
            : '{"stored":[],"pending":[],"permanent":[]}',
          typeof remote.segmentsJson === 'string' ? remote.segmentsJson : '[]',
          typeof remote.qualityJson === 'string' ? remote.qualityJson : '{}',
          null,
          typeof remote.updatedAt === 'string' ? remote.updatedAt : new Date(0).toISOString(),
          remote.deleted ? 1 : 0,
        ],
      );
    }
    // Documentos antigos podem ter respostas brutas da versão anterior. O resumo local
    // é marcado para sobrescrever o documento sem esses campos na próxima gravação.
    if (remoteHasRawDiagnostics) {
      await db.runAsync(
        "UPDATE scan_sessions SET sync_state = 'pending' WHERE id = ? AND owner_id = ?",
        [snapshot.id, userId],
      );
    }
  }

  const pendingVehicles = await db.getAllAsync<StoredVehicle>(
    "SELECT id, model, brand, nickname, year, engine, transmission, fuel, color, plate, vin, odometer_km, updated_at, deleted, sync_state FROM vehicles WHERE owner_id = ? AND sync_state = 'pending'",
    userId,
  );
  const pendingExpenses = await db.getAllAsync<StoredExpense>(
    "SELECT id, vehicle_id, transaction_id, category, amount_cents, occurred_at, supplier, odometer_km, description, updated_at, deleted, sync_state FROM expenses WHERE owner_id = ? AND sync_state = 'pending'",
    userId,
  );

  if (!pendingVehicles.length && !pendingExpenses.length) {
    await syncAdditionalRecords(db, userRef, userId);
    return;
  }

  const batch = writeBatch(firestore);
  for (const vehicle of pendingVehicles) {
    batch.set(doc(userRef, 'vehicles', vehicle.id), {
      model: vehicle.model,
      brand: vehicle.brand,
      nickname: vehicle.nickname,
      year: vehicle.year,
      engine: vehicle.engine,
      transmission: vehicle.transmission,
      fuel: vehicle.fuel,
      color: vehicle.color,
      plate: vehicle.plate,
      vin: vehicle.vin,
      odometerKm: vehicle.odometer_km,
      updatedAt: vehicle.updated_at,
      deleted: Boolean(vehicle.deleted),
    });
  }
  for (const expense of pendingExpenses) {
    batch.set(doc(userRef, 'expenses', expense.id), {
      vehicleId: expense.vehicle_id,
      transactionId: expense.transaction_id,
      category: expense.category,
      amountCents: expense.amount_cents,
      occurredAt: expense.occurred_at,
      supplier: expense.supplier,
      odometerKm: expense.odometer_km,
      description: expense.description,
      updatedAt: expense.updated_at,
      deleted: Boolean(expense.deleted),
    });
  }
  await batch.commit();

  await db.runAsync(
    "UPDATE vehicles SET sync_state = 'synced' WHERE owner_id = ? AND sync_state = 'pending'",
    userId,
  );
  await db.runAsync(
    "UPDATE expenses SET sync_state = 'synced' WHERE owner_id = ? AND sync_state = 'pending'",
    userId,
  );
  await syncAdditionalRecords(db, userRef, userId);
}

async function syncAdditionalRecords(
  db: SQLiteDatabase,
  userRef: ReturnType<typeof doc>,
  userId: string,
) {
  const definitions = [
    {
      table: 'maintenance_events',
      collectionName: 'maintenance',
      fields: [
        'transaction_id',
        'service_type',
        'occurred_at',
        'odometer_km',
        'workshop',
        'labor_cents',
        'parts_cents',
        'notes',
        'evidence_level',
        'updated_at',
        'deleted',
      ],
    },
    {
      table: 'fuel_entries',
      collectionName: 'fuelEntries',
      fields: [
        'transaction_id',
        'occurred_at',
        'odometer_km',
        'liters',
        'total_cents',
        'fuel_type',
        'station',
        'tank_full',
        'updated_at',
        'deleted',
      ],
    },
    {
      table: 'reminders',
      collectionName: 'reminders',
      fields: ['title', 'due_date', 'due_odometer_km', 'completed', 'updated_at', 'deleted'],
    },
    {
      table: 'scan_sessions',
      collectionName: 'scanSessions',
      fields: [
        'captured_at',
        'quality_score',
        'telemetry_json',
        'dtcs_json',
        'protocol',
        'adapter_name',
        'supported_pids_json',
        'missing_pids_json',
        'dtc_groups_json',
        'segments_json',
        'quality_json',
        'updated_at',
        'deleted',
      ],
    },
    {
      table: 'financial_transactions',
      collectionName: 'financialTransactions',
      fields: [
        'type',
        'category',
        'amount_cents',
        'occurred_at',
        'supplier_or_workshop',
        'odometer_km',
        'notes',
        'source_entity_type',
        'source_entity_id',
        'updated_at',
        'deleted',
      ],
    },
    {
      table: 'audit_events',
      collectionName: 'auditEvents',
      fields: ['vehicle_id', 'action', 'entity_type', 'entity_id', 'metadata_json', 'created_at'],
    },
    {
      table: 'consents',
      collectionName: 'consents',
      fields: ['consent_type', 'granted', 'updated_at'],
    },
  ] as const;
  for (const definition of definitions) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM ${definition.table} WHERE owner_id = ? AND sync_state = 'pending'`,
      [userId],
    );
    for (let offset = 0; offset < rows.length; offset += 450) {
      const batch = writeBatch(firestore);
      rows.slice(offset, offset + 450).forEach((row) => {
        const payload: Record<string, unknown> = { vehicleId: row.vehicle_id ?? null };
        definition.fields.forEach((field) => {
          payload[toCamelCase(field)] = row[field];
        });
        batch.set(doc(userRef, definition.collectionName, String(row.id)), payload);
      });
      await batch.commit();
    }
    if (rows.length)
      await db.runAsync(
        `UPDATE ${definition.table} SET sync_state = 'synced' WHERE owner_id = ? AND sync_state = 'pending'`,
        [userId],
      );
  }
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export async function deleteUserData(db: SQLiteDatabase, userId: string) {
  const userRef = doc(firestore, 'users', userId);
  const collectionNames = [
    'vehicles',
    'expenses',
    'financialTransactions',
    'maintenance',
    'fuelEntries',
    'reminders',
    'scanSessions',
    'auditEvents',
    'consents',
  ];
  const snapshots = await Promise.all(
    collectionNames.map((name) => getDocs(collection(userRef, name))),
  );
  const documents = snapshots.flatMap((snapshot) => snapshot.docs);
  for (let index = 0; index < documents.length; index += 450) {
    const batch = writeBatch(firestore);
    documents.slice(index, index + 450).forEach((snapshot) => batch.delete(snapshot.ref));
    await batch.commit();
  }
  await db.runAsync('DELETE FROM vehicles WHERE owner_id = ?', userId);
  await db.runAsync('DELETE FROM expenses WHERE owner_id = ?', userId);
  await db.runAsync('DELETE FROM financial_transactions WHERE owner_id = ?', userId);
  await db.runAsync('DELETE FROM maintenance_events WHERE owner_id = ?', userId);
  await db.runAsync('DELETE FROM fuel_entries WHERE owner_id = ?', userId);
  await db.runAsync('DELETE FROM reminders WHERE owner_id = ?', userId);
  await db.runAsync('DELETE FROM scan_sessions WHERE owner_id = ?', userId);
  await db.runAsync('DELETE FROM audit_events WHERE owner_id = ?', userId);
  await db.runAsync('DELETE FROM consents WHERE owner_id = ?', userId);
}
