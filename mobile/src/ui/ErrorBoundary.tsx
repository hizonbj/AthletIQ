/**
 * Crash containment.
 *
 * Without this a render error is a white screen with no way out, and on a phone
 * the only recovery is deleting the app — which, for a local-first app, deletes
 * the record too. Offering a retry and pointing at the backup matters more here
 * than in a server-backed product.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from './components';
import { colors, spacing, type } from './theme';

interface Props {
  children: React.ReactNode;
  /** Injectable so tests can assert what was reported without a real logger. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info);
  }

  private reset = () => {
    this.setState({ error: undefined });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Something broke.</Text>
          <Text style={styles.body}>
            Your data is safe on this device — nothing was lost. Try again, and if this keeps
            happening, export a backup from Settings before reinstalling.
          </Text>
          <View style={styles.detail}>
            <Text style={styles.detailText} selectable>
              {error.message || String(error)}
            </Text>
          </View>
          <Button label="Try again" onPress={this.reset} />
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  scroll: { padding: spacing.xl },
  title: { ...type.title, color: colors.text, marginBottom: spacing.md },
  body: { ...type.body, color: colors.textSecondary, lineHeight: 24, marginBottom: spacing.xl },
  detail: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  detailText: { ...type.caption, color: colors.textTertiary, fontFamily: 'monospace' },
});
