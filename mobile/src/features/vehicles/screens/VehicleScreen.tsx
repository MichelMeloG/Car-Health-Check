import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../../components/AppButton';
import { useAppData } from '../../../data/AppDataProvider';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const money = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function VehicleScreen() {
  const navigation = useNavigation<Nav>();
  const { activeVehicle, fuelEntries, reminders, scanSessions } = useAppData();
  if (!activeVehicle)
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Nenhum veículo selecionado</Text>
          <Text style={styles.muted}>Cadastre um veículo para organizar custos e check-ups.</Text>
          <AppButton title="Adicionar veículo" onPress={() => navigation.navigate('VehicleForm')} />
        </View>
      </ScrollView>
    );
  const lastFuel = fuelEntries.find((entry) => entry.vehicleId === activeVehicle.id);
  const nextReminder = reminders.find(
    (reminder) => reminder.vehicleId === activeVehicle.id && !reminder.completed,
  );
  const latestScan = scanSessions.find((scan) => scan.vehicleId === activeVehicle.id);
  const technical = [
    activeVehicle.year,
    activeVehicle.engine,
    activeVehicle.transmission,
    activeVehicle.fuel,
  ]
    .filter(Boolean)
    .join(' · ');
  const sections: Array<{
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    title: string;
    detail: string;
    route: keyof Pick<
      RootStackParamList,
      'Maintenance' | 'Fuel' | 'Reminders' | 'Obd' | 'ScanHistory' | 'VehicleForm'
    >;
  }> = [
    {
      icon: 'wrench-outline',
      title: 'Plano de manutenção',
      detail: nextReminder?.title ?? 'Nenhuma tarefa pendente',
      route: 'Maintenance',
    },
    {
      icon: 'gas-station-outline',
      title: 'Abastecimento',
      detail: lastFuel
        ? `${money(lastFuel.totalCents)} · ${lastFuel.occurredAt}`
        : 'Nenhum abastecimento registrado',
      route: 'Fuel',
    },
    {
      icon: 'car-cog',
      title: 'Diagnóstico OBD',
      detail: latestScan
        ? `Último check-up: ${latestScan.capturedAt.slice(0, 10)}`
        : 'Ainda sem check-up',
      route: 'Obd',
    },
    {
      icon: 'chart-timeline-variant',
      title: 'Histórico de check-ups',
      detail: latestScan
        ? `${scanSessions.filter((scan) => scan.vehicleId === activeVehicle.id).length} sessão(ões) salvas`
        : 'Compare sessões para formar uma linha de base',
      route: 'ScanHistory',
    },
    {
      icon: 'car-info',
      title: 'Dados do veículo',
      detail: 'Identidade e especificações técnicas',
      route: 'VehicleForm',
    },
  ];
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.vehicleIcon}>
          <MaterialCommunityIcons color={colors.surface} name="car-side" size={34} />
        </View>
        <Text style={styles.title}>{activeVehicle.nickname || activeVehicle.model}</Text>
        <Text style={styles.muted}>{technical || 'Complete os dados técnicos do veículo'}</Text>
        <Text style={styles.odometer}>
          {activeVehicle.odometerKm
            ? `${activeVehicle.odometerKm.toLocaleString('pt-BR')} km`
            : 'Quilometragem não informada'}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={() => navigation.navigate('Obd')}>
          <MaterialCommunityIcons color={colors.surface} name="car-cog" size={20} />
          <Text style={styles.primaryText}>Check-up OBD</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => navigation.navigate('Maintenance')}>
          <MaterialCommunityIcons color={colors.primary} name="wrench-outline" size={20} />
          <Text style={styles.secondaryText}>Manutenção</Text>
        </Pressable>
      </View>
      <Text style={styles.heading}>Status e histórico</Text>
      <View style={styles.list}>
        {sections.map((section) => (
          <Pressable
            key={section.title}
            onPress={() => navigation.navigate(section.route as never)}
            style={styles.row}
          >
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons color={colors.primary} name={section.icon} size={21} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.rowTitle}>{section.title}</Text>
              <Text style={styles.muted}>{section.detail}</Text>
            </View>
            <MaterialCommunityIcons color={colors.muted} name="chevron-right" size={22} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    gap: 18,
    padding: 24,
    paddingBottom: 32,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    gap: 7,
    padding: 24,
  },
  vehicleIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  odometer: { color: colors.primary, fontSize: 15, fontWeight: '800', marginTop: 5 },
  actions: { flexDirection: 'row', gap: 10 },
  primary: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    padding: 15,
  },
  primaryText: { color: colors.surface, fontSize: 15, fontWeight: '800' },
  secondary: {
    alignItems: 'center',
    backgroundColor: '#E6F4FE',
    borderRadius: 14,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    padding: 15,
  },
  secondaryText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  heading: { color: colors.text, fontSize: 19, fontWeight: '800' },
  list: { backgroundColor: colors.surface, borderRadius: 16 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: '#E6F4FE',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copy: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderRadius: 16, gap: 12, padding: 20 },
});
