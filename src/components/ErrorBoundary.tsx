// Crash guard: if a screen throws, show a calm recovery page instead of a blank app.
// The data is untouched; the owner can try again or export a backup straight away.
import React from 'react';
import { ScrollView, View } from 'react-native';
import { exportBackup } from '../files';
import { useApp } from '../store';

type Props = { children: React.ReactNode; fallback: (retry: () => void, backup: () => Promise<void>, error: Error) => React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error) {
    try {
      useApp.getState().log('app.crash', String(error?.message ?? error).slice(0, 200));
    } catch {}
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          {this.props.fallback(() => this.setState({ error: null }), () => exportBackup().then(() => undefined), this.state.error)}
        </View>
      </ScrollView>
    );
  }
}
