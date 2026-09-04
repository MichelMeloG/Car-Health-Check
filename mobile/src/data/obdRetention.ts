import type { ScanSession } from './types';

/**
 * Respostas ELM327 são úteis para depurar uma sessão, mas não são necessárias para
 * o relatório do usuário. Elas permanecem somente no aparelho por este período.
 */
export const RAW_OBD_RETENTION_DAYS = 30;

export function rawDiagnosticRetentionUntil(capturedAt: string) {
  const date = new Date(capturedAt);
  const base = Number.isNaN(date.getTime()) ? new Date() : date;
  base.setUTCDate(base.getUTCDate() + RAW_OBD_RETENTION_DAYS);
  return base.toISOString();
}

export type ExportableScanSession = Omit<
  ScanSession,
  'rawResponses' | 'pidBitmaps' | 'rawRetentionUntil'
>;

/** A exportação padrão contém o relatório estruturado, nunca bytes/respostas brutas. */
export function toExportableScanSession(scan: ScanSession): ExportableScanSession {
  return {
    id: scan.id,
    vehicleId: scan.vehicleId,
    capturedAt: scan.capturedAt,
    qualityScore: scan.qualityScore,
    telemetry: scan.telemetry,
    dtcs: scan.dtcs,
    updatedAt: scan.updatedAt,
    protocol: scan.protocol,
    adapterName: scan.adapterName,
    supportedPids: scan.supportedPids,
    missingPids: scan.missingPids,
    dtcGroups: scan.dtcGroups,
    quality: scan.quality,
    segments: scan.segments,
  };
}
