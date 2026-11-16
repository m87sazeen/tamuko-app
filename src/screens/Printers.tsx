// Manage → Printers. Connect a receipt / kitchen printer from a phone or tablet:
//   Bluetooth (scan nearby printers), Wi-Fi / LAN (IP address, port 9100), or the device's own print
//   dialog (AirPrint, Android print service, browser). Choose what each printer prints and whether it
//   prints automatically after every sale or order.
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Icon } from '../brand/Icon';
import { Button, Card, Field, H2, IconButton, Note, Pill, Row, Screen, Segmented, Tick, Txt, PageHeader } from '../components/ui';
import { testPrint } from '../print';
import { FoundPrinter, isIp, nativePrinting, scanBluetooth } from '../print/transports';
import { Printer, useApp } from '../store';
import { useTheme } from '../theme';

type Draft = Omit<Printer, 'id'> & { id?: string };

const blank = (kind: Printer['kind']): Draft => ({
  name: kind === 'system' ? (Platform.OS === 'web' ? 'Browser print' : Platform.OS === 'ios' ? 'AirPrint' : 'Android print') : '',
  kind,
  address: '',
  port: 9100,
  width: 58,
  receipts: true,
  kitchen: false,
  autoReceipt: kind !== 'system',
  autoKitchen: false,
  drawer: false,
});

const KIND_LABEL: Record<Printer['kind'], string> = { ble: 'Bluetooth', net: 'Wi-Fi / LAN', system: 'Print dialog' };

function Check({ on, label, hint, onPress }: { on: boolean; label: string; hint?: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} a11y={`${label}${on ? ', on' : ', off'}`} style={{ padding: 12, borderRadius: 14, boxShadow: 'none', shadowOpacity: 0, elevation: 0 } as any}>
      <Row gap={10}>
        <Tick on={on} />
        <View style={{ flex: 1 }}>
          <Txt weight="600">{label}</Txt>
          {hint ? <Txt size={13} dim>{hint}</Txt> : null}
        </View>
      </Row>
    </Card>
  );
}

