import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { useAuth } from '../features/auth/AuthProvider';
import { logFirstExpenseCreated, logFirstVehicleCreated } from '../services/analytics';
import { deleteUserData, syncUserData } from './sync';
import type { Expense, NewExpense, Vehicle, VehicleInput } from './types';

type AppDataContextValue = {
  expenses: Expense[];
  vehicle: Vehicle | null;
  loading: boolean;
  syncError: string | null;
  addExpense: (expense: NewExpense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  saveVehicle: (vehicle: VehicleInput) => Promise<void>;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
  exportData: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setExpenses([]);
      setVehicle(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const expenseRows = await db.getAllAsync<{
        id: string;
        category: string;
        amount_cents: number;
        occurred_at: string;
        odometer_km: number | null;
        description: string;
        updated_at: string;
      }>(
        `SELECT id, category, amount_cents, occurred_at, odometer_km, description, updated_at
         FROM expenses WHERE owner_id = ? AND deleted = 0
         ORDER BY occurred_at DESC, updated_at DESC`,
        user.uid,
      );
      const vehicleRow = await db.getFirstAsync<{
        id: string;
        model: string;
        year: number | null;
        odometer_km: number | null;
        updated_at: string;
      }>(
        `SELECT id, model, year, odometer_km, updated_at
         FROM vehicles WHERE owner_id = ? AND deleted = 0
         ORDER BY updated_at DESC LIMIT 1`,
        user.uid,
      );
      setExpenses(
        expenseRows.map((row) => ({
          id: row.id,
          category: row.category,
          amountCents: row.amount_cents,
          occurredAt: row.occurred_at,
          odometerKm: row.odometer_km,
          description: row.description,
          updatedAt: row.updated_at,
        })),
      );
      setVehicle(
        vehicleRow
          ? {
              id: vehicleRow.id,
              model: vehicleRow.model,
              year: vehicleRow.year,
              odometerKm: vehicleRow.odometer_km,
              updatedAt: vehicleRow.updated_at,
            }
          : null,
      );
    } finally {
      setLoading(false);
    }
  }, [db, user]);

  const syncNow = useCallback(async () => {
    if (!user || syncingRef.current) return;
    syncingRef.current = true;
    try {
      await syncUserData(db, user.uid);
      setSyncError(null);
      await refresh();
    } catch {
      setSyncError('Sem conexão com a nuvem. Os dados serão enviados quando a internet voltar.');
    } finally {
      syncingRef.current = false;
    }
  }, [db, refresh, user]);

  useEffect(() => {
    void refresh();
    void syncNow();
  }, [refresh, syncNow]);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncNow();
    });
  }, [syncNow]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      expenses,
      vehicle,
      loading,
      syncError,
      addExpense: async (expense) => {
        if (!user) throw new Error('Faça login para salvar um gasto.');
        const id = `expense_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await db.runAsync(
          `INSERT INTO expenses
            (id, owner_id, category, amount_cents, occurred_at, odometer_km, description, updated_at, deleted, sync_state)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')`,
          id,
          user.uid,
          expense.category,
          expense.amountCents,
          expense.occurredAt,
          expense.odometerKm,
          expense.description,
          new Date().toISOString(),
        );
        await refresh();
        void logFirstExpenseCreated(user.uid);
        await syncNow();
      },
      deleteExpense: async (id) => {
        if (!user) return;
        await db.runAsync(
          "UPDATE expenses SET deleted = 1, sync_state = 'pending', updated_at = ? WHERE id = ? AND owner_id = ?",
          new Date().toISOString(),
          id,
          user.uid,
        );
        await refresh();
        await syncNow();
      },
      saveVehicle: async (input) => {
        if (!user) throw new Error('Faça login para salvar o veículo.');
        await db.runAsync(
          `INSERT OR REPLACE INTO vehicles
            (id, owner_id, model, year, odometer_km, updated_at, deleted, sync_state)
           VALUES (?, ?, ?, ?, ?, ?, 0, 'pending')`,
          vehicle?.id ?? 'vehicle_primary',
          user.uid,
          input.model,
          input.year,
          input.odometerKm,
          new Date().toISOString(),
        );
        await refresh();
        void logFirstVehicleCreated(user.uid);
        await syncNow();
      },
      exportData: async () => {
        if (!user) throw new Error('Faça login para exportar seus dados.');
        const [vehicleRow, expenseRows] = await Promise.all([
          db.getFirstAsync(
            'SELECT model, year, odometer_km FROM vehicles WHERE owner_id = ? AND deleted = 0 LIMIT 1',
            user.uid,
          ),
          db.getAllAsync(
            'SELECT id, category, amount_cents, occurred_at, odometer_km, description FROM expenses WHERE owner_id = ? AND deleted = 0 ORDER BY occurred_at DESC',
            user.uid,
          ),
        ]);
        if (!FileSystem.cacheDirectory) throw new Error('Cache directory unavailable');
        const path = `${FileSystem.cacheDirectory}car-health-export-${Date.now()}.json`;
        await FileSystem.writeAsStringAsync(
          path,
          JSON.stringify(
            { exportedAt: new Date().toISOString(), vehicle: vehicleRow, expenses: expenseRows },
            null,
            2,
          ),
        );
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, {
            mimeType: 'application/json',
            dialogTitle: 'Exportar dados do Car Health',
          });
        }
      },
      deleteAccount: async () => {
        if (!user) return;
        await deleteUserData(db, user.uid);
        await db.runAsync('DELETE FROM vehicles WHERE owner_id = ?', user.uid);
        await db.runAsync('DELETE FROM expenses WHERE owner_id = ?', user.uid);
        setExpenses([]);
        setVehicle(null);
        const { deleteUser } = await import('firebase/auth');
        const { auth } = await import('../services/firebase');
        if (auth.currentUser) await deleteUser(auth.currentUser);
      },
      refresh,
      syncNow,
    }),
    [db, expenses, loading, refresh, syncError, syncNow, user, vehicle],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}
