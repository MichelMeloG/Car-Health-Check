import NetInfo from '@react-native-community/netinfo';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../features/auth/AuthProvider';
import { evaluateHealth } from '../features/health/healthRules';
import { logFirstExpenseCreated, logFirstVehicleCreated } from '../services/analytics';
import { purgeExpiredObdRawResponses } from './database';
import { rawDiagnosticRetentionUntil, toExportableScanSession } from './obdRetention';
import { deleteUserData, syncUserData } from './sync';
import type {
  Expense,
  FinancialTransaction,
  FuelEntry,
  HealthFinding,
  MaintenanceEvent,
  NewExpense,
  Reminder,
  ScanSession,
  Vehicle,
  VehicleSummary,
} from './types';

type VehicleInput = Omit<Vehicle, 'id' | 'updatedAt' | 'deleted'>;
type MaintenanceInput = Omit<MaintenanceEvent, 'id' | 'vehicleId' | 'updatedAt'>;
type FuelInput = Omit<FuelEntry, 'id' | 'vehicleId' | 'updatedAt'>;

type AppDataContextValue = {
  expenses: Expense[];
  activeExpenses: Expense[];
  transactions: FinancialTransaction[];
  activeTransactions: FinancialTransaction[];
  vehicles: Vehicle[];
  activeVehicle: Vehicle | null;
  activeVehicleId: string | null;
  vehicleSummaries: VehicleSummary[];
  loading: boolean;
  syncError: string | null;
  maintenance: MaintenanceEvent[];
  fuelEntries: FuelEntry[];
  reminders: Reminder[];
  scanSessions: ScanSession[];
  healthFindings: HealthFinding[];
  addExpense: (expense: NewExpense) => Promise<void>;
  updateExpense: (id: string, expense: NewExpense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addMaintenance: (input: MaintenanceInput) => Promise<void>;
  updateMaintenance: (id: string, input: MaintenanceInput) => Promise<void>;
  addFuelEntry: (input: FuelInput) => Promise<void>;
  updateFuelEntry: (id: string, input: FuelInput) => Promise<void>;
  addReminder: (
    input: Omit<Reminder, 'id' | 'vehicleId' | 'updatedAt' | 'completed'>,
  ) => Promise<void>;
  completeReminder: (id: string) => Promise<void>;
  saveScanSession: (input: Omit<ScanSession, 'id' | 'vehicleId' | 'updatedAt'>) => Promise<string>;
  recordAuditEvent: (
    action: string,
    entityType: string,
    entityId?: string | null,
    metadata?: Record<string, unknown>,
  ) => Promise<void>;
  createVehicle: (vehicle: VehicleInput) => Promise<string>;
  saveVehicle: (vehicle: VehicleInput, vehicleId?: string) => Promise<void>;
  selectVehicle: (vehicleId: string) => Promise<void>;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
  exportData: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
};
type StoredExpense = {
  id: string;
  vehicle_id: string;
  category: string;
  amount_cents: number;
  occurred_at: string;
  supplier: string | null;
  odometer_km: number | null;
  description: string;
  updated_at: string;
  deleted: number;
};
type StoredTransaction = {
  id: string;
  vehicle_id: string;
  type: FinancialTransaction['type'];
  category: string;
  amount_cents: number;
  occurred_at: string;
  supplier_or_workshop: string | null;
  odometer_km: number | null;
  notes: string;
  source_entity_type: FinancialTransaction['sourceEntityType'];
  source_entity_id: string | null;
  updated_at: string;
  deleted: number;
};
type StoredMaintenance = {
  id: string;
  vehicle_id: string;
  service_type: string;
  occurred_at: string;
  odometer_km: number | null;
  workshop: string | null;
  labor_cents: number;
  parts_cents: number;
  notes: string;
  evidence_level: MaintenanceEvent['evidenceLevel'];
  updated_at: string;
};
type StoredFuel = {
  id: string;
  vehicle_id: string;
  occurred_at: string;
  odometer_km: number;
  liters: number;
  total_cents: number;
  fuel_type: string;
  station: string | null;
  tank_full: number;
  updated_at: string;
};
type StoredReminder = {
  id: string;
  vehicle_id: string;
  title: string;
  due_date: string | null;
  due_odometer_km: number | null;
  completed: number;
  updated_at: string;
};
type StoredScan = {
  id: string;
  vehicle_id: string;
  captured_at: string;
  quality_score: number;
  telemetry_json: string;
  dtcs_json: string;
  raw_json: string;
  protocol: string | null;
  adapter_name: string | null;
  supported_pids_json: string;
  missing_pids_json: string;
  pid_bitmaps_json: string;
  dtc_groups_json: string;
  segments_json: string;
  quality_json: string;
  raw_retention_until: string | null;
  updated_at: string;
};

function parseStoredJson<T>(value: string | null | undefined, fallback: T) {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function migrateToMultiVehicle(db: ReturnType<typeof useSQLiteContext>, ownerId: string) {
  const preference = await db.getFirstAsync<{
    active_vehicle_id: string | null;
    multi_vehicle_migrated: number;
  }>('SELECT active_vehicle_id, multi_vehicle_migrated FROM app_preferences WHERE owner_id = ?', [
    ownerId,
  ]);
  if (preference?.multi_vehicle_migrated === 1) return;

  let vehicle = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM vehicles WHERE owner_id = ? AND deleted = 0 ORDER BY updated_at ASC LIMIT 1',
    [ownerId],
  );
  const expenseCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM expenses WHERE owner_id = ? AND deleted = 0 AND (vehicle_id IS NULL OR vehicle_id = '')",
    [ownerId],
  );
  if (!vehicle && (expenseCount?.count ?? 0) > 0) {
    const vehicleId = 'vehicle_primary';
    const timestamp = now();
    await db.runAsync(
      'INSERT OR IGNORE INTO vehicles (id, owner_id, model, year, odometer_km, updated_at, deleted, sync_state) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
      [vehicleId, ownerId, 'Meu veículo', null, null, timestamp, 'pending'],
    );
    vehicle = { id: vehicleId };
  }
  if (vehicle) {
    await db.runAsync(
      "UPDATE expenses SET vehicle_id = ?, sync_state = 'pending', updated_at = ? WHERE owner_id = ? AND (vehicle_id IS NULL OR vehicle_id = '')",
      [vehicle.id, now(), ownerId],
    );
  }
  const activeId = preference?.active_vehicle_id ?? vehicle?.id ?? null;
  await db.runAsync(
    'INSERT OR REPLACE INTO app_preferences (owner_id, active_vehicle_id, multi_vehicle_migrated, updated_at) VALUES (?, ?, 1, ?)',
    [ownerId, activeId, now()],
  );
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { user, logout } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceEvent[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [scanSessions, setScanSessions] = useState<ScanSession[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setExpenses([]);
      setTransactions([]);
      setVehicles([]);
      setMaintenance([]);
      setFuelEntries([]);
      setReminders([]);
      setScanSessions([]);
      setActiveVehicleId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await migrateToMultiVehicle(db, user.uid);
      await purgeExpiredObdRawResponses(db, user.uid);
      const [
        localVehicles,
        localExpenses,
        preference,
        localMaintenance,
        localFuel,
        localReminders,
        localScans,
        localTransactions,
      ] = await Promise.all([
        db.getAllAsync<StoredVehicle>(
          'SELECT id, model, brand, nickname, year, engine, transmission, fuel, color, plate, vin, odometer_km, updated_at, deleted FROM vehicles WHERE owner_id = ? AND deleted = 0 ORDER BY updated_at DESC',
          [user.uid],
        ),
        db.getAllAsync<StoredExpense>(
          'SELECT id, vehicle_id, category, amount_cents, occurred_at, supplier, odometer_km, description, updated_at, deleted FROM expenses WHERE owner_id = ? AND deleted = 0 ORDER BY occurred_at DESC, updated_at DESC',
          [user.uid],
        ),
        db.getFirstAsync<{ active_vehicle_id: string | null }>(
          'SELECT active_vehicle_id FROM app_preferences WHERE owner_id = ?',
          [user.uid],
        ),
        db.getAllAsync<StoredMaintenance>(
          'SELECT id, vehicle_id, service_type, occurred_at, odometer_km, workshop, labor_cents, parts_cents, notes, evidence_level, updated_at FROM maintenance_events WHERE owner_id = ? AND deleted = 0 ORDER BY occurred_at DESC',
          [user.uid],
        ),
        db.getAllAsync<StoredFuel>(
          'SELECT id, vehicle_id, occurred_at, odometer_km, liters, total_cents, fuel_type, station, tank_full, updated_at FROM fuel_entries WHERE owner_id = ? AND deleted = 0 ORDER BY occurred_at DESC',
          [user.uid],
        ),
        db.getAllAsync<StoredReminder>(
          'SELECT id, vehicle_id, title, due_date, due_odometer_km, completed, updated_at FROM reminders WHERE owner_id = ? AND deleted = 0 ORDER BY completed, due_date',
          [user.uid],
        ),
        db.getAllAsync<StoredScan>(
          'SELECT id, vehicle_id, captured_at, quality_score, telemetry_json, dtcs_json, raw_json, protocol, adapter_name, supported_pids_json, missing_pids_json, pid_bitmaps_json, dtc_groups_json, segments_json, quality_json, raw_retention_until, updated_at FROM scan_sessions WHERE owner_id = ? AND deleted = 0 ORDER BY captured_at DESC',
          [user.uid],
        ),
        db.getAllAsync<StoredTransaction>(
          'SELECT id, vehicle_id, type, category, amount_cents, occurred_at, supplier_or_workshop, odometer_km, notes, source_entity_type, source_entity_id, updated_at, deleted FROM financial_transactions WHERE owner_id = ? AND deleted = 0 ORDER BY occurred_at DESC, updated_at DESC',
          [user.uid],
        ),
      ]);
      const mappedVehicles: Vehicle[] = localVehicles.map((v) => ({
        id: v.id,
        model: v.model,
        brand: v.brand ?? undefined,
        nickname: v.nickname ?? undefined,
        year: v.year,
        engine: v.engine ?? undefined,
        transmission: v.transmission ?? undefined,
        fuel: v.fuel ?? undefined,
        color: v.color ?? undefined,
        plate: v.plate ?? undefined,
        vin: v.vin ?? undefined,
        odometerKm: v.odometer_km,
        updatedAt: v.updated_at,
        deleted: Boolean(v.deleted),
      }));
      const mappedExpenses: Expense[] = localExpenses.map((e) => ({
        id: e.id,
        vehicleId: e.vehicle_id,
        category: e.category,
        amountCents: e.amount_cents,
        occurredAt: e.occurred_at,
        supplier: e.supplier ?? undefined,
        odometerKm: e.odometer_km,
        description: e.description,
        updatedAt: e.updated_at,
        deleted: Boolean(e.deleted),
      }));
      const selected = mappedVehicles.some((v) => v.id === preference?.active_vehicle_id)
        ? (preference?.active_vehicle_id ?? null)
        : (mappedVehicles[0]?.id ?? null);
      if (selected !== preference?.active_vehicle_id)
        await db.runAsync(
          'UPDATE app_preferences SET active_vehicle_id = ?, updated_at = ? WHERE owner_id = ?',
          [selected, now(), user.uid],
        );
      setVehicles(mappedVehicles);
      setExpenses(mappedExpenses);
      setTransactions(
        localTransactions.map((transaction) => ({
          id: transaction.id,
          vehicleId: transaction.vehicle_id,
          type: transaction.type,
          category: transaction.category,
          amountCents: transaction.amount_cents,
          occurredAt: transaction.occurred_at,
          supplierOrWorkshop: transaction.supplier_or_workshop ?? '',
          odometerKm: transaction.odometer_km,
          notes: transaction.notes,
          description: transaction.notes,
          sourceEntityType: transaction.source_entity_type,
          sourceEntityId: transaction.source_entity_id,
          updatedAt: transaction.updated_at,
          deleted: Boolean(transaction.deleted),
        })),
      );
      setMaintenance(
        localMaintenance.map((m) => ({
          id: m.id,
          vehicleId: m.vehicle_id,
          serviceType: m.service_type,
          occurredAt: m.occurred_at,
          odometerKm: m.odometer_km,
          workshop: m.workshop ?? '',
          laborCents: m.labor_cents,
          partsCents: m.parts_cents,
          notes: m.notes,
          evidenceLevel: m.evidence_level,
          updatedAt: m.updated_at,
        })),
      );
      setFuelEntries(
        localFuel.map((f) => ({
          id: f.id,
          vehicleId: f.vehicle_id,
          occurredAt: f.occurred_at,
          odometerKm: f.odometer_km,
          liters: f.liters,
          totalCents: f.total_cents,
          fuelType: f.fuel_type,
          station: f.station ?? '',
          tankFull: Boolean(f.tank_full),
          updatedAt: f.updated_at,
        })),
      );
      setReminders(
        localReminders.map((r) => ({
          id: r.id,
          vehicleId: r.vehicle_id,
          title: r.title,
          dueDate: r.due_date,
          dueOdometerKm: r.due_odometer_km,
          completed: Boolean(r.completed),
          updatedAt: r.updated_at,
        })),
      );
      setScanSessions(
        localScans.map((s) => ({
          id: s.id,
          vehicleId: s.vehicle_id,
          capturedAt: s.captured_at,
          qualityScore: s.quality_score,
          telemetry: parseStoredJson<Record<string, number>>(s.telemetry_json, {}),
          dtcs: parseStoredJson<string[]>(s.dtcs_json, []),
          rawResponses: parseStoredJson<Record<string, string>>(s.raw_json, {}),
          protocol: s.protocol,
          adapterName: s.adapter_name,
          supportedPids: parseStoredJson<string[]>(s.supported_pids_json, []),
          missingPids: parseStoredJson<string[]>(s.missing_pids_json, []),
          pidBitmaps: parseStoredJson<Record<string, string>>(s.pid_bitmaps_json, {}),
          dtcGroups: parseStoredJson(s.dtc_groups_json, {
            stored: [],
            pending: [],
            permanent: [],
          }),
          segments: parseStoredJson(s.segments_json, []),
          quality: parseStoredJson(s.quality_json, {
            score: s.quality_score,
            tier: s.quality_score >= 0.75 ? 'good' : s.quality_score >= 0.5 ? 'fair' : 'poor',
            responseRate: 0,
            pidCoverage: 0,
            sampleCount: 1,
            stableIdle: null,
            reasons: [],
          }),
          rawRetentionUntil: s.raw_retention_until,
          updatedAt: s.updated_at,
        })),
      );
      setActiveVehicleId(selected);
    } finally {
      setLoading(false);
    }
  }, [db, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const syncNow = useCallback(async () => {
    if (!user || syncingRef.current) return;
    syncingRef.current = true;
    try {
      setSyncError(null);
      await purgeExpiredObdRawResponses(db, user.uid);
      await syncUserData(db, user.uid);
      await refresh();
    } catch {
      setSyncError(
        'Não foi possível sincronizar agora. Seus dados continuam salvos neste aparelho.',
      );
    } finally {
      syncingRef.current = false;
    }
  }, [db, refresh, user]);

  useEffect(() => {
    if (user) void syncNow();
  }, [syncNow, user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncNow();
    });
    return unsubscribe;
  }, [syncNow, user]);

  const selectVehicle = useCallback(
    async (vehicleId: string) => {
      if (!user || !vehicles.some((vehicle) => vehicle.id === vehicleId)) return;
      await db.runAsync(
        'UPDATE app_preferences SET active_vehicle_id = ?, updated_at = ? WHERE owner_id = ?',
        [vehicleId, now(), user.uid],
      );
      setActiveVehicleId(vehicleId);
    },
    [db, user, vehicles],
  );

  const createVehicle = useCallback(
    async (input: VehicleInput) => {
      if (!user) throw new Error('Faça login para cadastrar um veículo.');
      const vehicleId = id('vehicle');
      const timestamp = now();
      await db.runAsync(
        'INSERT INTO vehicles (id, owner_id, model, brand, nickname, year, engine, transmission, fuel, color, plate, vin, odometer_km, updated_at, deleted, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
        [
          vehicleId,
          user.uid,
          input.model.trim(),
          input.brand?.trim() || null,
          input.nickname?.trim() || null,
          input.year ?? null,
          input.engine?.trim() || null,
          input.transmission?.trim() || null,
          input.fuel?.trim() || null,
          input.color?.trim() || null,
          input.plate?.trim().toUpperCase() || null,
          input.vin?.trim().toUpperCase() || null,
          input.odometerKm ?? null,
          timestamp,
          'pending',
        ],
      );
      if (!activeVehicleId)
        await db.runAsync(
          'UPDATE app_preferences SET active_vehicle_id = ?, updated_at = ? WHERE owner_id = ?',
          [vehicleId, timestamp, user.uid],
        );
      await logFirstVehicleCreated(user.uid);
      await refresh();
      void syncNow();
      return vehicleId;
    },
    [activeVehicleId, db, refresh, syncNow, user],
  );

  const saveVehicle = useCallback(
    async (input: VehicleInput, vehicleId?: string) => {
      if (!user) throw new Error('Faça login para cadastrar um veículo.');
      const targetId = vehicleId ?? activeVehicleId;
      if (!targetId) {
        await createVehicle(input);
        return;
      }
      await db.runAsync(
        "UPDATE vehicles SET model = ?, brand = ?, nickname = ?, year = ?, engine = ?, transmission = ?, fuel = ?, color = ?, plate = ?, vin = ?, odometer_km = ?, updated_at = ?, sync_state = 'pending' WHERE id = ? AND owner_id = ?",
        [
          input.model.trim(),
          input.brand?.trim() || null,
          input.nickname?.trim() || null,
          input.year ?? null,
          input.engine?.trim() || null,
          input.transmission?.trim() || null,
          input.fuel?.trim() || null,
          input.color?.trim() || null,
          input.plate?.trim().toUpperCase() || null,
          input.vin?.trim().toUpperCase() || null,
          input.odometerKm ?? null,
          now(),
          targetId,
          user.uid,
        ],
      );
      await refresh();
      void syncNow();
    },
    [activeVehicleId, createVehicle, db, refresh, syncNow, user],
  );

  const addExpense = useCallback(
    async (input: NewExpense) => {
      if (!user || !activeVehicleId)
        throw new Error('Selecione ou cadastre um veículo antes de adicionar um gasto.');
      const timestamp = now();
      const expenseId = id('expense');
      const transactionId = `transaction_expense_${expenseId}`;
      await db.runAsync(
        'INSERT INTO expenses (id, owner_id, vehicle_id, transaction_id, category, amount_cents, occurred_at, supplier, odometer_km, description, updated_at, deleted, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
        [
          expenseId,
          user.uid,
          activeVehicleId,
          transactionId,
          input.category,
          input.amountCents,
          input.occurredAt,
          input.supplier?.trim() || null,
          input.odometerKm ?? null,
          input.description ?? '',
          timestamp,
          'pending',
        ],
      );
      await db.runAsync(
        "INSERT INTO financial_transactions (id, owner_id, vehicle_id, type, category, amount_cents, occurred_at, supplier_or_workshop, odometer_km, notes, source_entity_type, source_entity_id, updated_at, deleted, sync_state) VALUES (?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, 'expense', ?, ?, 0, 'pending')",
        [
          transactionId,
          user.uid,
          activeVehicleId,
          input.category,
          input.amountCents,
          input.occurredAt,
          input.supplier?.trim() || null,
          input.odometerKm ?? null,
          input.description ?? '',
          expenseId,
          timestamp,
        ],
      );
      await logFirstExpenseCreated(user.uid);
      await refresh();
      void syncNow();
    },
    [activeVehicleId, db, refresh, syncNow, user],
  );

  const updateExpense = useCallback(
    async (expenseId: string, input: NewExpense) => {
      if (!user) throw new Error('Faça login para alterar um lançamento.');
      const timestamp = now();
      await db.runAsync(
        "UPDATE expenses SET category = ?, amount_cents = ?, occurred_at = ?, supplier = ?, odometer_km = ?, description = ?, updated_at = ?, sync_state = 'pending' WHERE id = ? AND owner_id = ?",
        [
          input.category.trim(),
          input.amountCents,
          input.occurredAt,
          input.supplier?.trim() || null,
          input.odometerKm ?? null,
          input.description?.trim() || '',
          timestamp,
          expenseId,
          user.uid,
        ],
      );
      await db.runAsync(
        "UPDATE financial_transactions SET category = ?, amount_cents = ?, occurred_at = ?, supplier_or_workshop = ?, odometer_km = ?, notes = ?, updated_at = ?, sync_state = 'pending' WHERE owner_id = ? AND source_entity_type = 'expense' AND source_entity_id = ?",
        [
          input.category.trim(),
          input.amountCents,
          input.occurredAt,
          input.supplier?.trim() || null,
          input.odometerKm ?? null,
          input.description?.trim() || '',
          timestamp,
          user.uid,
          expenseId,
        ],
      );
      await db.runAsync(
        'INSERT INTO audit_events (id, owner_id, vehicle_id, action, entity_type, entity_id, created_at) SELECT ?, ?, vehicle_id, ?, ?, id, ? FROM expenses WHERE id = ? AND owner_id = ?',
        [id('audit'), user.uid, 'updated', 'expense', timestamp, expenseId, user.uid],
      );
      await refresh();
      void syncNow();
    },
    [db, refresh, syncNow, user],
  );

  const deleteExpense = useCallback(
    async (expenseId: string) => {
      if (user) {
        await db.runAsync(
          "UPDATE expenses SET deleted = 1, updated_at = ?, sync_state = 'pending' WHERE id = ? AND owner_id = ?",
          [now(), expenseId, user.uid],
        );
        await db.runAsync(
          "UPDATE financial_transactions SET deleted = 1, updated_at = ?, sync_state = 'pending' WHERE source_entity_type = 'expense' AND source_entity_id = ? AND owner_id = ?",
          [now(), expenseId, user.uid],
        );
        await refresh();
        void syncNow();
      }
    },
    [db, refresh, syncNow, user],
  );

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      if (!user) return;
      const transaction = await db.getFirstAsync<{
        source_entity_type: string | null;
        source_entity_id: string | null;
      }>(
        'SELECT source_entity_type, source_entity_id FROM financial_transactions WHERE id = ? AND owner_id = ?',
        [transactionId, user.uid],
      );
      const timestamp = now();
      await db.runAsync(
        "UPDATE financial_transactions SET deleted = 1, updated_at = ?, sync_state = 'pending' WHERE id = ? AND owner_id = ?",
        [timestamp, transactionId, user.uid],
      );
      if (transaction?.source_entity_type === 'expense')
        await db.runAsync(
          "UPDATE expenses SET deleted = 1, updated_at = ?, sync_state = 'pending' WHERE id = ? AND owner_id = ?",
          [timestamp, transaction.source_entity_id, user.uid],
        );
      if (transaction?.source_entity_type === 'fuel')
        await db.runAsync(
          "UPDATE fuel_entries SET deleted = 1, updated_at = ?, sync_state = 'pending' WHERE id = ? AND owner_id = ?",
          [timestamp, transaction.source_entity_id, user.uid],
        );
      if (transaction?.source_entity_type === 'maintenance')
        await db.runAsync(
          "UPDATE maintenance_events SET deleted = 1, updated_at = ?, sync_state = 'pending' WHERE id = ? AND owner_id = ?",
          [timestamp, transaction.source_entity_id, user.uid],
        );
      await refresh();
      void syncNow();
    },
    [db, refresh, syncNow, user],
  );

  const addMaintenance = useCallback(
    async (input: MaintenanceInput) => {
      if (!user || !activeVehicleId)
        throw new Error('Selecione um veículo antes de registrar um serviço.');
      const timestamp = now();
      const recordId = id('maintenance');
      const transactionId = `transaction_maintenance_${recordId}`;
      await db.runAsync(
        'INSERT INTO maintenance_events (id, owner_id, vehicle_id, transaction_id, service_type, occurred_at, odometer_km, workshop, labor_cents, parts_cents, notes, evidence_level, updated_at, deleted, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
        [
          recordId,
          user.uid,
          activeVehicleId,
          transactionId,
          input.serviceType,
          input.occurredAt,
          input.odometerKm,
          input.workshop || null,
          input.laborCents,
          input.partsCents,
          input.notes,
          input.evidenceLevel,
          timestamp,
          'pending',
        ],
      );
      await db.runAsync(
        "INSERT INTO financial_transactions (id, owner_id, vehicle_id, type, category, amount_cents, occurred_at, supplier_or_workshop, odometer_km, notes, source_entity_type, source_entity_id, updated_at, deleted, sync_state) VALUES (?, ?, ?, 'maintenance', 'Manutenção', ?, ?, ?, ?, ?, 'maintenance', ?, ?, 0, 'pending')",
        [
          transactionId,
          user.uid,
          activeVehicleId,
          input.laborCents + input.partsCents,
          input.occurredAt,
          input.workshop || null,
          input.odometerKm,
          input.notes,
          recordId,
          timestamp,
        ],
      );
      await db.runAsync(
        'INSERT INTO audit_events (id, owner_id, vehicle_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id('audit'), user.uid, activeVehicleId, 'created', 'maintenance', recordId, timestamp],
      );
      await refresh();
      void syncNow();
    },
    [activeVehicleId, db, refresh, syncNow, user],
  );

  const updateMaintenance = useCallback(
    async (recordId: string, input: MaintenanceInput) => {
      if (!user) throw new Error('Faça login para alterar um serviço.');
      const timestamp = now();
      await db.runAsync(
        "UPDATE maintenance_events SET service_type = ?, occurred_at = ?, odometer_km = ?, workshop = ?, labor_cents = ?, parts_cents = ?, notes = ?, evidence_level = ?, updated_at = ?, sync_state = 'pending' WHERE id = ? AND owner_id = ?",
        [
          input.serviceType.trim(),
          input.occurredAt,
          input.odometerKm ?? null,
          input.workshop.trim() || null,
          input.laborCents,
          input.partsCents,
          input.notes.trim(),
          input.evidenceLevel,
          timestamp,
          recordId,
          user.uid,
        ],
      );
      await db.runAsync(
        "UPDATE financial_transactions SET category = 'Manutenção', amount_cents = ?, occurred_at = ?, supplier_or_workshop = ?, odometer_km = ?, notes = ?, updated_at = ?, sync_state = 'pending' WHERE owner_id = ? AND source_entity_type = 'maintenance' AND source_entity_id = ?",
        [
          input.laborCents + input.partsCents,
          input.occurredAt,
          input.workshop.trim() || null,
          input.odometerKm ?? null,
          input.notes.trim(),
          timestamp,
          user.uid,
          recordId,
        ],
      );
      await db.runAsync(
        'INSERT INTO audit_events (id, owner_id, vehicle_id, action, entity_type, entity_id, created_at) SELECT ?, ?, vehicle_id, ?, ?, id, ? FROM maintenance_events WHERE id = ? AND owner_id = ?',
        [id('audit'), user.uid, 'updated', 'maintenance', timestamp, recordId, user.uid],
      );
      await refresh();
      void syncNow();
    },
    [db, refresh, syncNow, user],
  );

  const addFuelEntry = useCallback(
    async (input: FuelInput) => {
      if (!user || !activeVehicleId)
        throw new Error('Selecione um veículo antes de registrar um abastecimento.');
      const timestamp = now();
      const recordId = id('fuel');
      const transactionId = `transaction_fuel_${recordId}`;
      await db.runAsync(
        'INSERT INTO fuel_entries (id, owner_id, vehicle_id, transaction_id, occurred_at, odometer_km, liters, total_cents, fuel_type, station, tank_full, updated_at, deleted, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
        [
          recordId,
          user.uid,
          activeVehicleId,
          transactionId,
          input.occurredAt,
          input.odometerKm,
          input.liters,
          input.totalCents,
          input.fuelType,
          input.station || null,
          input.tankFull ? 1 : 0,
          timestamp,
          'pending',
        ],
      );
      await db.runAsync(
        "INSERT INTO financial_transactions (id, owner_id, vehicle_id, type, category, amount_cents, occurred_at, supplier_or_workshop, odometer_km, source_entity_type, source_entity_id, updated_at, deleted, sync_state) VALUES (?, ?, ?, 'fuel', 'Combustível', ?, ?, ?, ?, 'fuel', ?, ?, 0, 'pending')",
        [
          transactionId,
          user.uid,
          activeVehicleId,
          input.totalCents,
          input.occurredAt,
          input.station || null,
          input.odometerKm,
          recordId,
          timestamp,
        ],
      );
      await refresh();
      void syncNow();
    },
    [activeVehicleId, db, refresh, syncNow, user],
  );

  const updateFuelEntry = useCallback(
    async (recordId: string, input: FuelInput) => {
      if (!user) throw new Error('Faça login para alterar um abastecimento.');
      const timestamp = now();
      await db.runAsync(
        "UPDATE fuel_entries SET occurred_at = ?, odometer_km = ?, liters = ?, total_cents = ?, fuel_type = ?, station = ?, tank_full = ?, updated_at = ?, sync_state = 'pending' WHERE id = ? AND owner_id = ?",
        [
          input.occurredAt,
          input.odometerKm,
          input.liters,
          input.totalCents,
          input.fuelType.trim(),
          input.station.trim() || null,
          input.tankFull ? 1 : 0,
          timestamp,
          recordId,
          user.uid,
        ],
      );
      await db.runAsync(
        "UPDATE financial_transactions SET category = 'Combustível', amount_cents = ?, occurred_at = ?, supplier_or_workshop = ?, odometer_km = ?, notes = '', updated_at = ?, sync_state = 'pending' WHERE owner_id = ? AND source_entity_type = 'fuel' AND source_entity_id = ?",
        [
          input.totalCents,
          input.occurredAt,
          input.station.trim() || null,
          input.odometerKm,
          timestamp,
          user.uid,
          recordId,
        ],
      );
      await db.runAsync(
        'INSERT INTO audit_events (id, owner_id, vehicle_id, action, entity_type, entity_id, created_at) SELECT ?, ?, vehicle_id, ?, ?, id, ? FROM fuel_entries WHERE id = ? AND owner_id = ?',
        [id('audit'), user.uid, 'updated', 'fuel', timestamp, recordId, user.uid],
      );
      await refresh();
      void syncNow();
    },
    [db, refresh, syncNow, user],
  );

  const addReminder = useCallback(
    async (input: Omit<Reminder, 'id' | 'vehicleId' | 'updatedAt' | 'completed'>) => {
      if (!user || !activeVehicleId)
        throw new Error('Selecione um veículo antes de criar um lembrete.');
      const timestamp = now();
      await db.runAsync(
        'INSERT INTO reminders (id, owner_id, vehicle_id, title, due_date, due_odometer_km, completed, updated_at, deleted, sync_state) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?)',
        [
          id('reminder'),
          user.uid,
          activeVehicleId,
          input.title,
          input.dueDate,
          input.dueOdometerKm,
          timestamp,
          'pending',
        ],
      );
      await refresh();
      void syncNow();
    },
    [activeVehicleId, db, refresh, syncNow, user],
  );

  const completeReminder = useCallback(
    async (reminderId: string) => {
      if (user) {
        await db.runAsync(
          "UPDATE reminders SET completed = 1, updated_at = ?, sync_state = 'pending' WHERE id = ? AND owner_id = ?",
          [now(), reminderId, user.uid],
        );
        await refresh();
        void syncNow();
      }
    },
    [db, refresh, syncNow, user],
  );

  const saveScanSession = useCallback(
    async (input: Omit<ScanSession, 'id' | 'vehicleId' | 'updatedAt'>) => {
      if (!user || !activeVehicleId)
        throw new Error('Selecione um veículo antes de iniciar o check-up.');
      const timestamp = now();
      const recordId = id('scan');
      const retentionUntil = Object.keys(input.rawResponses).length
        ? (input.rawRetentionUntil ?? rawDiagnosticRetentionUntil(input.capturedAt))
        : null;
      await db.runAsync(
        'INSERT INTO scan_sessions (id, owner_id, vehicle_id, captured_at, quality_score, telemetry_json, dtcs_json, raw_json, protocol, adapter_name, supported_pids_json, missing_pids_json, pid_bitmaps_json, dtc_groups_json, segments_json, quality_json, raw_retention_until, updated_at, deleted, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
        [
          recordId,
          user.uid,
          activeVehicleId,
          input.capturedAt,
          input.qualityScore,
          JSON.stringify(input.telemetry),
          JSON.stringify(input.dtcs),
          JSON.stringify(input.rawResponses),
          input.protocol ?? null,
          input.adapterName ?? null,
          JSON.stringify(input.supportedPids ?? []),
          JSON.stringify(input.missingPids ?? []),
          JSON.stringify(input.pidBitmaps ?? {}),
          JSON.stringify(input.dtcGroups ?? { stored: [], pending: [], permanent: [] }),
          JSON.stringify(input.segments ?? []),
          JSON.stringify(input.quality ?? {}),
          retentionUntil,
          timestamp,
          'pending',
        ],
      );
      await db.runAsync(
        'INSERT INTO audit_events (id, owner_id, vehicle_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id('audit'), user.uid, activeVehicleId, 'captured', 'scan', recordId, timestamp],
      );
      await refresh();
      void syncNow();
      return recordId;
    },
    [activeVehicleId, db, refresh, syncNow, user],
  );

  const recordAuditEvent = useCallback(
    async (
      action: string,
      entityType: string,
      entityId: string | null = null,
      metadata: Record<string, unknown> = {},
    ) => {
      if (!user) return;
      const timestamp = now();
      await db.runAsync(
        'INSERT INTO audit_events (id, owner_id, vehicle_id, action, entity_type, entity_id, metadata_json, created_at, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id('audit'),
          user.uid,
          activeVehicleId,
          action,
          entityType,
          entityId,
          JSON.stringify(metadata),
          timestamp,
          'pending',
        ],
      );
      void syncNow();
    },
    [activeVehicleId, db, syncNow, user],
  );

  const exportData = useCallback(async () => {
    if (!user) return;
    const payload = {
      exportedAt: now(),
      vehicles,
      transactions,
      maintenance,
      fuelEntries,
      reminders,
      scanSessions: scanSessions.map(toExportableScanSession),
    };
    const FileSystem = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');
    const path = `${FileSystem.documentDirectory}car-health-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2));
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
  }, [fuelEntries, maintenance, reminders, scanSessions, transactions, user, vehicles]);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    const ownerId = user.uid;
    await deleteUserData(db, ownerId);
    await db.runAsync('DELETE FROM app_preferences WHERE owner_id = ?', [ownerId]);
    const { deleteUser } = await import('firebase/auth');
    await deleteUser(user);
    await logout();
  }, [db, logout, user]);

  const activeVehicle = vehicles.find((vehicle) => vehicle.id === activeVehicleId) ?? null;
  const activeTransactions = activeVehicleId
    ? transactions.filter((transaction) => transaction.vehicleId === activeVehicleId)
    : [];
  const activeExpenses = activeTransactions;
  const vehicleSummaries = vehicles.map((vehicle) => {
    const related = transactions.filter((transaction) => transaction.vehicleId === vehicle.id);
    return {
      vehicle,
      totalCents: related.reduce((total, expense) => total + expense.amountCents, 0),
      expenseCount: related.length,
    };
  });
  const healthFindings = evaluateHealth(
    activeVehicleId ? scanSessions.filter((scan) => scan.vehicleId === activeVehicleId) : [],
  );
  const value = useMemo(
    () => ({
      expenses,
      activeExpenses,
      transactions,
      activeTransactions,
      vehicles,
      activeVehicle,
      activeVehicleId,
      vehicleSummaries,
      loading,
      syncError,
      maintenance,
      fuelEntries,
      reminders,
      scanSessions,
      healthFindings,
      addExpense,
      updateExpense,
      deleteExpense,
      deleteTransaction,
      addMaintenance,
      updateMaintenance,
      addFuelEntry,
      updateFuelEntry,
      addReminder,
      completeReminder,
      saveScanSession,
      recordAuditEvent,
      createVehicle,
      saveVehicle,
      selectVehicle,
      refresh,
      syncNow,
      exportData,
      deleteAccount,
    }),
    [
      activeExpenses,
      activeVehicle,
      activeVehicleId,
      activeTransactions,
      addExpense,
      updateExpense,
      createVehicle,
      deleteAccount,
      deleteExpense,
      deleteTransaction,
      expenses,
      exportData,
      loading,
      refresh,
      saveVehicle,
      selectVehicle,
      syncError,
      syncNow,
      maintenance,
      fuelEntries,
      reminders,
      scanSessions,
      transactions,
      healthFindings,
      addMaintenance,
      updateMaintenance,
      addFuelEntry,
      updateFuelEntry,
      addReminder,
      completeReminder,
      saveScanSession,
      recordAuditEvent,
      vehicleSummaries,
      vehicles,
    ],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider.');
  return context;
}
