import type { ObdQuality, ObdSessionSegment } from '../../data/types';
import {
  ESSENTIAL_PIDS,
  hasValidPidResponse,
  isFailedResponse,
} from './obdProtocol';

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

export function calculateSnapshotQuality(input: {
  rawResponses: Record<string, string>;
  supportedPids: string[];
  protocol: string | null;
}): ObdQuality {
  const telemetryCommands = ESSENTIAL_PIDS.map((item) => item.command).filter(
    (command) => input.rawResponses[command] !== undefined,
  );
  const successfulTelemetry = telemetryCommands.filter((command) =>
    hasValidPidResponse(input.rawResponses[command] ?? '', command.slice(2)),
  );
  const responseRate = telemetryCommands.length
    ? successfulTelemetry.length / telemetryCommands.length
    : 0;
  const supportedEssential = ESSENTIAL_PIDS.filter((item) =>
    input.supportedPids.includes(item.command),
  ).length;
  const pidCoverage = supportedEssential / ESSENTIAL_PIDS.length;
  const diagnosticCommands = ['03', '07', '0A'].filter(
    (command) => input.rawResponses[command] !== undefined,
  );
  const diagnostics = diagnosticCommands.filter((command) => {
    const response = input.rawResponses[command] ?? '';
    return response && !isFailedResponse(response);
  });
  const diagnosticRate = diagnosticCommands.length ? diagnostics.length / diagnosticCommands.length : 1;
  const protocolScore = input.protocol ? 1 : 0;
  const score = round(
    Math.max(0, Math.min(1, responseRate * 0.5 + pidCoverage * 0.3 + diagnosticRate * 0.1 + protocolScore * 0.1)),
  );
  const reasons: string[] = [];
  if (!input.protocol) reasons.push('O protocolo OBD não foi identificado.');
  if (!input.supportedPids.length)
    reasons.push('A ECU não respondeu ao bitmap de PIDs suportados.');
  if (pidCoverage < 0.5)
    reasons.push('Poucos PIDs essenciais foram disponibilizados pela ECU.');
  if (responseRate < 0.75)
    reasons.push('Houve respostas ausentes, parciais ou instáveis durante a coleta.');
  return {
    score,
    tier: score >= 0.75 ? 'good' : score >= 0.5 ? 'fair' : 'poor',
    responseRate: round(responseRate),
    pidCoverage: round(pidCoverage),
    sampleCount: 1,
    stableIdle: null,
    reasons,
  };
}

export function calculateGuidedQuality(
  snapshots: Array<{ quality: ObdQuality; telemetry: Record<string, number>; capturedAt?: string }>,
  segments: ObdSessionSegment[],
): ObdQuality {
  const snapshotScore = average(snapshots.map((snapshot) => snapshot.quality.score));
  const responseRate = average(snapshots.map((snapshot) => snapshot.quality.responseRate));
  const pidCoverage = average(snapshots.map((snapshot) => snapshot.quality.pidCoverage));
  const idle = segments.find((segment) => segment.type === 'warm_idle');
  const idleSnapshots = idle
    ? snapshots.filter((snapshot) => {
        const capturedAt = snapshot.capturedAt;
        if (!capturedAt) return false;
        const timestamp = new Date(capturedAt).getTime();
        return (
          timestamp >= new Date(idle.startedAt).getTime() &&
          timestamp <= new Date(idle.completedAt).getTime()
        );
      })
    : [];
  const idleRpm = idleSnapshots
    .filter((snapshot) => snapshot.telemetry.rpm !== undefined)
    .map((snapshot) => snapshot.telemetry.rpm as number);
  const rpmDeviation = standardDeviation(idleRpm);
  const idleMean = average(idleRpm);
  const stableIdle = idle
    ? idle.sampleCount >= 2 &&
      idleMean >= 550 &&
      idleMean <= 1_200 &&
      (rpmDeviation === null || rpmDeviation <= 150)
    : null;
  const segmentScore = idle ? (idle.sampleCount >= 2 ? 1 : 0.55) : 0;
  const stabilityScore = stableIdle === true ? 1 : stableIdle === false ? 0.45 : 0.6;
  const score = round(
    Math.max(0, Math.min(1, snapshotScore * 0.65 + segmentScore * 0.2 + stabilityScore * 0.15)),
  );
  const reasons = [...new Set(snapshots.flatMap((snapshot) => snapshot.quality.reasons))];
  if (!idle) reasons.push('A etapa de marcha lenta não foi concluída.');
  if (idle && idle.sampleCount < 2)
    reasons.push('A marcha lenta teve poucas amostras para validar estabilidade.');
  if (stableIdle === false)
    reasons.push('A rotação na marcha lenta variou demais ou ficou fora da faixa esperada.');
  return {
    score,
    tier: score >= 0.75 ? 'good' : score >= 0.5 ? 'fair' : 'poor',
    responseRate: round(responseRate),
    pidCoverage: round(pidCoverage),
    sampleCount: snapshots.length,
    stableIdle,
    reasons,
  };
}

export function averageTelemetry(snapshots: Array<{ telemetry: Record<string, number> }>) {
  const buckets = new Map<string, number[]>();
  snapshots.forEach((snapshot) => {
    Object.entries(snapshot.telemetry).forEach(([key, value]) => {
      const values = buckets.get(key) ?? [];
      values.push(value);
      buckets.set(key, values);
    });
  });
  return Object.fromEntries([...buckets.entries()].map(([key, values]) => [key, round(average(values))]));
}
