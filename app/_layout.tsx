import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text } from 'react-native';
import { Suspense, type ReactNode } from 'react';

function DBProvider({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    // Web: no SQLite — useTasks() switches to in-memory store automatically
    return <>{children}</>;
  }

  // Native: wrap with SQLiteProvider
  const { SQLiteProvider } = require('expo-sqlite');
  const { initDatabase } = require('../src/db/init');
  return (
    <Suspense fallback={
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' }}>
        <Text style={{ fontSize: 18, color: '#b0aa9f' }}>...</Text>
      </View>
    }>
      <SQLiteProvider databaseName="mihaku.db" onInit={initDatabase}>
        {children}
      </SQLiteProvider>
    </Suspense>
  );
}

export default function RootLayout() {
  return (
    <DBProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </DBProvider>
  );
}
