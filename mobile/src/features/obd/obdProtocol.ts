import type { ObdDtcGroups } from '../../data/types';

export type EssentialPid = {
  command: string;
  pid: number;
  key: string;
  label: string;
};

export const ESSENTIAL_PIDS: EssentialPid[] = [
  { command: '0104', pid: 0x04, key: 'loadPct', label: 'Carga do motor' },
  { command: '0105', pid: 0x05, key: 'coolantC', label: 'Temperatura do motor' },
  { command: '0106', pid: 0x06, key: 'stftPct', label: 'STFT' },
  { command: '0107', pid: 0x07, key: 'ltftPct', label: 'LTFT' },
  { command: '010B', pid: 0x0b, key: 'mapKpa', label: 'MAP' },
  { command: '010C', pid: 0x0c, key: 'rpm', label: 'RPM' },
  { command: '010D', pid: 0x0d, key: 'speedKph', label: 'Velocidade' },
  { command: '0110', pid: 0x10, key: 'mafGps', label: 'MAF' },
  { command: '0142', pid: 0x42, key: 'voltageV', label: 'Tensão do módulo' },
];

export const PID_DISCOVERY_COMMANDS = ['0100', '0120', '0140'] as const;

const PID_MINIMUM_HEX_LENGTH: Record<string, number> = {
  '04': 2,
  '05': 2,
  '06': 2,
  '07': 2,
  '0B': 2,
  '0C': 4,
  '0D': 2,
  '10': 4,
  '42': 4,
};

export function cleanHex(response: string) {
  return response
    .toUpperCase()
    .replace(/\s/g, '')
    .replace(/[^0-9A-F]/g, '');
}

export function isNoDataResponse(response: string) {
  return /NO DATA|UNABLE TO CONNECT|STOPPED|BUS ERROR/i.test(response);
}

export function isFailedResponse(response: string) {
  return /SEM RESPOSTA|TIMEOUT|\bERROR\b|UNABLE TO CONNECT|BUS ERROR/i.test(response);
}

export function parsePidData(response: string, pid: string) {
  const normalized = cleanHex(response);
  const index = normalized.indexOf(`41${pid}`);
  return index >= 0 ? normalized.slice(index + 4) : null;
}

/**
 * Uma resposta sem timeout ainda pode ser inválida: alguns adaptadores devolvem eco,
 * bytes parciais ou uma resposta destinada a outro PID. Esta verificação é usada pelo
 * score de qualidade para não tratar isso como uma leitura válida.
 */
export function hasValidPidResponse(response: string, pid: string) {
  if (isNoDataResponse(response) || isFailedResponse(response)) return false;
  const payload = parsePidData(response, pid);
  return Boolean(payload && payload.length >= (PID_MINIMUM_HEX_LENGTH[pid] ?? 2));
}

function parseDtcResponse(response: string, modeResponse: string) {
  if (isNoDataResponse(response) || isFailedResponse(response)) return [];
  const normalized = cleanHex(response);
  const start = normalized.indexOf(modeResponse);
  if (start < 0) return [];

  const payload = normalized.slice(start + 2);
  const codes: string[] = [];
  for (let index = 0; index + 3 < payload.length; index += 4) {
    const first = Number.parseInt(payload.slice(index, index + 2), 16);
    const second = Number.parseInt(payload.slice(index + 2, index + 4), 16);
    if (!Number.isFinite(first) || !Number.isFinite(second) || (first === 0 && second === 0)) {
      continue;
    }
    const prefix = ['P', 'C', 'B', 'U'][(first >> 6) & 0b11];
    const digit1 = (first >> 4) & 0b11;
    const digit2 = (first & 0x0f).toString(16).toUpperCase();
    const digit3 = ((second >> 4) & 0x0f).toString(16).toUpperCase();
    const digit4 = (second & 0x0f).toString(16).toUpperCase();
    codes.push(`${prefix}${digit1}${digit2}${digit3}${digit4}`);
  }
  return [...new Set(codes)];
}

export function parseDtcGroups(responses: Record<string, string>): ObdDtcGroups {
  return {
    stored: parseDtcResponse(responses['03'] ?? '', '43'),
    pending: parseDtcResponse(responses['07'] ?? '', '47'),
    permanent: parseDtcResponse(responses['0A'] ?? '', '4A'),
  };
}

export function flattenDtcs(groups: ObdDtcGroups) {
  return [...new Set([...groups.stored, ...groups.pending, ...groups.permanent])];
}

/** Converte o bitmap retornado por 0100/0120/0140 nos PIDs que a ECU declarou suportar. */
export function parseSupportedPidBitmap(response: string, basePid: number) {
  const pid = basePid.toString(16).padStart(2, '0').toUpperCase();
  const payload = parsePidData(response, pid);
  if (!payload || payload.length < 8) return [];

  const bitmap = payload.slice(0, 8);
  const supported: number[] = [];
  for (let offset = 1; offset <= 32; offset += 1) {
    const bitIndex = offset - 1;
    const nibble = Number.parseInt(bitmap[Math.floor(bitIndex / 4)] ?? '0', 16);
    const enabled = (nibble & (1 << (3 - (bitIndex % 4)))) !== 0;
    if (enabled) supported.push(basePid + offset);
  }
  return supported;
}

export function formatPid(pid: number) {
  return `01${pid.toString(16).padStart(2, '0').toUpperCase()}`;
}

export function protocolFromResponse(response: string) {
  const lines = response
    .replace(/>/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^ATDP$/i.test(line));
  const value = lines.join(' ').replace(/^ATDP\s*/i, '').trim();
  return value || null;
}
