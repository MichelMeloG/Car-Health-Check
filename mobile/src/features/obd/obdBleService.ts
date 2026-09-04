import { decode as decodeBase64, encode as encodeBase64 } from 'base-64';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  BleManager,
  type Characteristic,
  type Device,
  type Subscription,
} from 'react-native-ble-plx';

import { calculateSnapshotQuality } from './obdQuality';
import {
  ESSENTIAL_PIDS,
  PID_DISCOVERY_COMMANDS,
  flattenDtcs,
  formatPid,
  parseDtcGroups,
  parsePidData,
  parseSupportedPidBitmap,
  protocolFromResponse,
} from './obdProtocol';
import type { ObdDevice, ObdSnapshot, ObdTelemetry } from './types';

const ELM_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const ELM_CHARACTERISTIC_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
const DEFAULT_TIMEOUT_MS = 4_000;

type Endpoint = { serviceUuid: string; writeUuid: string; notifyUuid: string };
type SnapshotOptions = { includeDtcs?: boolean; refreshCapabilities?: boolean };
type PendingResponse = {
  resolve: (response: string) => void;
  reject: (reason: Error) => void;
  buffer: string;
  timer: ReturnType<typeof setTimeout>;
};

function parseTelemetry(rawResponses: Record<string, string>) {
  const telemetry: ObdTelemetry = {};
  const load = parsePidData(rawResponses['0104'] ?? '', '04');
  const coolant = parsePidData(rawResponses['0105'] ?? '', '05');
  const stft = parsePidData(rawResponses['0106'] ?? '', '06');
  const ltft = parsePidData(rawResponses['0107'] ?? '', '07');
  const map = parsePidData(rawResponses['010B'] ?? '', '0B');
  const rpm = parsePidData(rawResponses['010C'] ?? '', '0C');
  const speed = parsePidData(rawResponses['010D'] ?? '', '0D');
  const maf = parsePidData(rawResponses['0110'] ?? '', '10');
  const voltage = parsePidData(rawResponses['0142'] ?? '', '42');

  if (load && load.length >= 2) telemetry.loadPct = (Number.parseInt(load.slice(0, 2), 16) * 100) / 255;
  if (coolant && coolant.length >= 2)
    telemetry.coolantC = Number.parseInt(coolant.slice(0, 2), 16) - 40;
  if (stft && stft.length >= 2)
    telemetry.stftPct = ((Number.parseInt(stft.slice(0, 2), 16) - 128) * 100) / 128;
  if (ltft && ltft.length >= 2)
    telemetry.ltftPct = ((Number.parseInt(ltft.slice(0, 2), 16) - 128) * 100) / 128;
  if (map && map.length >= 2) telemetry.mapKpa = Number.parseInt(map.slice(0, 2), 16);
  if (rpm && rpm.length >= 4) telemetry.rpm = Number.parseInt(rpm.slice(0, 4), 16) / 4;
  if (speed && speed.length >= 2) telemetry.speedKph = Number.parseInt(speed.slice(0, 2), 16);
  if (maf && maf.length >= 4) telemetry.mafGps = Number.parseInt(maf.slice(0, 4), 16) / 100;
  if (voltage && voltage.length >= 4)
    telemetry.voltageV = Number.parseInt(voltage.slice(0, 4), 16) / 1000;

  return telemetry;
}

