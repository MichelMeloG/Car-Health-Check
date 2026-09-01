export type Vehicle = {
  id: string;
  model: string;
  year: number | null;
  odometerKm: number | null;
  updatedAt: string;
  deleted?: boolean;
};

export type Expense = {
  id: string;
  category: string;
  amountCents: number;
  occurredAt: string;
  odometerKm: number | null;
  description: string;
  updatedAt: string;
  deleted?: boolean;
};

export type NewExpense = Omit<Expense, 'id' | 'updatedAt' | 'deleted'>;
export type VehicleInput = Omit<Vehicle, 'id' | 'updatedAt' | 'deleted'>;
