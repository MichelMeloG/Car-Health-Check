import type { SQLiteDatabase } from 'expo-sqlite';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';

import { firestore } from '../services/firebase';

type StoredExpense = {
  id: string;
  category: string;
  amount_cents: number;
  occurred_at: string;
  odometer_km: number | null;
  description: string;
  updated_at: string;
  deleted: number;
  sync_state: string;
};

type StoredVehicle = {
  id: string;
  model: string;
  year: number | null;
  odometer_km: number | null;
  updated_at: string;
  deleted: number;
  sync_state: string;
};

function isNewer(remote: unknown, local: string) {
  return typeof remote === 'string' && remote > local;
}

/** Last-write-wins por updatedAt. IDs locais estáveis tornam retries idempotentes. */
export async function syncUserData(db: SQLiteDatabase, userId: string) {
  const userRef = doc(firestore, 'users', userId);
  const [remoteVehicles, remoteExpenses] = await Promise.all([
    getDocs(collection(userRef, 'vehicles')),
    getDocs(collection(userRef, 'expenses')),
  ]);

  const localVehicles = await db.getAllAsync<StoredVehicle>(
    'SELECT id, model, year, odometer_km, updated_at, deleted, sync_state FROM vehicles WHERE owner_id = ?',
    userId,
  );
  const localExpenses = await db.getAllAsync<StoredExpense>(
    'SELECT id, category, amount_cents, occurred_at, odometer_km, description, updated_at, deleted, sync_state FROM expenses WHERE owner_id = ?',
    userId,
  );
  const vehicleById = new Map(localVehicles.map((item) => [item.id, item]));
  const expenseById = new Map(localExpenses.map((item) => [item.id, item]));

  for (const snapshot of remoteVehicles.docs) {
    const remote = snapshot.data();
    const local = vehicleById.get(snapshot.id);
    if (!local || isNewer(remote.updatedAt, local.updated_at)) {
      await db.runAsync(
        `INSERT OR REPLACE INTO vehicles
          (id, owner_id, model, year, odometer_km, updated_at, deleted, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')`,
        snapshot.id,
        userId,
        String(remote.model ?? ''),
        typeof remote.year === 'number' ? remote.year : null,
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
          (id, owner_id, category, amount_cents, occurred_at, odometer_km, description, updated_at, deleted, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        snapshot.id,
        userId,
        String(remote.category ?? ''),
        typeof remote.amountCents === 'number' ? remote.amountCents : 0,
        String(remote.occurredAt ?? ''),
        typeof remote.odometerKm === 'number' ? remote.odometerKm : null,
        String(remote.description ?? ''),
        typeof remote.updatedAt === 'string' ? remote.updatedAt : new Date(0).toISOString(),
        remote.deleted ? 1 : 0,
      );
    }
  }

  const pendingVehicles = await db.getAllAsync<StoredVehicle>(
    "SELECT id, model, year, odometer_km, updated_at, deleted, sync_state FROM vehicles WHERE owner_id = ? AND sync_state = 'pending'",
    userId,
  );
  const pendingExpenses = await db.getAllAsync<StoredExpense>(
    "SELECT id, category, amount_cents, occurred_at, odometer_km, description, updated_at, deleted, sync_state FROM expenses WHERE owner_id = ? AND sync_state = 'pending'",
    userId,
  );

  if (!pendingVehicles.length && !pendingExpenses.length) return;

  const batch = writeBatch(firestore);
  for (const vehicle of pendingVehicles) {
    batch.set(doc(userRef, 'vehicles', vehicle.id), {
      model: vehicle.model,
      year: vehicle.year,
      odometerKm: vehicle.odometer_km,
      updatedAt: vehicle.updated_at,
      deleted: Boolean(vehicle.deleted),
    });
  }
  for (const expense of pendingExpenses) {
    batch.set(doc(userRef, 'expenses', expense.id), {
      category: expense.category,
      amountCents: expense.amount_cents,
      occurredAt: expense.occurred_at,
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
}

export async function deleteUserData(db: SQLiteDatabase, userId: string) {
  const userRef = doc(firestore, 'users', userId);
  const [vehicles, expenses] = await Promise.all([
    getDocs(collection(userRef, 'vehicles')),
    getDocs(collection(userRef, 'expenses')),
  ]);
  const documents = [...vehicles.docs, ...expenses.docs];
  for (let index = 0; index < documents.length; index += 450) {
    const batch = writeBatch(firestore);
    documents.slice(index, index + 450).forEach((snapshot) => batch.delete(snapshot.ref));
    await batch.commit();
  }
  await db.runAsync('DELETE FROM vehicles WHERE owner_id = ?', userId);
  await db.runAsync('DELETE FROM expenses WHERE owner_id = ?', userId);
}
