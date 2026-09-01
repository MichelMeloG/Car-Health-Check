import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';

import { AppDataProvider } from './src/data/AppDataProvider';
import { migrateDbIfNeeded } from './src/data/database';
import { AuthProvider } from './src/features/auth/AuthProvider';
import { ObdProvider } from './src/features/obd/ObdProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import './src/services/firebase';

export default function App() {
  return (
    <SQLiteProvider databaseName="car-health.db" onInit={migrateDbIfNeeded}>
      <AuthProvider>
        <AppDataProvider>
          <ObdProvider>
            <NavigationContainer>
              <AppNavigator />
              <StatusBar style="auto" />
            </NavigationContainer>
          </ObdProvider>
        </AppDataProvider>
      </AuthProvider>
    </SQLiteProvider>
  );
}
