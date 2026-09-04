import { NavigationContainer } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppDataProvider } from './src/data/AppDataProvider';
import { migrateDbIfNeeded } from './src/data/database';
import { AuthProvider } from './src/features/auth/AuthProvider';
import { ObdProvider } from './src/features/obd/ObdProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import './src/services/firebase';

function AppContent() {
  const [iconsReady, setIconsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void MaterialCommunityIcons.loadFont().finally(() => {
      if (mounted) setIconsReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!iconsReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#176B87" size="small" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AppNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SQLiteProvider databaseName="car-health.db" onInit={migrateDbIfNeeded}>
      <AuthProvider>
        <AppDataProvider>
          <ObdProvider>
            <AppContent />
          </ObdProvider>
        </AppDataProvider>
      </AuthProvider>
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: '#F5F7FA', flex: 1, justifyContent: 'center' },
});
