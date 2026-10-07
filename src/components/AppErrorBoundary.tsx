import React from 'react';
import type { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { colors, condensedFont } from '../theme';

type State = {
  error: Error | null;
  retryKey: number;
};

export class AppErrorBoundary extends React.Component<
  PropsWithChildren,
  State
> {
  state: State = {
    error: null,
    retryKey: 0
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error('DMZ Ranked startup failure', error);
  }

  private retry = () => {
    this.setState(state => ({
      error: null,
      retryKey: state.retryKey + 1
    }));
  };

  override render() {
    if (!this.state.error) {
      return (
        <React.Fragment key={this.state.retryKey}>
          {this.props.children}
        </React.Fragment>
      );
    }

    const message =
      this.state.error.message?.trim() || 'Unknown error';

    return (
      <View style={styles.root}>
        <Text style={styles.title}>RANKED CLIENT ERROR</Text>
        <Text style={styles.message}>
          The app hit a startup error instead of closing.
          {'\n\n'}
          {this.state.error.name}: {message}
        </Text>
        <Pressable style={styles.retry} onPress={this.retry}>
          <Text style={styles.retryText}>RETRY DMZ RANKED</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    backgroundColor: colors.black
  },
  title: {
    color: colors.gold,
    fontFamily: condensedFont,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center'
  },
  message: {
    marginVertical: 24,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center'
  },
  retry: {
    minWidth: 220,
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: colors.gold
  },
  retryText: {
    color: colors.black,
    fontWeight: '900',
    letterSpacing: 1
  }
});
