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
import { AppState } from 'react-native';

import type { ObdDtcGroups, ObdSessionSegment } from '../../data/types';
import { useAppData } from '../../data/AppDataProvider';
import { adapterProfileForName } from './obdCompatibility';
import { averageTelemetry, calculateGuidedQuality } from './obdQuality';
import { flattenDtcs } from './obdProtocol';
import { ObdBleService } from './obdBleService';
import type { ObdDevice, ObdSnapshot } from './types';

type GuidedStage = 'warm_idle' | 'controlled_rpm' | 'road' | 'review' | null;
type ObdStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'reading' | 'guiding';
type GuidedDraft = {
  startedAt: string;
  samples: ObdSnapshot[];
  segments: ObdSessionSegment[];
};

type ObdContextValue = {
  devices: ObdDevice[];
  connectedDevice: ObdDevice | null;
  lastSnapshot: ObdSnapshot | null;
  lastSessionId: string | null;
  status: ObdStatus;
  error: string | null;
  guidedStage: GuidedStage;
  guidedProgress: number;
  guidedSegments: ObdSessionSegment[];
  scan: () => Promise<void>;
  connect: (device: ObdDevice) => Promise<void>;
  runCheck: () => Promise<void>;
  startGuidedCheck: () => Promise<void>;
  collectControlledRpm: () => Promise<void>;
  collectRoadSegment: () => Promise<void>;
  finishGuidedCheck: () => Promise<string>;
  discardGuidedCheck: () => void;
  disconnect: () => Promise<void>;
  clearDtcs: () => Promise<void>;
};

const ObdContext = createContext<ObdContextValue | null>(null);
const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function mergeDtcGroups(snapshots: ObdSnapshot[]): ObdDtcGroups {
  const group = (key: keyof ObdDtcGroups) => [
    ...new Set(snapshots.flatMap((snapshot) => snapshot.dtcGroups[key])),
  ];
  return { stored: group('stored'), pending: group('pending'), permanent: group('permanent') };
}

