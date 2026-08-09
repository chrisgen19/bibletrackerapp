import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as SQLite from 'expo-sqlite';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/theme-provider';

import { configureConnection, createDatabase, DATABASE_NAME, type Database } from './client';
import migrations from '../../drizzle/migrations';

interface DatabaseHandle {
  readonly db: Database;
  readonly sqlite: SQLite.SQLiteDatabase;
}

let handle: DatabaseHandle | null = null;
let openError: Error | null = null;

/** Opening is idempotent and cached: one connection for the lifetime of the process. */
function openDatabase(): void {
  if (handle !== null || openError !== null) return;
  try {
    const sqlite = SQLite.openDatabaseSync(DATABASE_NAME);
    configureConnection(sqlite);
    handle = { sqlite, db: createDatabase(sqlite) };
  } catch (error) {
    openError = error instanceof Error ? error : new Error(String(error));
  }
}

/** Last-resort recovery: discard the local file so the app can start clean. */
function deleteDatabaseFile(): void {
  try {
    handle?.sqlite.closeSync();
  } catch {
    // Closing can fail if the handle is already broken; deletion is what matters.
  }
  handle = null;
  openError = null;
  SQLite.deleteDatabaseSync(DATABASE_NAME);
}

const DatabaseContext = createContext<Database | null>(null);

export function useDatabase(): Database {
  const db = useContext(DatabaseContext);
  if (db === null) {
    throw new Error('useDatabase must be used inside a DatabaseProvider.');
  }
  return db;
}

/**
 * Opens SQLite and applies migrations before any data-dependent screen renders.
 *
 * Failures surface as plain-language recovery screens; the underlying error is
 * logged for developers but never shown to the user.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    openError = null;
    setAttempt((value) => value + 1);
  }, []);

  const startOver = useCallback(() => {
    Alert.alert(
      'Start over?',
      'This removes the reading data stored on this device. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete and restart',
          style: 'destructive',
          onPress: () => {
            deleteDatabaseFile();
            setAttempt((value) => value + 1);
          },
        },
      ],
    );
  }, []);

  openDatabase();

  if (handle === null) {
    if (openError !== null) {
      console.error('[database] failed to open', openError);
    }
    return <DatabaseFailure onRetry={retry} onStartOver={startOver} />;
  }

  return (
    <MigrationGate key={attempt} handle={handle} onRetry={retry} onStartOver={startOver}>
      {children}
    </MigrationGate>
  );
}

interface MigrationGateProps {
  handle: DatabaseHandle;
  children: ReactNode;
  onRetry: () => void;
  onStartOver: () => void;
}

function MigrationGate({ handle: current, children, onRetry, onStartOver }: MigrationGateProps) {
  const { success, error } = useMigrations(current.db, migrations);

  if (error !== undefined) {
    console.error('[database] migration failed', error);
    return <DatabaseFailure onRetry={onRetry} onStartOver={onStartOver} />;
  }

  if (!success) return <DatabaseLoading />;

  return <DatabaseContext.Provider value={current.db}>{children}</DatabaseContext.Provider>;
}

function DatabaseLoading() {
  const theme = useTheme();
  return (
    <Screen>
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.textTertiary} />
      </View>
    </Screen>
  );
}

function DatabaseFailure({ onRetry, onStartOver }: { onRetry: () => void; onStartOver: () => void }) {
  const theme = useTheme();
  return (
    <Screen>
      <View style={styles.centered}>
        <EmptyState
          icon="book.closed"
          title="We couldn't open your reading data"
          description="Something went wrong loading the app's storage on this device. Trying again usually fixes it."
          action={{ label: 'Try Again', onPress: onRetry }}
        />
        <Button
          label="Reset app data"
          variant="ghost"
          size="medium"
          onPress={onStartOver}
          accessibilityHint="Deletes reading data stored on this device"
          style={{ marginTop: theme.spacing.sm }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
});
