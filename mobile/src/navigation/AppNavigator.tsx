import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../features/auth/AuthProvider';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { DashboardScreen } from '../features/dashboard/screens/DashboardScreen';
import { ExpenseFormScreen } from '../features/expenses/screens/ExpenseFormScreen';
import { ExpensesScreen } from '../features/expenses/screens/ExpensesScreen';
import { FuelScreen } from '../features/fuel/screens/FuelScreen';
import { MaintenanceScreen } from '../features/maintenance/screens/MaintenanceScreen';
import { MileageScreen } from '../features/mileage/screens/MileageScreen';
import { MenuScreen } from '../features/menu/screens/MenuScreen';
import { ObdScreen } from '../features/obd/screens/ObdScreen';
import { ObdCompatibilityScreen } from '../features/obd/screens/ObdCompatibilityScreen';
import { ScanHistoryScreen } from '../features/obd/screens/ScanHistoryScreen';
import { ScanReportScreen } from '../features/obd/screens/ScanReportScreen';
import { WelcomeScreen } from '../features/onboarding/screens/WelcomeScreen';
import { ProfileScreen } from '../features/profile/screens/ProfileScreen';
import { RemindersScreen } from '../features/reminders/screens/RemindersScreen';
import { AllVehiclesScreen } from '../features/vehicles/screens/AllVehiclesScreen';
import { VehicleFormScreen } from '../features/vehicles/screens/VehicleFormScreen';
import { VehicleScreen } from '../features/vehicles/screens/VehicleScreen';
export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Tabs: undefined;
  ExpenseForm: { expenseId?: string } | undefined;
  Obd: undefined;
  ScanHistory: undefined;
  ScanReport: { scanId: string };
  ObdCompatibility: undefined;
  VehicleForm: { vehicleId?: string } | undefined;
  AllVehicles: undefined;
  Profile: undefined;
  Maintenance: { maintenanceId?: string } | undefined;
  Fuel: { fuelEntryId?: string } | undefined;
  Reminders: undefined;
  Mileage: undefined;
};
export type AppTabParamList = {
  Home: undefined;
  Expenses: undefined;
  Vehicle: undefined;
  Menu: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: 'left',
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 72,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const icon = {
            Home: 'home-outline',
            Expenses: 'chart-donut',
            Vehicle: 'car-outline',
            Menu: 'menu',
          }[route.name] as React.ComponentProps<typeof MaterialCommunityIcons>['name'];
          return (
            <MaterialCommunityIcons
              accessibilityLabel={`Ícone de ${route.name}`}
              name={icon}
              color={color}
              size={size}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ headerShown: false, tabBarLabel: 'Início' }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{ title: 'Finanças', tabBarLabel: 'Finanças' }}
      />
      <Tab.Screen
        name="Vehicle"
        component={VehicleScreen}
        options={{ title: 'Veículo', tabBarLabel: 'Veículo' }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{ title: 'Menu', tabBarLabel: 'Menu' }}
      />
    </Tab.Navigator>
  );
}
export function AppNavigator() {
  const { initializing, user } = useAuth();
  if (initializing) return null;
  return (
    <Stack.Navigator key={user ? 'private' : 'public'}>
      {user ? (
        <>
          <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="ExpenseForm"
            component={ExpenseFormScreen}
            options={{ title: 'Novo gasto' }}
          />
          <Stack.Screen
            name="VehicleForm"
            component={VehicleFormScreen}
            options={{ title: 'Veículo' }}
          />
          <Stack.Screen
            name="AllVehicles"
            component={AllVehiclesScreen}
            options={{ title: 'Todos os carros' }}
          />
          <Stack.Screen name="Obd" component={ObdScreen} options={{ title: 'Check-up OBD-II' }} />
          <Stack.Screen
            name="ScanHistory"
            component={ScanHistoryScreen}
            options={{ title: 'Histórico de check-ups' }}
          />
          <Stack.Screen
            name="ScanReport"
            component={ScanReportScreen}
            options={{ title: 'Relatório do check-up' }}
          />
          <Stack.Screen
            name="ObdCompatibility"
            component={ObdCompatibilityScreen}
            options={{ title: 'Compatibilidade OBD' }}
          />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
          <Stack.Screen
            name="Maintenance"
            component={MaintenanceScreen}
            options={{ title: 'Manutenção' }}
          />
          <Stack.Screen name="Fuel" component={FuelScreen} options={{ title: 'Abastecimento' }} />
          <Stack.Screen
            name="Reminders"
            component={RemindersScreen}
            options={{ title: 'Lembretes' }}
          />
          <Stack.Screen
            name="Mileage"
            component={MileageScreen}
            options={{ title: 'Quilometragem' }}
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