function mergeRawResponses(snapshots: ObdSnapshot[], segments: ObdSessionSegment[]) {
  const raw: Record<string, string> = {};
  snapshots.forEach((snapshot, index) => {
    const segment = segments.find((item) => {
      const timestamp = new Date(snapshot.capturedAt).getTime();
      return (
        timestamp >= new Date(item.startedAt).getTime() &&
        timestamp <= new Date(item.completedAt).getTime()
      );
    });
    Object.entries(snapshot.rawResponses).forEach(([command, response]) => {
      raw[`${segment?.type ?? 'sample'}:${index + 1}:${command}`] = response;
    });
  });
  return raw;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function ObdProvider({ children }: PropsWithChildren) {
  const { saveScanSession, recordAuditEvent } = useAppData();
  const serviceRef = useRef<ObdBleService | null>(null);
  const draftRef = useRef<GuidedDraft | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const [devices, setDevices] = useState<ObdDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<ObdDevice | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<ObdSnapshot | null>(null);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<ObdStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [guidedStage, setGuidedStage] = useState<GuidedStage>(null);
  const [guidedProgress, setGuidedProgress] = useState(0);
  const [guidedSegments, setGuidedSegments] = useState<ObdSessionSegment[]>([]);

  const getService = useCallback(() => {
    if (!serviceRef.current) {
      try {
        serviceRef.current = new ObdBleService();
      } catch {
        throw new Error(
          'A leitura OBD precisa do Development Build do Car Health; ela não funciona no Expo Go.',
        );
      }
    }
    return serviceRef.current;
  }, []);

  useEffect(
    () => () => {
      serviceRef.current?.destroy();
    },
    [],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  const resetGuidedDraft = useCallback(() => {
    draftRef.current = null;
    setGuidedStage(null);
    setGuidedProgress(0);
    setGuidedSegments([]);
  }, []);

  const scan = useCallback(async () => {
    setError(null);
    setDevices([]);
    setStatus('scanning');
    try {
      await getService().scan((device) => {
        setDevices((current) =>
          current.some((item) => item.id === device.id) ? current : [...current, device],
        );
      });
      setTimeout(() => setStatus((current) => (current === 'scanning' ? 'idle' : current)), 12_100);
    } catch (cause) {
      setStatus('idle');
      setError(cause instanceof Error ? cause.message : 'Não foi possível procurar adaptadores.');
    }
  }, [getService]);

  const connect = useCallback(
    async (device: ObdDevice) => {
      setError(null);
      setStatus('connecting');
      resetGuidedDraft();
      try {
        await getService().connect(device.id);
        setConnectedDevice(device);
        setStatus('connected');
      } catch (cause) {
        setStatus('idle');
        setError(
          cause instanceof Error ? cause.message : 'Não foi possível conectar ao adaptador.',
        );
      }
    },
    [getService, resetGuidedDraft],
  );

  const runCheck = useCallback(async () => {
    setError(null);
    setStatus('reading');
    try {
      const snapshot = await getService().runSnapshot({ includeDtcs: true });
      const sessionId = await saveScanSession({
        ...snapshot,
        qualityScore: snapshot.quality.score,
        adapterName: connectedDevice?.name ?? null,
        segments: [
          {
            type: 'quick',
            startedAt: snapshot.capturedAt,
            completedAt: snapshot.capturedAt,
            durationSec: 0,
            sampleCount: 1,
            telemetry: snapshot.telemetry,
            qualityScore: snapshot.quality.score,
          },
        ],
      });
      setLastSnapshot(snapshot);
      setLastSessionId(sessionId);
      setStatus('connected');
    } catch (cause) {
      setStatus('connected');
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível ler os dados do veículo.',
      );
    }
  }, [connectedDevice?.name, getService, saveScanSession]);

  const collectSegment = useCallback(
    async (type: Exclude<GuidedStage, 'review' | null>, durationSec: number) => {
      const draft = draftRef.current;
      if (!draft) throw new Error('Inicie a sessão guiada pela marcha lenta.');
      setError(null);
      setStatus('guiding');
      setGuidedStage(type);
      setGuidedProgress(0);
      const startedAt = new Date().toISOString();
      const startMilliseconds = Date.now();
      const samples: ObdSnapshot[] = [];
      try {
        do {
          if (type === 'road' && appStateRef.current && appStateRef.current !== 'active') {
            throw new Error(
              'A coleta de percurso foi interrompida porque o app saiu de primeiro plano.',
            );
          }
          const snapshot = await getService().runSnapshot({
            includeDtcs: draft.samples.length === 0,
          });
          samples.push(snapshot);
          setLastSnapshot(snapshot);
          setGuidedProgress(Math.min(100, Math.round(((Date.now() - startMilliseconds) / (durationSec * 1_000)) * 100)));
          const remaining = durationSec * 1_000 - (Date.now() - startMilliseconds);
          if (remaining > 0) await wait(Math.min(5_000, remaining));
        } while (Date.now() - startMilliseconds < durationSec * 1_000);

        const completedAt = new Date().toISOString();
        const score =
          samples.reduce((total, sample) => total + sample.quality.score, 0) / samples.length;
        const segment: ObdSessionSegment = {
          type,
          startedAt,
          completedAt,
          durationSec: Math.max(1, Math.round((Date.now() - startMilliseconds) / 1_000)),
          sampleCount: samples.length,
          telemetry: averageTelemetry(
            samples.map((sample) => ({ telemetry: sample.telemetry as Record<string, number> })),
          ),
          qualityScore: Math.round(score * 100) / 100,
        };
        draft.samples.push(...samples);
        draft.segments = [...draft.segments.filter((item) => item.type !== type), segment];
        setGuidedSegments(draft.segments);
        setGuidedStage('review');
        setGuidedProgress(100);
        setStatus('connected');
      } catch (cause) {
        setStatus('connected');
        setGuidedStage('review');
        setError(cause instanceof Error ? cause.message : 'A etapa guiada não pôde ser concluída.');
      }
    },
    [getService],
  );

  const startGuidedCheck = useCallback(async () => {
    if (!connectedDevice) throw new Error('Conecte um adaptador antes de iniciar a sessão guiada.');
    resetGuidedDraft();
    draftRef.current = { startedAt: new Date().toISOString(), samples: [], segments: [] };
    await collectSegment('warm_idle', 30);
  }, [collectSegment, connectedDevice, resetGuidedDraft]);

  const collectControlledRpm = useCallback(async () => {
    if (!draftRef.current) throw new Error('Inicie a sessão guiada pela marcha lenta.');
    await collectSegment('controlled_rpm', 10);
  }, [collectSegment]);

  const collectRoadSegment = useCallback(async () => {
    if (!draftRef.current) throw new Error('Inicie a sessão guiada pela marcha lenta.');
    await collectSegment('road', 60);
  }, [collectSegment]);

  const finishGuidedCheck = useCallback(async () => {
    const draft = draftRef.current;
    if (!draft || !draft.samples.length || !draft.segments.length) {
      throw new Error('Conclua pelo menos a etapa de marcha lenta antes de salvar.');
    }
    const latest = draft.samples[draft.samples.length - 1];
    const quality = calculateGuidedQuality(
      draft.samples.map((sample) => ({
        quality: sample.quality,
        telemetry: sample.telemetry as Record<string, number>,
        capturedAt: sample.capturedAt,
      })),
      draft.segments,
    );
    const dtcGroups = mergeDtcGroups(draft.samples);
    const report: ObdSnapshot = {
      capturedAt: draft.startedAt,
      dtcs: flattenDtcs(dtcGroups),
      dtcGroups,
      telemetry: averageTelemetry(
        draft.samples.map((sample) => ({ telemetry: sample.telemetry as Record<string, number> })),
      ),
      rawResponses: mergeRawResponses(draft.samples, draft.segments),
      protocol: latest.protocol,
      supportedPids: unique(draft.samples.flatMap((sample) => sample.supportedPids)),
      missingPids: unique(latest.missingPids),
      pidBitmaps: latest.pidBitmaps,
      quality,
    };
    const sessionId = await saveScanSession({
      ...report,
      qualityScore: quality.score,
      adapterName: connectedDevice?.name ?? null,
      segments: draft.segments,
    });
    setLastSnapshot(report);
    setLastSessionId(sessionId);
    resetGuidedDraft();
    return sessionId;
  }, [connectedDevice?.name, resetGuidedDraft, saveScanSession]);

  const disconnect = useCallback(async () => {
    await getService().disconnect();
    setConnectedDevice(null);
    resetGuidedDraft();
    setStatus('idle');
  }, [getService, resetGuidedDraft]);

  const clearDtcs = useCallback(async () => {
    if (!connectedDevice) throw new Error('Conecte um adaptador antes de limpar códigos.');
    await getService().clearDiagnosticTroubleCodes();
    await recordAuditEvent('clear_dtcs', 'obd_dtc', null, {
      adapterProfile: adapterProfileForName(connectedDevice.name),
      protocol: lastSnapshot?.protocol ?? null,
      storedDtcCount: lastSnapshot?.dtcGroups.stored.length ?? 0,
      pendingDtcCount: lastSnapshot?.dtcGroups.pending.length ?? 0,
      permanentDtcCount: lastSnapshot?.dtcGroups.permanent.length ?? 0,
    });
  }, [connectedDevice, getService, lastSnapshot, recordAuditEvent]);

  const value = useMemo(
    () => ({
      devices,
      connectedDevice,
      lastSnapshot,
      lastSessionId,
      status,
      error,
      guidedStage,
      guidedProgress,
      guidedSegments,
      scan,
      connect,
      runCheck,
      startGuidedCheck,
      collectControlledRpm,
      collectRoadSegment,
      finishGuidedCheck,
      discardGuidedCheck: resetGuidedDraft,
      disconnect,
      clearDtcs,
    }),
    [
      clearDtcs,
      collectControlledRpm,
      collectRoadSegment,
      connect,
      connectedDevice,
      devices,
      disconnect,
      error,
      finishGuidedCheck,
      guidedProgress,
      guidedSegments,
      guidedStage,
      lastSessionId,
      lastSnapshot,
      resetGuidedDraft,
      runCheck,
      scan,
      startGuidedCheck,
      status,
    ],
  );

  return <ObdContext.Provider value={value}>{children}</ObdContext.Provider>;
}

export function useObd() {
  const context = useContext(ObdContext);
  if (!context) throw new Error('useObd must be used inside ObdProvider');
  return context;
}
