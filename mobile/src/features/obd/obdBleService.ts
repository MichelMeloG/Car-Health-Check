import { decode as decodeBase64, encode as encodeBase64 } from 'base-64';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  BleManager,
  type Characteristic,
  type Device,
  type Subscription,
} from 'react-native-ble-plx';

import type { ObdDevice, ObdSnapshot, ObdTelemetry } from './types';

const ELM_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const ELM_CHARACTERISTIC_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
const DEFAULT_TIMEOUT_MS = 4_000;

type Endpoint = { serviceUuid: string; writeUuid: string; notifyUuid: string };

function cleanHex(response: string) {
  return response
    .toUpperCase()
    .replace(/\s/g, '')
    .replace(/[^0-9A-F]/g, '');
}

function parsePid(response: string, pid: string) {
  const normalized = cleanHex(response);
  const index = normalized.indexOf(`41${pid}`);
  return index >= 0 ? normalized.slice(index + 4) : null;
}

function parseDtcs(response: string) {
  const normalized = cleanHex(response);
  const start = normalized.indexOf('43');
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

export class ObdBleService {
  private readonly manager = new BleManager();
  private device: Device | null = null;
  private endpoint: Endpoint | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private notificationSubscription: Subscription | null = null;
  private pendingResponse: {
    resolve: (response: string) => void;
    reject: (reason: Error) => void;
    buffer: string;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  async requestPermissions() {
    if (Platform.OS !== 'android') return true;

    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return (
        result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
        result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
      );
    }

    return (
      (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)) ===
      PermissionsAndroid.RESULTS.GRANTED
    );
  }

  async scan(onDevice: (device: ObdDevice) => void, durationMs = 12_000) {
    if (!(await this.requestPermissions())) {
      throw new Error('Permissões de Bluetooth não foram concedidas.');
    }
    if ((await this.manager.state()) !== 'PoweredOn') {
      throw new Error('Ative o Bluetooth para procurar o adaptador OBD-II.');
    }

    const found = new Set<string>();
    await this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        void this.stopScan();
        return;
      }
      if (!device || found.has(device.id)) return;

      const name = device.name ?? device.localName;
      const upperName = name?.toUpperCase() ?? '';
      if (
        upperName.includes('OBD') ||
        upperName.includes('ELM') ||
        upperName.includes('VLINK') ||
        upperName.includes('V-GATE')
      ) {
        found.add(device.id);
        onDevice({ id: device.id, name, rssi: device.rssi });
      }
    });

    this.scanTimer = setTimeout(() => void this.stopScan(), durationMs);
  }

  async stopScan() {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = null;
    await this.manager.stopDeviceScan();
  }

  async connect(deviceId: string) {
    await this.stopScan();
    await this.disconnect();
    const device = await this.manager.connectToDevice(deviceId, { timeout: 12_000 });
    await device.discoverAllServicesAndCharacteristics();
    this.device = device;
    this.endpoint = await this.resolveEndpoint(device);
    this.subscribeToResponses();

    for (const command of ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0']) {
      await this.command(command, command === 'ATZ' ? 5_000 : DEFAULT_TIMEOUT_MS);
    }
  }

  async runSnapshot(): Promise<ObdSnapshot> {
    this.ensureConnected();
    const commands = ['03', '010C', '0105', '0142', '0106', '0107', '010B', '0110'] as const;
    const rawResponses: Record<string, string> = {};
    for (const command of commands) {
      rawResponses[command] = await this.command(command).catch((error: Error) => error.message);
    }

    const telemetry: ObdTelemetry = {};
    const rpm = parsePid(rawResponses['010C'] ?? '', '0C');
    const coolant = parsePid(rawResponses['0105'] ?? '', '05');
    const voltage = parsePid(rawResponses['0142'] ?? '', '42');
    const stft = parsePid(rawResponses['0106'] ?? '', '06');
    const ltft = parsePid(rawResponses['0107'] ?? '', '07');
    const map = parsePid(rawResponses['010B'] ?? '', '0B');
    const maf = parsePid(rawResponses['0110'] ?? '', '10');

    if (rpm && rpm.length >= 4) telemetry.rpm = Number.parseInt(rpm.slice(0, 4), 16) / 4;
    if (coolant && coolant.length >= 2)
      telemetry.coolantC = Number.parseInt(coolant.slice(0, 2), 16) - 40;
    if (voltage && voltage.length >= 4)
      telemetry.voltageV = Number.parseInt(voltage.slice(0, 4), 16) / 1000;
    if (stft && stft.length >= 2)
      telemetry.stftPct = ((Number.parseInt(stft.slice(0, 2), 16) - 128) * 100) / 128;
    if (ltft && ltft.length >= 2)
      telemetry.ltftPct = ((Number.parseInt(ltft.slice(0, 2), 16) - 128) * 100) / 128;
    if (map && map.length >= 2) telemetry.mapKpa = Number.parseInt(map.slice(0, 2), 16);
    if (maf && maf.length >= 4) telemetry.mafGps = Number.parseInt(maf.slice(0, 4), 16) / 100;

    return {
      capturedAt: new Date().toISOString(),
      dtcs: parseDtcs(rawResponses['03'] ?? ''),
      telemetry,
      rawResponses,
    };
  }

  async disconnect() {
    this.notificationSubscription?.remove();
    this.notificationSubscription = null;
    if (this.device) {
      await this.manager.cancelDeviceConnection(this.device.id).catch(() => undefined);
    }
    this.device = null;
    this.endpoint = null;
  }

  destroy() {
    void this.disconnect();
    void this.stopScan();
    this.manager.destroy();
  }

  private async resolveEndpoint(device: Device): Promise<Endpoint> {
    const services = await device.services();
    const candidates = [...services].sort((a) =>
      a.uuid.toLowerCase() === ELM_SERVICE_UUID ? -1 : 1,
    );
    for (const service of candidates) {
      const characteristics = await device.characteristicsForService(service.uuid);
      const write =
        characteristics.find((item) => item.uuid.toLowerCase() === ELM_CHARACTERISTIC_UUID) ??
        characteristics.find(
          (item) => item.isWritableWithResponse || item.isWritableWithoutResponse,
        );
      const notify =
        characteristics.find((item) => item.uuid.toLowerCase() === ELM_CHARACTERISTIC_UUID) ??
        characteristics.find((item) => item.isNotifiable || item.isIndicatable);
      if (write && notify) {
        return { serviceUuid: service.uuid, writeUuid: write.uuid, notifyUuid: notify.uuid };
      }
    }
    throw new Error('Não encontrei um canal BLE compatível com ELM327 neste adaptador.');
  }

  private subscribeToResponses() {
    if (!this.device || !this.endpoint) return;
    this.notificationSubscription = this.device.monitorCharacteristicForService(
      this.endpoint.serviceUuid,
      this.endpoint.notifyUuid,
      (error, characteristic) => this.handleResponse(error, characteristic),
    );
  }

  private handleResponse(error: Error | null, characteristic: Characteristic | null) {
    if (!this.pendingResponse) return;
    if (error) {
      clearTimeout(this.pendingResponse.timer);
      this.pendingResponse.reject(error);
      this.pendingResponse = null;
      return;
    }
    if (!characteristic?.value) return;
    this.pendingResponse.buffer += decodeBase64(characteristic.value);
    if (this.pendingResponse.buffer.includes('>')) {
      clearTimeout(this.pendingResponse.timer);
      this.pendingResponse.resolve(this.pendingResponse.buffer);
      this.pendingResponse = null;
    }
  }

  private async command(command: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.ensureConnected();
    if (this.pendingResponse) throw new Error('O adaptador ainda está processando outro comando.');

    const response = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error(`Sem resposta ao comando ${command}.`));
      }, timeoutMs);
      this.pendingResponse = { resolve, reject, buffer: '', timer };
    });

    const payload = encodeBase64(`${command}\r`);
    const endpoint = this.endpoint;
    const device = this.device;
    if (endpoint && device) {
      const characteristics = await device.characteristicsForService(endpoint.serviceUuid);
      const write = characteristics.find((item) => item.uuid === endpoint.writeUuid);
      if (write?.isWritableWithResponse) {
        await device.writeCharacteristicWithResponseForService(
          endpoint.serviceUuid,
          endpoint.writeUuid,
          payload,
        );
      } else {
        await device.writeCharacteristicWithoutResponseForService(
          endpoint.serviceUuid,
          endpoint.writeUuid,
          payload,
        );
      }
    }
    return response;
  }

  private ensureConnected() {
    if (!this.device || !this.endpoint) {
      throw new Error('Conecte um adaptador OBD-II antes de iniciar a leitura.');
    }
  }
}
