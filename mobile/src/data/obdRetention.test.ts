import { describe, expect, it } from 'vitest';

import { rawDiagnosticRetentionUntil, toExportableScanSession } from './obdRetention';

describe('retenção de diagnósticos OBD', () => {
  it('define a expiração local em 30 dias a partir da coleta', () => {
    expect(rawDiagnosticRetentionUntil('2026-09-01T10:00:00.000Z')).toBe(
      '2026-10-01T10:00:00.000Z',
    );
  });

  it('remove respostas brutas e bitmaps da exportação padrão', () => {
    const exported = toExportableScanSession({
      id: 'scan_1',
      vehicleId: 'vehicle_1',
      capturedAt: '2026-09-01T10:00:00.000Z',
      qualityScore: 0.8,
      telemetry: { rpm: 800 },
      dtcs: [],
      rawResponses: { '010C': '410C0C80' },
      pidBitmaps: { '0100': '4100BE1FA813' },
      rawRetentionUntil: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:30.000Z',
    });

    expect(exported).not.toHaveProperty('rawResponses');
    expect(exported).not.toHaveProperty('pidBitmaps');
    expect(exported).not.toHaveProperty('rawRetentionUntil');
    expect(exported.telemetry).toEqual({ rpm: 800 });
  });
});
