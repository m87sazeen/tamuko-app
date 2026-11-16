// Backup / export helpers (KAV E08). Local-only data must be backed up by the owner.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { PERSIST_KEYS, useApp } from './store';

export async function saveTextFile(name: string, text: string, mime: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(text);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name });
}

export async function exportBackup() {
  const s = useApp.getState();
  const data: Record<string, unknown> = { format: 'tamuko-backup', version: 1, exportedAt: new Date().toISOString() };
  for (const k of PERSIST_KEYS) data[k] = (s as any)[k];
  const stamp = new Date().toISOString().slice(0, 10);
  await saveTextFile(`tamuko-backup-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json');
  s.setSettings({ lastBackupAt: Date.now() });
  s.log('backup.export');
}

/** Validates shape before restoring so a wrong/corrupt file cannot wipe data. */
export async function pickAndRestore(): Promise<string> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled) return 'Cancelled.';
  const asset = res.assets[0];
  const text = Platform.OS === 'web' ? await (await fetch(asset.uri)).text() : await new File(asset.uri).text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not a tamuko backup (invalid JSON). Nothing was changed.');
  }
  if (data?.format !== 'tamuko-backup' || !Array.isArray(data.sales) || !Array.isArray(data.items))
    throw new Error('That file is not a tamuko backup. Nothing was changed.');
  useApp.getState().importData(data);
  return `Restored ${data.sales.length} sales and ${data.items.length} items.`;
}

export const toCsv = (rows: (string | number)[][]) =>
  rows.map((r) => r.map((v) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // CSV formula-injection guard
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
