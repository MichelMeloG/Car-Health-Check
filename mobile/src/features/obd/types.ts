export type ObdDevice = {
  id: string;
  name: string | null;
  rssi: number | null;
};

export type ObdTelemetry = {
  rpm?: number;
  coolantC?: number;
  voltageV?: number;
  stftPct?: number;
  ltftPct?: number;
  mapKpa?: number;
  mafGps?: number;
};

export type ObdSnapshot = {
  capturedAt: string;
  dtcs: string[];
  telemetry: ObdTelemetry;
  rawResponses: Record<string, string>;
};
