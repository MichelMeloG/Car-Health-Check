import { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { QuickAddSheet } from '../../../components/QuickAddSheet';
import { useAppData } from '../../../data/AppDataProvider';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { useAuth } from '../../auth/AuthProvider';
import { filterExpenses, totalOf } from '../metrics';
import { colors } from '../../../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const money = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const {
    activeVehicle,
    activeTransactions,
    vehicles,
    selectVehicle,
    loading,
    syncError,
    healthFindings,
    maintenance,
    reminders,
    scanSessions,
  } = useAppData();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const thisMonth = totalOf(filterExpenses(activeTransactions, 'current'));
  const previousMonth = totalOf(filterExpenses(activeTransactions, 'previous'));
  const recent = useMemo(() => activeTransactions.slice(0, 3), [activeTransactions]);
  const activeScans = scanSessions.filter((scan) => scan.vehicleId === activeVehicle?.id);
  const maintenanceById = useMemo(
    () => new Map(maintenance.map((item) => [item.id, item.serviceType])),
    [maintenance],
  );
  const priorityFinding = healthFindings
    .slice()
    .sort(
      (left, right) =>
        ({ high: 3, medium: 2, low: 1 })[right.severity] -
        { high: 3, medium: 2, low: 1 }[left.severity],
    )[0];
  const healthColor = priorityFinding
    ? priorityFinding.severity === 'high'
      ? '#B42318'
      : priorityFinding.severity === 'medium'
        ? '#D97706'
        : colors.primary
    : '#15803D';
  const upcoming = reminders.find(
    (reminder) => reminder.vehicleId === activeVehicle?.id && !reminder.completed,
  );
  const name = user?.displayName?.trim() || 'Olá';
  const comparison = previousMonth ? ((thisMonth - previousMonth) / previousMonth) * 100 : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Car Health</Text>
          <Text style={styles.greeting}>
            {name === 'Olá' ? 'Seu carro, mais previsível.' : `Olá, ${name}`}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Abrir perfil"
          onPress={() => navigation.navigate('Profile')}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {(user?.displayName?.[0] ?? user?.email?.[0] ?? 'C').toUpperCase()}
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setSelectorOpen(true)}
        style={styles.selector}
      >
        <View>
          <Text style={styles.selectorLabel}>VEÍCULO ATIVO</Text>
          <Text style={styles.selectorText}>
            {activeVehicle
              ? `${activeVehicle.model}${activeVehicle.odometerKm ? ` · ${activeVehicle.odometerKm.toLocaleString('pt-BR')} km` : ''}`
              : 'Cadastre um veículo'}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-down" color={colors.muted} size={24} />
      </Pressable>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : activeVehicle ? (
        <>
          <View style={styles.healthCard}>
            <View style={styles.sectionTop}>
              <View>
                <Text style={styles.sectionTitle}>Saúde do veículo</Text>
                <Text style={styles.muted}>
                  {healthFindings.length
                    ? 'Há itens para acompanhar'
                    : activeScans.length
                      ? 'Sem achados críticos na última leitura'
                      : 'Ainda sem linha de base'}
                </Text>
              </View>
              <MaterialCommunityIcons
                color={healthColor}
                name={healthFindings.length ? 'alert-circle-outline' : 'heart-pulse'}
                size={28}
              />
            </View>
            {priorityFinding ? (
              <Text key={priorityFinding.id} style={styles.finding}>
                {priorityFinding.title} · {priorityFinding.nextStep}
              </Text>
            ) : null}
            {!activeScans.length ? (
              <Pressable onPress={() => navigation.navigate('Obd')}>
                <Text style={styles.link}>Fazer check-up OBD</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.costCard}>
            <Text style={styles.cardLabel}>CUSTO · ESTE MÊS</Text>
            <Text style={styles.amount}>{money(thisMonth)}</Text>
            <Text style={styles.cardText}>
              {comparison === null
                ? 'Registre eventos para acompanhar sua evolução.'
                : `${comparison >= 0 ? '↑' : '↓'} ${Math.abs(comparison).toFixed(0)}% em relação ao mês anterior`}
            </Text>
          </View>
          {upcoming ? (
            <Pressable style={styles.pending} onPress={() => navigation.navigate('Reminders')}>
              <MaterialCommunityIcons
                name="calendar-clock-outline"
                color={colors.primary}
                size={22}
              />
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>Próxima pendência</Text>
                <Text style={styles.muted}>{upcoming.title}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" color={colors.muted} size={22} />
            </Pressable>
          ) : null}
          <View style={styles.sectionTop}>
            <Text style={styles.sectionTitle}>Atividade recente</Text>
            <Text style={styles.muted}>Veja tudo em Finanças</Text>
          </View>
          {recent.length ? (
            recent.map((transaction) => (
              <View key={transaction.id} style={styles.activity}>
                <View style={styles.typeIcon}>
                  <MaterialCommunityIcons
                    color={colors.primary}
                    name={
                      transaction.type === 'fuel'
                        ? 'gas-station-outline'
                        : transaction.type === 'maintenance'
                          ? 'wrench-outline'
                          : 'receipt-text-outline'
                    }
                    size={20}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>
                    {transaction.type === 'fuel'
                      ? 'Abastecimento'
                      : transaction.type === 'maintenance'
                        ? maintenanceById.get(transaction.sourceEntityId ?? '') || 'Manutenção'
                        : transaction.category}
                  </Text>
                  <Text style={styles.muted}>{transaction.occurredAt}</Text>
                </View>
                <Text style={styles.rowTitle}>{money(transaction.amountCents)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>Nenhum custo registrado ainda.</Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => setQuickAddOpen(true)}
            style={styles.primaryAction}
          >
            <MaterialCommunityIcons name="plus" color={colors.surface} size={22} />
            <Text style={styles.primaryActionText}>Registrar</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.healthCard}>
          <Text style={styles.sectionTitle}>Comece pela garagem</Text>
          <Text style={styles.muted}>
            Cadastre um veículo para acompanhar custos, manutenção e saúde.
          </Text>
          <Pressable onPress={() => navigation.navigate('VehicleForm')}>
            <Text style={styles.link}>Adicionar veículo</Text>
          </Pressable>
        </View>
      )}
      {syncError ? <Text style={styles.error}>{syncError}</Text> : null}
      <QuickAddSheet
        visible={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        navigation={navigation}
      />
      <Modal
        visible={selectorOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectorOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelectorOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Selecionar veículo</Text>
            {vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.id}
                style={styles.vehicleRow}
                onPress={() => {
                  void selectVehicle(vehicle.id);
                  setSelectorOpen(false);
                }}
              >
                <Text style={styles.rowTitle}>
                  {vehicle.id === activeVehicle?.id ? '✓  ' : ''}
                  {vehicle.model}
                </Text>
                <Text style={styles.muted}>
                  {vehicle.odometerKm
                    ? `${vehicle.odometerKm.toLocaleString('pt-BR')} km`
                    : 'Quilometragem não informada'}
                </Text>
              </Pressable>
            ))}
            <View style={styles.divider} />
            <Pressable
              style={styles.vehicleRow}
              onPress={() => {
                setSelectorOpen(false);
                navigation.navigate('AllVehicles');
              }}
            >
              <Text style={styles.rowTitle}>Ver resumo de todos os carros</Text>
            </Pressable>
            <Pressable
              style={styles.vehicleRow}
              onPress={() => {
                setSelectorOpen(false);
                navigation.navigate('VehicleForm');
              }}
            >
              <Text style={styles.link}>+ Adicionar veículo</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    gap: 16,
    padding: 24,
    paddingBottom: 36,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  brand: { color: colors.text, fontSize: 26, fontWeight: '800' },
  greeting: { color: colors.muted, fontSize: 15, marginTop: 3 },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: { color: colors.surface, fontSize: 17, fontWeight: '800' },
  selector: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  selectorLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  selectorText: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 3 },
  loading: { padding: 42 },
  healthCard: { backgroundColor: colors.surface, borderRadius: 18, gap: 12, padding: 20 },
  sectionTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  finding: { color: colors.text, fontSize: 14, lineHeight: 21 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  costCard: { backgroundColor: colors.primaryDark, borderRadius: 18, gap: 8, padding: 22 },
  cardLabel: { color: '#B3ECFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  amount: { color: colors.surface, fontSize: 34, fontWeight: '800' },
  cardText: { color: '#D9E2EC', fontSize: 14 },
  pending: {
    alignItems: 'center',
    backgroundColor: '#FFF7E6',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  flex: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  activity: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    padding: 15,
  },
  typeIcon: {
    alignItems: 'center',
    backgroundColor: '#E6F4FE',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    padding: 17,
  },
  primaryActionText: { color: colors.surface, fontSize: 16, fontWeight: '800' },
  error: { color: '#B42318', fontSize: 13 },
  backdrop: { backgroundColor: '#0008', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  sheetTitle: { color: colors.text, fontSize: 21, fontWeight: '800', marginBottom: 8 },
  vehicleRow: { gap: 4, paddingVertical: 14 },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: 8 },
});
