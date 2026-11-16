// How bytes reach the printer.
//   ble    — Bluetooth Low Energy receipt printers (iPhone, iPad and Android)
//   net    — Wi-Fi / LAN printers on raw port 9100 (iPhone, iPad and Android)
//   system — the device's own print dialog: AirPrint, Android print service, or the browser (all platforms)
// Native modules are loaded lazily so the web build and Expo Go never touch them.
/* eslint-disable @typescript-eslint/no-require-imports -- native printer modules load only when used */
import { PermissionsAndroid, Platform } from 'react-native';

export type PrinterKind = 'ble' | 'net' | 'system';

export const nativePrinting = Platform.OS === 'ios' || Platform.OS === 'android';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Bluetooth (BLE) ----------

let manager: any = null;
function ble() {
  if (!nativePrinting) throw new Error('Bluetooth printers need the iPhone, iPad or Android app.');
  if (!manager) {
    const { BleManager } = require('react-native-ble-plx');
    manager = new BleManager();
  }
  return manager;
}

async function askBluetoothPermission() {
  if (Platform.OS !== 'android') return true;
  const api = Number(Platform.Version);
  const perms =
    api >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const res = await PermissionsAndroid.requestMultiple(perms);
  return Object.values(res).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

async function bluetoothOn() {
  const m = ble();
  let state = await m.state();
  if (state === 'Unknown' || state === 'Resetting') {
    await wait(600);
    state = await m.state();
  }
  if (state === 'Unauthorized') throw new Error('Bluetooth permission is off. Allow it for tamuko in the phone’s Settings.');
  if (state !== 'PoweredOn') throw new Error('Bluetooth is off. Turn it on and try again.');
}

export type FoundPrinter = { id: string; name: string; rssi: number | null };

/** Scan for nearby Bluetooth printers for `seconds`, reporting each one found. Returns a stop function. */
export async function scanBluetooth(onFound: (p: FoundPrinter) => void, seconds = 12): Promise<() => void> {
  if (!(await askBluetoothPermission())) throw new Error('Bluetooth permission was not given.');
  await bluetoothOn();
  const m = ble();
  const seen = new Set<string>();
  m.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
    if (error || !device) return;
    const name = device.name || device.localName;
    if (!name || seen.has(device.id)) return; // printers always advertise a name
    seen.add(device.id);
    onFound({ id: device.id, name, rssi: device.rssi ?? null });
  });
  const stop = () => m.stopDeviceScan();
  setTimeout(stop, seconds * 1000);
  return stop;
}

async function writeBluetooth(id: string, data: Uint8Array) {
  if (!(await askBluetoothPermission())) throw new Error('Bluetooth permission was not given.');
  await bluetoothOn();
  const m = ble();
  let device = (await m.isDeviceConnected(id)) ? (await m.devices([id]))[0] : null;
  if (!device) device = await m.connectToDevice(id, { timeout: 8000, requestMTU: 185 });
  await device.discoverAllServicesAndCharacteristics();
  // Find the first characteristic we can write to (printers expose one "serial" characteristic).
  let target: any = null;
  for (const s of await device.services()) {
    for (const ch of await s.characteristics()) {
      if (ch.isWritableWithoutResponse || ch.isWritableWithResponse) {
        target = ch;
        break;
      }
    }
    if (target) break;
  }
  if (!target) throw new Error('This Bluetooth device does not accept print data. Is it a receipt printer?');
  const chunk = Math.max(20, Math.min(180, (device.mtu ?? 23) - 3));
  for (let i = 0; i < data.length; i += chunk) {
    const part = toBase64(data.subarray(i, i + chunk));
    if (target.isWritableWithoutResponse) {
      await target.writeWithoutResponse(part);
      await wait(12); // give small printers time to empty their buffer
    } else await target.writeWithResponse(part);
  }
}

// ---------- Wi-Fi / LAN (raw TCP 9100) ----------

export const isIp = (s: string) => /^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)$/.test(s.trim()) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.local$/i.test(s.trim());

function writeNetwork(host: string, port: number, data: Uint8Array): Promise<void> {
  if (!nativePrinting) return Promise.reject(new Error('Wi-Fi printers need the iPhone, iPad or Android app.'));
  const TcpSocket = require('react-native-tcp-socket').default ?? require('react-native-tcp-socket');
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (e?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        sock.destroy();
      } catch {}
      if (e) reject(e);
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error(`No answer from ${host}:${port}. Check the printer is on the same Wi-Fi.`)), 6000);
    const sock = TcpSocket.createConnection({ host: host.trim(), port }, () => {
      sock.write(data, undefined, (err?: Error) => {
        if (err) return finish(err);
        setTimeout(() => finish(), 300); // let the last bytes leave before closing
      });
    });
    sock.on('error', (e: Error) => finish(new Error(`Could not reach the printer: ${e.message}`)));
  });
}

// ---------- send ----------

export async function sendBytes(kind: PrinterKind, address: string, port: number, data: Uint8Array) {
  if (kind === 'ble') return writeBluetooth(address, data);
  if (kind === 'net') return writeNetwork(address, port || 9100, data);
  throw new Error('System printers print HTML, not raw bytes.');
}
