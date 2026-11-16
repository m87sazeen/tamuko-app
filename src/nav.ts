// In-app navigation state (not persisted): which tab is open and which Manage page.
import { create } from 'zustand';

export type Tab = 'sell' | 'rail' | 'reports' | 'manage' | 'settings';
export type ManageView = 'home' | 'workflow' | 'day' | 'items' | 'printers' | 'ingredients' | 'customers' | 'bookings' | 'features';

type Nav = { tab: Tab; view: ManageView; go: (tab: Tab, view?: ManageView) => void };

export const useNav = create<Nav>((set) => ({
  tab: 'sell',
  view: 'home',
  go: (tab, view) => set((s) => ({ tab, view: view ?? (tab === 'manage' ? s.view : s.view) })),
}));
