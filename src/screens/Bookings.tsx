// Manage → Bookings & queue (salons, barbers, pet grooming, cleaning, gyms, studios, tutoring, play areas).
// Book a time, send a WhatsApp reminder, mark arrival — arrival puts the job on the rail with the
// customer and notes — or add a walk-in straight to the queue.
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, IconButton, Note, PageHeader, Pill, Row, Screen, Section, Sheet, Txt } from '../components/ui';
import { CHANNELS, openShare } from '../integrations';
import { countryOf } from '../money';
import { clampText, isE164, maskPhone, normalizePhone } from '../security';
import { Booking, useApp } from '../store';

const DAY = 86_400_000;
const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const hhmm = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const STATUS: Record<Booking['status'], { tone: 'info' | 'success' | 'pending' | 'warning' | 'error'; text: string }> = {
  booked: { tone: 'info', text: 'Booked' },
  arrived: { tone: 'pending', text: 'Arrived' },
  done: { tone: 'success', text: 'Done' },
  noshow: { tone: 'warning', text: 'No-show' },
  cancelled: { tone: 'error', text: 'Cancelled' },
};

export default function Bookings({ onBack }: { onBack: () => void }) {
  const b = useApp((s) => s.business)!;
  const items = useApp((s) => s.items);
  const bookings = useApp((s) => s.bookings);
  const saveBooking = useApp((s) => s.saveBooking);
  const setStatus = useApp((s) => s.setBookingStatus);
  const saveCustomer = useApp((s) => s.saveCustomer);
  const placeOrder = useApp((s) => s.placeOrder);
  const c = countryOf(b.country);
  const wa = CHANNELS.find((x) => x.id === 'whatsapp');
  const [today] = useState(() => startOfDay(Date.now())); // fixed while the page is open
  const [day, setDay] = useState(today);
  const [form, setForm] = useState<null | 'booking' | 'walkin'>(null);
  const [msg, setMsg] = useState('');
  // form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [itemId, setItemId] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [hour, setHour] = useState(10);
  const [minute, setMinute] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [staff, setStaff] = useState('');
  const [note, setNote] = useState('');

  const list = useMemo(() => bookings.filter((x) => x.at >= day && x.at < day + DAY).sort((a, z) => a.at - z.at), [bookings, day]);
  const staffNames = [...new Set(bookings.map((x) => x.staff).filter(Boolean))].slice(-6);
  const e164 = phone ? normalizePhone(c.dial, phone) : '';
  const phoneOk = !phone || isE164(e164);
  const item = items.find((i) => i.id === itemId);
  const active = items.filter((i) => i.active);

  const openForm = (kind: 'booking' | 'walkin') => {
    setForm(kind);
    setName('');
    setPhone('');
    setItemId(active[0]?.id ?? null);
    setDayOffset(Math.max(0, Math.round((day - today) / DAY)));
    setHour(Math.min(20, Math.max(8, new Date().getHours() + 1)));
    setMinute(0);
    setMinutes(30);
    setNote('');
  };

  /** Arrival: put the job on the rail (if the business uses it) with the customer and notes attached. */
  const arrive = (bk: Booking) => {
    let ticketId: string | null = null;
    const it = items.find((i) => i.id === bk.itemId);
    if (b.railEnabled && it) {
      const tk = placeOrder({ lines: [{ itemId: it.id, name: it.name, unitMinor: it.priceMinor, qty: 1 }], mode: 'takeaway', table: null, job: { customerId: bk.customerId, note: [bk.staff && `With ${bk.staff}`, bk.note].filter(Boolean).join(' · ') || undefined } });
      ticketId = tk.id;
      setMsg(`${bk.name} is in the queue as ${tk.token}. Take payment from Sell → Open bills or the rail.`);
    } else setMsg(`${bk.name} has arrived. Charge the ${bk.service.toLowerCase()} at the till.`);
    setStatus(bk.id, 'arrived', ticketId);
  };

  const submit = () => {
    if (!name.trim() || !phoneOk) return;
    const cust = phone || name ? saveCustomer({ name: clampText(name.trim(), 60), phone: phone ? e164 : '' }) : null;
    const at = form === 'walkin' ? Date.now() : today + dayOffset * DAY + hour * 3_600_000 + minute * 60_000;
    const bk = saveBooking({ customerId: cust?.id ?? null, name: clampText(name.trim(), 60), phone: phone ? e164 : '', service: item?.name ?? 'Visit', itemId: item?.id ?? null, at, minutes, staff: clampText(staff.trim(), 30), note: clampText(note.trim(), 160) });
    setForm(null);
    if (form === 'walkin') arrive(bk);
    else setMsg(`Booked ${bk.name} for ${new Date(at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at ${hhmm(at)}.`);
  };

  const remind = (bk: Booking) =>
    wa && openShare(wa, `${b.name}: reminder of your ${bk.service.toLowerCase()} on ${new Date(bk.at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} at ${hhmm(bk.at)}. Reply to change it.`, bk.phone);

  const isToday = day === today;

  return (
    <Screen style={{ maxWidth: 760 }}>
      <PageHeader kicker="Manage" title="Bookings & queue" onBack={onBack} action={<Button size="sm" kind="secondary" icon="plus" label="Book" onPress={() => openForm('booking')} />} />
      {!!msg && <Note tone="success" text={msg} />}
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon="back" a11y="Previous day" onPress={() => setDay(day - DAY)} />
        <Txt weight="700">{isToday ? 'Today' : new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Txt>
        <IconButton icon="forward" a11y="Next day" onPress={() => setDay(day + DAY)} />
      </Row>
      {isToday && <Button kind="outline" icon="users" label="Add walk-in to the queue" onPress={() => openForm('walkin')} />}
      {list.length === 0 && <Note tone="info" text="Nothing booked for this day." />}
      {list.map((bk) => (
        <Card key={bk.id} style={{ gap: 8, opacity: bk.status === 'cancelled' ? 0.6 : 1 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={12} style={{ flex: 1 }}>
              <Txt size={20} weight="700" mono>{hhmm(bk.at)}</Txt>
              <View style={{ flex: 1 }}>
                <Txt weight="700" numberOfLines={1}>{bk.name}</Txt>
                <Txt size={13} dim numberOfLines={2}>{bk.service} · {bk.minutes} min{bk.staff ? ` · ${bk.staff}` : ''}{bk.phone ? ` · ${maskPhone(bk.phone)}` : ''}</Txt>
              </View>
            </Row>
            <Pill tone={STATUS[bk.status].tone} text={STATUS[bk.status].text} />
          </Row>
          {bk.note ? <Txt size={14}>{bk.note}</Txt> : null}
          {bk.status === 'booked' && (
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Button size="sm" icon="check" label="Arrived" onPress={() => arrive(bk)} />
              {bk.phone && wa ? <Button size="sm" kind="outline" icon="message" label="Remind" onPress={() => remind(bk)} /> : null}
              <Button size="sm" kind="ghost" label="No-show" onPress={() => setStatus(bk.id, 'noshow')} />
              <Button size="sm" kind="ghost" label="Cancel" onPress={() => setStatus(bk.id, 'cancelled')} />
            </Row>
          )}
          {bk.status === 'arrived' && !bk.ticketId && <Button size="sm" kind="outline" icon="check" label="Mark done" onPress={() => setStatus(bk.id, 'done')} />}
        </Card>
      ))}

      <Sheet visible={!!form} onClose={() => setForm(null)} title={form === 'walkin' ? 'Walk-in' : 'New booking'}>
        <Field label="Customer name" value={name} onChange={setName} maxLength={60} autoFocus />
        <Field label={`Mobile (${c.dial}) · for reminders`} value={phone} onChange={setPhone} keyboard="phone-pad" error={!phoneOk ? 'Check the number' : undefined} />
        <Section title="Service" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {active.map((i) => <Button key={i.id} size="sm" kind={itemId === i.id ? 'secondary' : 'outline'} label={i.name} onPress={() => setItemId(i.id)} />)}
        </View>
        {form === 'booking' && (
          <>
            <Section title="Day" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: 7 }, (_, d) => (
                <Button key={d} size="sm" kind={dayOffset === d ? 'secondary' : 'outline'} label={d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : new Date(today + d * DAY).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })} onPress={() => setDayOffset(d)} />
              ))}
            </View>
            <Section title="Time" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: 14 }, (_, i) => i + 8).map((h) => <Button key={h} size="sm" kind={hour === h ? 'secondary' : 'outline'} label={`${String(h).padStart(2, '0')}`} onPress={() => setHour(h)} />)}
            </View>
            <Row gap={8}>
              {[0, 15, 30, 45].map((mm) => <Button key={mm} size="sm" kind={minute === mm ? 'secondary' : 'outline'} label={`:${String(mm).padStart(2, '0')}`} onPress={() => setMinute(mm)} />)}
            </Row>
          </>
        )}
        <Section title="Length" />
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {[15, 30, 45, 60, 90, 120].map((mm) => <Button key={mm} size="sm" kind={minutes === mm ? 'secondary' : 'outline'} label={`${mm} min`} onPress={() => setMinutes(mm)} />)}
        </Row>
        <Field label="Staff (optional)" value={staff} onChange={setStaff} maxLength={30} placeholder="e.g. Ali" />
        {staffNames.length > 0 && (
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {staffNames.map((n) => <Button key={n} size="sm" kind={staff === n ? 'secondary' : 'outline'} label={n} onPress={() => setStaff(n)} />)}
          </Row>
        )}
        <Field label="Notes (optional)" value={note} onChange={setNote} maxLength={160} placeholder="e.g. allergic to dye, small dog" />
        <Button size="lg" label={form === 'walkin' ? 'Add to the queue' : 'Save booking'} disabled={!name.trim() || !phoneOk} onPress={submit} />
      </Sheet>
    </Screen>
  );
}
