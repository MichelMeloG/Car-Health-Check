import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { useAuth } from '../features/auth/AuthProvider';
import { DashboardScreen } from '../features/dashboard/screens/DashboardScreen';
import { ExpensesScreen } from '../features/expenses/screens/ExpensesScreen';
import { ExpenseFormScreen } from '../features/expenses/screens/ExpenseFormScreen';
import { ObdScreen } from '../features/obd/screens/ObdScreen';
import { WelcomeScreen } from '../features/onboarding/screens/WelcomeScreen';
import { VehicleScreen } from '../features/vehicles/screens/VehicleScreen';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Dashboard: undefined;
  Expenses: undefined;
  ExpenseForm: undefined;
  Obd: undefined;
  Vehicle: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { initializing, user } = useAuth();

  if (initializing) return null;

  return (
    <Stack.Navigator key={user ? 'private' : 'public'}>
      {user ? (
        <>
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: 'Car Health' }}
          />
          <Stack.Screen name="Expenses" component={ExpensesScreen} options={{ title: 'Gastos' }} />
          <Stack.Screen
            name="ExpenseForm"
            component={ExpenseFormScreen}
            options={{ title: 'Novo gasto' }}
          />
          <Stack.Screen name="Obd" component={ObdScreen} options={{ title: 'Check-up OBD-II' }} />
          <Stack.Screen
            name="Vehicle"
            component={VehicleScreen}
            options={{ title: 'Meu veículo' }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Entrar' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