export default function Printers({ onBack }: { onBack: () => void }) {
  const th = useTheme();
  const printers = useApp((s) => s.printers);
  const savePrinter = useApp((s) => s.savePrinter);
  const removePrinter = useApp((s) => s.removePrinter);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [found, setFound] = useState<FoundPrinter[]>([]);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => () => setScanning(false), []);

  const scan = async () => {
    setFound([]);
    setMsg(null);
    setScanning(true);
    try {
      await scanBluetooth((p) => setFound((f) => (f.some((x) => x.id === p.id) ? f : [...f, p].sort((a, z) => (z.rssi ?? -999) - (a.rssi ?? -999)))), 12);
      setTimeout(() => setScanning(false), 12000);
    } catch (e: any) {
      setScanning(false);
      setMsg({ tone: 'error', text: e.message });
    }
  };

  const test = async (p: Printer) => {
    setBusy(p.id);
    setMsg(null);
    const r = await testPrint(p);
    setBusy(null);
    setMsg(r.ok ? { tone: 'success', text: `Test sent to ${p.name}. Check the paper.` } : { tone: 'error', text: r.error });
  };

  const valid = !!draft && !!draft.name.trim() && (draft.kind === 'system' || (draft.kind === 'ble' ? !!draft.address : isIp(draft.address)));

  if (draft)
    return (
      <Screen style={{ maxWidth: 640 }}>
        <PageHeader kicker={KIND_LABEL[draft.kind]} title={draft.id ? 'Edit printer' : 'Add a printer'} onBack={() => setDraft(null)} />

        {draft.kind === 'ble' && !draft.id && (
          <Card style={{ gap: 10 }}>
            <Txt>Turn the printer on and keep it close. Most 58 mm and 80 mm Bluetooth receipt printers work.</Txt>
            <Button icon="search" label={scanning ? 'Searching…' : found.length ? 'Search again' : 'Find printers'} loading={scanning && !found.length} onPress={scan} />
            {found.map((p) => (
              <Card key={p.id} selected={draft.address === p.id} onPress={() => setDraft({ ...draft, address: p.id, name: draft.name || p.name })} a11y={`Choose ${p.name}`} style={{ padding: 12, borderRadius: 14 }}>
                <Row gap={10}>
                  <Tick on={draft.address === p.id} />
                  <Txt weight="600" style={{ flex: 1 }}>{p.name}</Txt>
                  {p.rssi != null ? <Txt size={12} dim mono>{p.rssi > -60 ? 'near' : p.rssi > -80 ? 'ok' : 'far'}</Txt> : null}
                </Row>
              </Card>
            ))}
            {scanning && found.length > 0 && <Txt size={13} dim>Still searching…</Txt>}
            <Txt size={13} dim>Older printers that only use “classic” Bluetooth (pairing with a PIN) work on Android after pairing in phone Settings, or use Wi-Fi instead.</Txt>
          </Card>
        )}

        {draft.kind === 'net' && (
          <Card style={{ gap: 10 }}>
            <Txt>Print a self-test page on the printer (hold the feed button while switching it on) to see its IP address.</Txt>
            <Field label="Printer IP address" value={draft.address} onChange={(v) => setDraft({ ...draft, address: v.trim() })} keyboard="numbers-and-punctuation" mono placeholder="192.168.1.50" error={draft.address && !isIp(draft.address) ? 'Use an address like 192.168.1.50' : undefined} />
            <Field label="Port" value={String(draft.port)} onChange={(v) => setDraft({ ...draft, port: Number(v.replace(/\D/g, '')) || 9100 })} keyboard="number-pad" mono />
          </Card>
        )}

        {draft.kind === 'system' && <Note tone="info" text="Uses the phone, tablet or browser print dialog — AirPrint, Android printing or Save as PDF. Prints every language. You choose the printer each time." />}

        <Card style={{ gap: 12 }}>
          <Field label="Printer name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v.slice(0, 40) })} placeholder="e.g. Counter printer" />
          {draft.kind !== 'system' && (
            <>
              <Txt size={14} weight="600">Paper width</Txt>
              <Segmented value={String(draft.width) as '58' | '80'} onChange={(v) => setDraft({ ...draft, width: Number(v) as 58 | 80 })} options={[{ value: '58', label: '58 mm (small)' }, { value: '80', label: '80 mm (wide)' }]} />
            </>
          )}
        </Card>

        <H2 size={18}>What it prints</H2>
        <Check on={draft.receipts} label="Customer receipts" onPress={() => setDraft({ ...draft, receipts: !draft.receipts })} />
        {draft.receipts && draft.kind !== 'system' && <Check on={draft.autoReceipt} label="Print the receipt after every sale" hint="No extra tap at the counter." onPress={() => setDraft({ ...draft, autoReceipt: !draft.autoReceipt })} />}
        {draft.kind !== 'system' && <Check on={draft.kitchen} label="Kitchen / job tickets" hint="Token, table and items in large type. No prices." onPress={() => setDraft({ ...draft, kitchen: !draft.kitchen })} />}
        {draft.kitchen && draft.kind !== 'system' && <Check on={draft.autoKitchen} label="Print a ticket for every new order" onPress={() => setDraft({ ...draft, autoKitchen: !draft.autoKitchen })} />}
        {draft.kind !== 'system' && draft.receipts && <Check on={draft.drawer} label="Open the cash drawer on cash sales" hint="For drawers plugged into the printer." onPress={() => setDraft({ ...draft, drawer: !draft.drawer })} />}

        {draft.kind !== 'system' && <Note tone="info" text="Receipt printers print Latin letters. Names in Arabic, Thai, Chinese and other scripts print best with the Print dialog option." />}
        {!!msg && <Note tone={msg.tone} text={msg.text} />}
        <Row>
          {draft.id ? <Button kind="ghost" icon="trash" label="Remove" onPress={() => { removePrinter(draft.id!); setDraft(null); }} /> : null}
          <Button label="Save printer" disabled={!valid} onPress={() => { savePrinter({ ...draft, name: draft.name.trim() }); setDraft(null); setMsg({ tone: 'success', text: `${draft.name.trim()} is ready. Send a test print to check.` }); }} style={{ flex: 1 }} />
        </Row>
      </Screen>
    );

  return (
    <Screen style={{ maxWidth: 720 }}>
      <PageHeader kicker="Manage" title="Printers" onBack={onBack} />
      {!!msg && <Note tone={msg.tone} text={msg.text} />}
      {printers.length === 0 && <Note tone="info" text="No printer yet. Receipts can still be shared as PDF or sent by WhatsApp." />}
      {printers.map((p) => (
        <Card key={p.id} style={{ gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={10} style={{ flex: 1 }}>
              <Icon name="print" size={24} color={th.text} />
              <View style={{ flex: 1 }}>
                <Txt weight="700" numberOfLines={1}>{p.name}</Txt>
                <Txt size={13} dim>{KIND_LABEL[p.kind]}{p.kind === 'net' ? ` · ${p.address}:${p.port}` : ''}{p.kind !== 'system' ? ` · ${p.width} mm` : ''}</Txt>
              </View>
            </Row>
            <IconButton icon="edit" a11y={`Edit ${p.name}`} onPress={() => setDraft({ ...p })} />
          </Row>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {p.receipts && <Pill tone="info" text={p.autoReceipt ? 'Receipts · auto' : 'Receipts'} />}
            {p.kitchen && <Pill tone="pending" text={p.autoKitchen ? 'Kitchen · auto' : 'Kitchen'} />}
            {p.drawer && <Pill tone="success" text="Cash drawer" />}
          </Row>
          <Button kind="outline" size="sm" icon="print" label="Test print" loading={busy === p.id} onPress={() => test(p)} />
        </Card>
      ))}
      <H2 size={18}>Add a printer</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {nativePrinting && (
          <Card onPress={() => setDraft(blank('ble'))} a11y="Add a Bluetooth printer" style={{ flexBasis: 200, flexGrow: 1, gap: 6 }}>
            <Txt size={17} weight="800" heading>Bluetooth</Txt>
            <Txt size={14} dim>Portable 58 mm printers next to the phone or tablet.</Txt>
          </Card>
        )}
        {nativePrinting && (
          <Card onPress={() => setDraft(blank('net'))} a11y="Add a Wi-Fi or network printer" style={{ flexBasis: 200, flexGrow: 1, gap: 6 }}>
            <Txt size={17} weight="800" heading>Wi-Fi / LAN</Txt>
            <Txt size={14} dim>Counter and kitchen printers on the shop network.</Txt>
          </Card>
        )}
        <Card onPress={() => setDraft(blank('system'))} a11y="Use the print dialog" style={{ flexBasis: 200, flexGrow: 1, gap: 6 }}>
          <Txt size={17} weight="800" heading>Print dialog</Txt>
          <Txt size={14} dim>AirPrint, Android printing or the browser. Any language.</Txt>
        </Card>
      </View>
      {!nativePrinting && <Note tone="info" text="Bluetooth and Wi-Fi receipt printers connect from the iPhone, iPad or Android app. In the browser, use the print dialog." />}
    </Screen>
  );
}
