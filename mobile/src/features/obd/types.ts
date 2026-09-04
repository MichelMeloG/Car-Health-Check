import type { ObdDtcGroups, ObdQuality } from '../../data/types';

export type ObdDevice = {
  id: string;
  name: string | null;
  rssi: number | null;
};

export type ObdTelemetry = {
  loadPct?: number;
  rpm?: number;
  coolantC?: number;
  voltageV?: number;
  stftPct?: number;
  ltftPct?: number;
  mapKpa?: number;
  mafGps?: number;
  speedKph?: number;
};

export type ObdSnapshot = {
  capturedAt: string;
  dtcs: string[];
  dtcGroups: ObdDtcGroups;
  telemetry: ObdTelemetry;
  rawResponses: Record<string, string>;
  protocol: string | null;
  supportedPids: string[];
  missingPids: string[];
  pidBitmaps: Record<string, string>;
  quality: ObdQuality;
};
