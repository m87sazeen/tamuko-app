// React binding: rebuilds the posted journal from operational records + manual journals.
import { useMemo } from 'react';
import { useApp } from '../store';
import { buildJournal } from './ledger.ts';

export function useLedger() {
  const sales = useApp((s) => s.sales);
  const expenses = useApp((s) => s.expenses);
  const days = useApp((s) => s.days);
  const journals = useApp((s) => s.journals);
  return useMemo(() => buildJournal({ sales, expenses, days, manual: journals }), [sales, expenses, days, journals]);
}