export class ObdBleService {
  private readonly manager = new BleManager();
  private device: Device | null = null;
  private endpoint: Endpoint | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private notificationSubscription: Subscription | null = null;
  private protocol: string | null = null;
  private supportedPids = new Set<number>();
  private pidBitmaps: Record<string, string> = {};
  private pendingResponse: PendingResponse | null = null;

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
    await this.refreshCapabilities();
  }

  async runSnapshot(options: SnapshotOptions = {}): Promise<ObdSnapshot> {
    this.ensureConnected();
    if (options.refreshCapabilities || !this.supportedPids.size) await this.refreshCapabilities();

    const rawResponses: Record<string, string> = {};
    const commands = ESSENTIAL_PIDS.filter(
      (item) => !this.supportedPids.size || this.supportedPids.has(item.pid),
    ).map((item) => item.command);
    for (const command of commands) {
      rawResponses[command] = await this.commandSafely(command);
    }

    if (options.includeDtcs !== false) {
      for (const command of ['03', '07', '0A']) {
        rawResponses[command] = await this.commandSafely(command);
      }
    }

    const dtcGroups = parseDtcGroups(rawResponses);
    const supportedPids = [...this.supportedPids].map(formatPid);
    const missingPids = ESSENTIAL_PIDS.filter((item) => !this.supportedPids.has(item.pid)).map(
      (item) => item.command,
    );
    const quality = calculateSnapshotQuality({
      rawResponses,
      supportedPids,
      protocol: this.protocol,
    });

    return {
      capturedAt: new Date().toISOString(),
      dtcs: flattenDtcs(dtcGroups),
      dtcGroups,
      telemetry: parseTelemetry(rawResponses),
      rawResponses,
      protocol: this.protocol,
      supportedPids,
      missingPids,
      pidBitmaps: this.pidBitmaps,
      quality,
    };
  }

  async clearDiagnosticTroubleCodes() {
    this.ensureConnected();
    const response = await this.command('04');
    if (/ERROR|NO DATA|UNABLE/i.test(response)) {
      throw new Error('O veículo não confirmou a limpeza dos códigos.');
    }
    return response;
  }

  async disconnect() {
    this.notificationSubscription?.remove();
    this.notificationSubscription = null;
    if (this.device) {
      await this.manager.cancelDeviceConnection(this.device.id).catch(() => undefined);
    }
    this.device = null;
    this.endpoint = null;
    this.protocol = null;
    this.supportedPids.clear();
    this.pidBitmaps = {};
  }

  destroy() {
    void this.disconnect();
    void this.stopScan();
    this.manager.destroy();
  }

  private async refreshCapabilities() {
    const protocolResponse = await this.commandSafely('ATDP');
    this.protocol = protocolFromResponse(protocolResponse);

    const supported = new Set<number>();
    const bitmaps: Record<string, string> = {};
    let queryNextBitmap = true;
    for (const command of PID_DISCOVERY_COMMANDS) {
      if (!queryNextBitmap) break;
      const response = await this.commandSafely(command);
      bitmaps[command] = response;
      const basePid = Number.parseInt(command.slice(2), 16);
      const current = parseSupportedPidBitmap(response, basePid);
      current.forEach((pid) => supported.add(pid));
      queryNextBitmap = current.includes(basePid + 0x20);
    }
    this.supportedPids = supported;
    this.pidBitmaps = bitmaps;
  }

  private async commandSafely(command: string) {
    return this.command(command).catch((error: Error) => error.message);
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

    try {
      const payload = encodeBase64(`${command}\r`);
      const endpoint = this.endpoint;
      const device = this.device;
      if (!endpoint || !device) throw new Error('Adaptador OBD-II desconectado.');
      const characteristics = await device.characteristicsForService(endpoint.serviceUuid);
      const write = characteristics.find((item) => item.uuid === endpoint.writeUuid);
      if (write?.isWritableWithResponse) {
        await device.writeCharacteristicWithResponseForService(
          endpoint.serviceUuid,
          endpoint.writeUuid,
          payload,
        );
      } else if (write?.isWritableWithoutResponse) {
        await device.writeCharacteristicWithoutResponseForService(
          endpoint.serviceUuid,
          endpoint.writeUuid,
          payload,
        );
      } else {
        throw new Error('O adaptador não possui uma característica BLE gravável.');
      }
    } catch (cause) {
      const pending = this.pendingResponse as PendingResponse | null;
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingResponse = null;
      }
      throw cause;
    }
    return response;
  }

  private ensureConnected() {
    if (!this.device || !this.endpoint) {
      throw new Error('Conecte um adaptador OBD-II antes de iniciar a leitura.');
    }
  }
}
