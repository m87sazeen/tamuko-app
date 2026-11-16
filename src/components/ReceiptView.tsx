import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { useT } from '../i18n';
import { CHANNELS, openShare } from '../integrations';
import { countryOf, formatMoney, pctLabel, usdEquivalent } from '../money';
import { paymentLabel, receiptText, shareReceipt } from '../receipt';
import { printSale } from '../print';
import { Sale, useApp } from '../store';
import { useTheme } from '../theme';
import { Symbol } from '../brand/Logo';
import { Button, Note, Paper, Pill, Row, Txt } from './ui';

export default function ReceiptView({ sale, copy }: { sale: Sale; copy?: boolean }) {
  const th = useTheme();
  const { t } = useT();
  const b = useApp((s) => s.business)!;
  const c = countryOf(sale.currency); // the sale's own country snapshot, not today's setting
  const m = (n: number) => formatMoney(n, c);
  const [msg, setMsg] = useState('');
  const enabled = CHANNELS.filter((ch) => b.integrations[ch.id]?.enabled && ch.share);

  const line = (l: string, r: string, bold?: boolean, key?: React.Key) => (
    <Row key={key} style={{ justifyContent: 'space-between' }}>
      <Txt size={bold ? 16 : 13} weight={bold ? '800' : '700'} mono color={th.paperInk} style={{ flex: 1 }}>{l}</Txt>
      <Txt size={bold ? 16 : 13} weight={bold ? '800' : '700'} mono color={th.paperInk}>{r}</Txt>
    </Row>
  );

  const run = async (fn: () => Promise<unknown>) => {
    setMsg('');
    try {
      await fn();
    } catch (e: any) {
      setMsg(`${e?.message ? e.message + ' ' : ''}The sale is saved. Use Share to save a PDF instead.`);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View accessible accessibilityLabel={`Receipt ${sale.receiptNo}`}>
      <Paper style={{ padding: 16, gap: 6 }}>
        {b.logo ? <Image source={{ uri: b.logo }} style={{ width: 56, height: 56, alignSelf: 'center', borderRadius: 8 }} accessibilityIgnoresInvertColors /> : null}
        <Txt size={18} weight="800" heading color={th.paperInk} center>{b.name}</Txt>
        {copy && <Txt center weight="700" mono color={th.paperInk}>COPY</Txt>}
        <Txt size={12} mono color={th.paperInk} center>{new Date(sale.createdAt).toLocaleString(c.locale)} · {sale.receiptNo}</Txt>
        {sale.token && (
          <View style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: th.paperInk, padding: 6, marginVertical: 4 }}>
            <Txt size={12} weight="600" color={th.paperInk} center>{t('token')}</Txt>
            <Txt size={40} weight="800" color={th.paperInk} center mono>{sale.token}</Txt>
          </View>
        )}
        <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#999999', marginVertical: 4 }} />
        {sale.lines.map((l, i) => (
          <View key={i}>
            {line(`${l.qty} x ${l.name}`, m(l.unitMinor * l.qty))}
            {l.mods?.length ? <Txt size={11} mono color={th.paperInk}>{'  + ' + l.mods.join(', ')}</Txt> : null}
          </View>
        ))}
        <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#999999', marginVertical: 4 }} />
        {line(t('subtotal'), m(sale.subtotalMinor))}
        {!!sale.discountMinor && line(sale.reward ? `Reward: free ${sale.reward.name}` : t('discount'), '-' + m(sale.discountMinor))}
        {sale.tax && line(`${sale.tax.name} ${pctLabel(sale.tax.rateBp)}${sale.tax.inclusive ? ' (incl.)' : ''}`, m(sale.taxMinor))}
        {line(t('total'), m(sale.totalMinor), true)}
        {sale.usdRate ? line('≈ USD (reference)', usdEquivalent(sale.totalMinor, c, sale.usdRate) ?? '') : null}
        {sale.payment.method === 'cash' && sale.payment.tenderedMinor != null && (
          line(`${t('cash')} ${m(sale.payment.tenderedMinor)}`, `${t('change')} ${m(sale.payment.changeMinor ?? 0)}`)
        )}
        <Row gap={6} style={{ justifyContent: 'center', marginTop: 8 }}>
          <Symbol size={16} variant="black" />
          <Txt size={10} mono color={th.paperInk}>powered by tamuko.app</Txt>
        </Row>
      </Paper>
      </View>

      <Row style={{ flexWrap: 'wrap' }}>
        {sale.voided ? <Pill tone="error" text={`Void: ${sale.voided.reason}`} /> : sale.payment.method === 'cash' ? <Pill tone="success" text="Cash received" /> : <Pill tone="success" text={paymentLabel(sale, c)} />}
      </Row>

      <Row>
        <Button kind="outline" icon="print" label={t('print')} onPress={() => run(async () => {
          const r = await printSale(sale, { copy });
          if (!r.ok) throw new Error(r.error);
          if (r.printed.length) setMsg(`Printed on ${r.printed.join(', ')}.`);
        })} style={{ flex: 1 }} />
        <Button kind="outline" icon="share" label={t('share')} onPress={() => run(() => shareReceipt(sale, b, c))} style={{ flex: 1 }} />
      </Row>
      {enabled.length > 0 && (
        <Row style={{ flexWrap: 'wrap' }} gap={8}>
          {enabled.map((ch) => (
            <Button key={ch.id} size="sm" kind="outline" icon="message" label={ch.name} onPress={async () => setMsg((await openShare(ch, receiptText(sale, b, c))) ?? '')} />
          ))}
        </Row>
      )}
      {!!msg && <Note tone="warning" text={msg} />}
    </View>
  );
}
