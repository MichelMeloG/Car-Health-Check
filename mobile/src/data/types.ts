export type Vehicle = {
  id: string;
  model: string;
  year: number | null;
  odometerKm: number | null;
  updatedAt: string;
  deleted?: boolean;
  brand?: string;
  nickname?: string;
  engine?: string;
  transmission?: string;
  fuel?: string;
  color?: string;
  plate?: string;
  vin?: string;
};

export type Expense = {
  id: string;
  vehicleId: string;
  category: string;
  amountCents: number;
  occurredAt: string;
  supplier?: string;
  odometerKm: number | null;
  description: string;
  updatedAt: string;
  deleted?: boolean;
};

export type FinancialTransaction = {
  id: string;
  vehicleId: string;
  type: 'expense' | 'fuel' | 'maintenance';
  category: string;
  amountCents: number;
  occurredAt: string;
  supplierOrWorkshop: string;
  odometerKm: number | null;
  notes: string;
  description: string;
  sourceEntityType: 'expense' | 'fuel' | 'maintenance' | null;
  sourceEntityId: string | null;
  updatedAt: string;
  deleted?: boolean;
};

export type NewExpense = Omit<Expense, 'id' | 'vehicleId' | 'updatedAt' | 'deleted'>;
export type VehicleInput = Omit<Vehicle, 'id' | 'updatedAt' | 'deleted'>;

export type VehicleSummary = {
  vehicle: Vehicle;
  totalCents: number;
  expenseCount: number;
};

export type MaintenanceEvent = {
  id: string;
  vehicleId: string;
  serviceType: string;
  occurredAt: string;
  odometerKm: number | null;
  workshop: string;
  laborCents: number;
  partsCents: number;
  notes: string;
  evidenceLevel: 'declared' | 'documented' | 'verified' | 'corroborated';
  updatedAt: string;
};
export type FuelEntry = {
  id: string;
  vehicleId: string;
  occurredAt: string;
  odometerKm: number;
  liters: number;
  totalCents: number;
  fuelType: string;
  station: string;
  tankFull: boolean;
  updatedAt: string;
};
export type Reminder = {
  id: string;
  vehicleId: string;
  title: string;
  dueDate: string | null;
  dueOdometerKm: number | null;
  completed: boolean;
  updatedAt: string;
};

export type ObdDtcGroups = {
  stored: string[];
  pending: string[];
  permanent: string[];
};

export type ObdQualityTier = 'good' | 'fair' | 'poor';

export type ObdQuality = {
  score: number;
  tier: ObdQualityTier;
  responseRate: number;
  pidCoverage: number;
  sampleCount: number;
  stableIdle: boolean | null;
  reasons: string[];
};

export type ObdSessionSegment = {
  type: 'quick' | 'warm_idle' | 'controlled_rpm' | 'road';
  startedAt: string;
  completedAt: string;
  durationSec: number;
  sampleCount: number;
  telemetry: Record<string, number>;
  qualityScore: number;
};

export type ScanSession = {
  id: string;
  vehicleId: string;
  capturedAt: string;
  qualityScore: number;
  telemetry: Record<string, number>;
  dtcs: string[];
  rawResponses: Record<string, string>;
  updatedAt: string;
  protocol?: string | null;
  adapterName?: string | null;
  supportedPids?: string[];
  missingPids?: string[];
  pidBitmaps?: Record<string, string>;
  dtcGroups?: ObdDtcGroups;
  quality?: ObdQuality;
  segments?: ObdSessionSegment[];
  rawRetentionUntil?: string | null;
};
export type HealthFinding = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  urgency: 'monitor' | 'soon' | 'now';
  confidence: number;
  evidence: string[];
  nextStep: string;
  limitations: string[];
};
