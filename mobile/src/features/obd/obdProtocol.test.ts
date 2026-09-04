import { describe, expect, it } from 'vitest';

import { calculateGuidedQuality, calculateSnapshotQuality } from './obdQuality';
import {
  ESSENTIAL_PIDS,
  parseDtcGroups,
  parseSupportedPidBitmap,
  protocolFromResponse,
} from './obdProtocol';

describe('protocolo OBD-II', () => {
  it('interpreta os bitmaps 0100 e 0140 sem assumir que todo PID existe', () => {
    expect(parseSupportedPidBitmap('41 00 18 19 80 01', 0)).toEqual([
      4,
      5,
      12,
      13,
      16,
      17,
      32,
    ]);
    expect(parseSupportedPidBitmap('41 40 40 00 00 00', 0x40)).toEqual([0x42]);
  });

  it('separa DTCs armazenados, pendentes e permanentes', () => {
    expect(
      parseDtcGroups({
        '03': '43 01 71 00 00',
        '07': '47 04 20 00 00',
        '0A': '4A 03 00 00 00',
      }),
    ).toEqual({ stored: ['P0171'], pending: ['P0420'], permanent: ['P0300'] });
  });

  it('limpa a resposta de protocolo do ELM327', () => {
    expect(protocolFromResponse('AUTO, ISO 15765-4 (CAN 11/500)\r>')).toBe(
      'AUTO, ISO 15765-4 (CAN 11/500)',
    );
  });
});

describe('qualidade de leitura OBD-II', () => {
  it('considera cobertura de PID, respostas e protocolo', () => {
    const rawResponses = Object.fromEntries(
      ESSENTIAL_PIDS.map((item) => [item.command, `41 ${item.command.slice(2)} 00 00`]),
    );
    rawResponses['03'] = '43 00 00';
    rawResponses['07'] = '47 00 00';
    rawResponses['0A'] = '4A 00 00';
    const quality = calculateSnapshotQuality({
      rawResponses,
      supportedPids: ESSENTIAL_PIDS.map((item) => item.command),
      protocol: 'ISO 15765-4',
    });
    expect(quality.score).toBe(1);
    expect(quality.tier).toBe('good');
  });

  it('não considera uma resposta de outro PID como telemetria válida', () => {
    const quality = calculateSnapshotQuality({
      rawResponses: {
        '010C': '41 00 00 00',
        '03': '43 00 00',
        '07': '47 00 00',
        '0A': '4A 00 00',
      },
      supportedPids: ['010C'],
      protocol: 'ISO 15765-4',
    });
    expect(quality.responseRate).toBe(0);
    expect(quality.tier).not.toBe('good');
  });

  it('reduz a confiança quando a marcha lenta é instável', () => {
    const snapshotQuality = {
      score: 0.9,
      tier: 'good' as const,
      responseRate: 0.9,
      pidCoverage: 0.9,
      sampleCount: 1,
      stableIdle: null,
      reasons: [],
    };
    const quality = calculateGuidedQuality(
      [
        { capturedAt: '2026-09-04T10:00:00.000Z', quality: snapshotQuality, telemetry: { rpm: 650 } },
        { capturedAt: '2026-09-04T10:00:05.000Z', quality: snapshotQuality, telemetry: { rpm: 1_450 } },
      ],
      [
        {
          type: 'warm_idle',
          startedAt: '2026-09-04T10:00:00.000Z',
          completedAt: '2026-09-04T10:00:30.000Z',
          durationSec: 30,
          sampleCount: 2,
          telemetry: { rpm: 1_050 },
          qualityScore: 0.9,
        },
      ],
    );
    expect(quality.stableIdle).toBe(false);
    expect(quality.reasons).toContain('A rotação na marcha lenta variou demais ou ficou fora da faixa esperada.');
  });
});
