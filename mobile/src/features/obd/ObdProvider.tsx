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

import { ObdBleService } from './obdBleService';
import type { ObdDevice, ObdSnapshot } from './types';

type ObdContextValue = {
  devices: ObdDevice[];
  connectedDevice: ObdDevice | null;
  lastSnapshot: ObdSnapshot | null;
  status: 'idle' | 'scanning' | 'connecting' | 'connected' | 'reading';
  error: string | null;
  scan: () => Promise<void>;
  connect: (device: ObdDevice) => Promise<void>;
  runCheck: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const ObdContext = createContext<ObdContextValue | null>(null);

export function ObdProvider({ children }: PropsWithChildren) {
  const serviceRef = useRef<ObdBleService | null>(null);
  const [devices, setDevices] = useState<ObdDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<ObdDevice | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<ObdSnapshot | null>(null);
  const [status, setStatus] = useState<ObdContextValue['status']>('idle');
  const [error, setError] = useState<string | null>(null);

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
    [getService],
  );

  const runCheck = useCallback(async () => {
    setError(null);
    setStatus('reading');
    try {
      setLastSnapshot(await getService().runSnapshot());
      setStatus('connected');
    } catch (cause) {
      setStatus('connected');
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível ler os dados do veículo.',
      );
    }
  }, [getService]);

  const disconnect = useCallback(async () => {
    await getService().disconnect();
    setConnectedDevice(null);
    setStatus('idle');
  }, [getService]);

  const value = useMemo(
    () => ({
      devices,
      connectedDevice,
      lastSnapshot,
      status,
      error,
      scan,
      connect,
      runCheck,
      disconnect,
    }),
    [connectedDevice, connect, devices, disconnect, error, lastSnapshot, runCheck, scan, status],
  );

  return <ObdContext.Provider value={value}>{children}</ObdContext.Provider>;
}

export function useObd() {
  const context = useContext(ObdContext);
  if (!context) throw new Error('useObd must be used inside ObdProvider');
  return context;
}
