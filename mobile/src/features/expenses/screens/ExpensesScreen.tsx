import { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppInput } from '../../../components/AppInput';
import { QuickAddSheet } from '../../../components/QuickAddSheet';
import { useAppData } from '../../../data/AppDataProvider';
import type { FinancialTransaction } from '../../../data/types';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { categoryTotals, totalOf, type Period } from '../../dashboard/metrics';
import { colors } from '../../../theme/colors';

type FinancePeriod = Exclude<Period, 'previous'> | 'custom';
type DateRange = { start: string; endExclusive: string };

const money = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const transactionIcon = {
  fuel: 'gas-station-outline',
  maintenance: 'wrench-outline',
  expense: 'receipt-text-outline',
} as const;
const options: Array<[FinancePeriod, string]> = [
  ['current', 'Este mês'],
  ['threeMonths', '3 meses'],
  ['year', 'Ano'],
  ['custom', 'Personalizado'],
  ['all', 'Tudo'],
];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function rangeForPeriod(
  period: Exclude<FinancePeriod, 'custom'>,
  date = new Date(),
): DateRange | null {
  const currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  if (period === 'all') return null;
  if (period === 'current') {
    return {
      start: dateKey(currentMonth),
      endExclusive: dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 1)),
    };
  }
  if (period === 'threeMonths') {
    return {
      start: dateKey(new Date(date.getFullYear(), date.getMonth() - 2, 1)),
      endExclusive: dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 1)),
    };
  }
  return {
    start: dateKey(new Date(date.getFullYear(), 0, 1)),
    endExclusive: dateKey(new Date(date.getFullYear() + 1, 0, 1)),
  };
}

function previousRangeFor(period: FinancePeriod, date = new Date()): DateRange | null {
  if (period === 'current') {
    return {
      start: dateKey(new Date(date.getFullYear(), date.getMonth() - 1, 1)),
      endExclusive: dateKey(new Date(date.getFullYear(), date.getMonth(), 1)),
    };
  }
  if (period === 'threeMonths') {
    return {
      start: dateKey(new Date(date.getFullYear(), date.getMonth() - 5, 1)),
      endExclusive: dateKey(new Date(date.getFullYear(), date.getMonth() - 2, 1)),
    };
  }
  if (period === 'year') {
    return {
      start: dateKey(new Date(date.getFullYear() - 1, 0, 1)),
      endExclusive: dateKey(new Date(date.getFullYear(), 0, 1)),
    };
  }
  return null;
}

function transactionsInRange(transactions: FinancialTransaction[], range: DateRange | null) {
  if (!range) return transactions;
  return transactions.filter((transaction) => {
    const occurredAt = transaction.occurredAt.slice(0, 10);
    return occurredAt >= range.start && occurredAt < range.endExclusive;
  });
}

function transactionTitle(transaction: FinancialTransaction, maintenanceById: Map<string, string>) {
  if (transaction.type === 'fuel') return 'Abastecimento';
  if (transaction.type === 'maintenance') {
    return maintenanceById.get(transaction.sourceEntityId ?? '') || 'Manutenção';
  }
  return transaction.category;
}

export function ExpensesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeTransactions, activeVehicle, maintenance } = useAppData();
  const [period, setPeriod] = useState<FinancePeriod>('current');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customStart, setCustomStart] = useState(() =>
    dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [customEnd, setCustomEnd] = useState(() => dateKey(new Date()));
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const range = period === 'custom' ? null : rangeForPeriod(period);
  const periodTransactions = useMemo(() => {
    if (period !== 'custom') return transactionsInRange(activeTransactions, range);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customStart) || !/^\d{4}-\d{2}-\d{2}$/.test(customEnd)) {
      return [];
    }
    return activeTransactions.filter((transaction) => {
      const occurredAt = transaction.occurredAt.slice(0, 10);
      return occurredAt >= customStart && occurredAt <= customEnd;
    });
  }, [activeTransactions, customEnd, customStart, period, range]);
  const categories = categoryTotals(periodTransactions);
  const visible = selectedCategory
    ? periodTransactions.filter((transaction) => transaction.category === selectedCategory)
    : periodTransactions;
  const total = totalOf(periodTransactions);
  const previousRange = previousRangeFor(period);
  const previous = previousRange
    ? totalOf(transactionsInRange(activeTransactions, previousRange))
    : null;
  const comparison = previous ? ((total - previous) / previous) * 100 : null;
  const maintenanceById = useMemo(
    () => new Map(maintenance.map((item) => [item.id, item.serviceType])),
    [maintenance],
  );
  const months = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 4 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - (3 - index), 1);
      const rangeForMonth: DateRange = {
        start: dateKey(date),
        endExclusive: dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 1)),
      };
      return {
        label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        total: totalOf(transactionsInRange(activeTransactions, rangeForMonth)),
      };
    });
  }, [activeTransactions]);
  const highestMonth = Math.max(...months.map((month) => month.total), 1);
  const odometers = periodTransactions
    .map((transaction) => transaction.odometerKm)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const kilometers = odometers.length > 1 ? odometers[odometers.length - 1] - odometers[0] : 0;
  const costPerKm = kilometers > 0 ? total / 100 / kilometers : null;
  const periodName = options.find(([value]) => value === period)?.[1] ?? 'Período';

  function openTransaction(transaction: FinancialTransaction) {
    if (!transaction.sourceEntityId) {
      Alert.alert('Detalhes indisponíveis', 'Este lançamento não possui uma origem editável.');
      return;
    }
    if (transaction.sourceEntityType === 'fuel') {
      navigation.navigate('Fuel', { fuelEntryId: transaction.sourceEntityId });
      return;
    }
    if (transaction.sourceEntityType === 'maintenance') {
      navigation.navigate('Maintenance', { maintenanceId: transaction.sourceEntityId });
      return;
    }
    navigation.navigate('ExpenseForm', { expenseId: transaction.sourceEntityId });
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.vehicle}>
        {activeVehicle
          ? `${activeVehicle.model}${activeVehicle.odometerKm ? ` · ${activeVehicle.odometerKm.toLocaleString('pt-BR')} km` : ''}`
          : 'Selecione um veículo'}
      </Text>
      <View style={styles.periods}>
        {options.map(([option, label]) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: option === period }}
            key={option}
            onPress={() => setPeriod(option)}
            style={[styles.period, option === period && styles.periodSelected]}
          >
            <Text style={[styles.periodText, option === period && styles.periodTextSelected]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {period === 'custom' ? (
        <View style={styles.customDates}>
          <AppInput
            label="Data inicial"
            value={customStart}
            onChangeText={setCustomStart}
            placeholder="AAAA-MM-DD"
          />
          <AppInput
            label="Data final"
            value={customEnd}
            onChangeText={setCustomEnd}
            placeholder="AAAA-MM-DD"
          />
        </View>
      ) : null}
      <View style={styles.totalCard}>
        <Text style={styles.cardLabel}>TOTAL · {periodName.toUpperCase()}</Text>
        <Text style={styles.amount}>{money(total)}</Text>
        <Text style={styles.cardText}>
          {comparison === null
            ? 'Sem comparação suficiente neste período.'
            : `${comparison >= 0 ? '↑' : '↓'} ${Math.abs(comparison).toFixed(0)}% em relação ao período anterior`}
        </Text>
      </View>
      <View style={styles.indicators}>
        <View style={styles.indicator}>
          <Text style={styles.indicatorLabel}>LANÇAMENTOS</Text>
          <Text style={styles.indicatorValue}>{periodTransactions.length}</Text>
        </View>
        <View style={styles.indicator}>
          <Text style={styles.indicatorLabel}>CUSTO / KM</Text>
          <Text style={styles.indicatorValue}>
            {costPerKm === null ? '—' : money(Math.round(costPerKm * 100))}
          </Text>
        </View>
      </View>
      {categories.length ? (
        <View style={styles.section}>
          <Text style={styles.heading}>Categorias</Text>
          {categories.map(([category, totalForCategory]) => (
            <Pressable
              key={category}
              onPress={() =>
                setSelectedCategory((currentCategory) =>
                  currentCategory === category ? null : category,
                )
              }
              style={styles.category}
            >
              <View style={styles.categoryRow}>
                <Text
                  style={[
                    styles.rowTitle,
                    selectedCategory === category && styles.categorySelected,
                  ]}
                >
                  {category}
                </Text>
                <Text style={styles.rowTitle}>
                  {money(totalForCategory)} · {Math.round((totalForCategory / total) * 100)}%
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    { width: `${Math.max(5, Math.round((totalForCategory / total) * 100))}%` },
                  ]}
                />
              </View>
            </Pressable>
          ))}
          {selectedCategory ? (
            <Pressable onPress={() => setSelectedCategory(null)}>
              <Text style={styles.link}>Limpar filtro de categoria</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.section}>
        <Text style={styles.heading}>Evolução mensal</Text>
        <View style={styles.chart}>
          {months.map((month) => (
            <View key={month.label} style={styles.month}>
              <View style={styles.monthTrack}>
                <View
                  style={[
                    styles.monthBar,
                    { height: `${Math.max(4, (month.total / highestMonth) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.monthLabel}>{month.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.sectionTop}>
        <View>
          <Text style={styles.heading}>Histórico</Text>
          <Text style={styles.muted}>Toque para ver ou editar</Text>
        </View>
        <Text style={styles.muted}>{visible.length} lançamento(s)</Text>
      </View>
      {visible.length ? (
        visible.map((transaction) => (
          <Pressable
            key={transaction.id}
            accessibilityRole="button"
            accessibilityHint="Abre os detalhes para editar ou excluir"
            onPress={() => openTransaction(transaction)}
            style={styles.item}
          >
            <View style={styles.icon}>
              <MaterialCommunityIcons
                color={colors.primary}
                name={transactionIcon[transaction.type]}
                size={20}
              />
            </View>
            <View style={styles.itemCopy}>
              <Text style={styles.rowTitle}>{transactionTitle(transaction, maintenanceById)}</Text>
              <Text style={styles.muted}>
                {transaction.occurredAt}
                {transaction.supplierOrWorkshop ? ` · ${transaction.supplierOrWorkshop}` : ''}
              </Text>
            </View>
            <View style={styles.end}>
              <Text style={styles.rowTitle}>{money(transaction.amountCents)}</Text>
              <MaterialCommunityIcons color={colors.muted} name="chevron-right" size={18} />
            </View>
          </Pressable>
        ))
      ) : (
        <View style={styles.empty}>
          <Text style={styles.rowTitle}>Nenhum custo neste período</Text>
          <Text style={styles.muted}>Registre abastecimentos, manutenção ou outras despesas.</Text>
        </View>
      )}
      <Pressable
        disabled={!activeVehicle}
        onPress={() => setQuickAddOpen(true)}
        style={[styles.add, !activeVehicle && styles.disabled]}
      >
        <MaterialCommunityIcons color={colors.surface} name="plus" size={21} />
        <Text style={styles.addText}>Registrar lançamento</Text>
      </Pressable>
      <QuickAddSheet
        visible={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        navigation={navigation}
      />
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
  vehicle: { color: colors.muted, fontSize: 16 },
  periods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  period: {
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  periodSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  periodTextSelected: { color: colors.surface },
  customDates: { backgroundColor: colors.surface, borderRadius: 16, gap: 14, padding: 16 },
  totalCard: { backgroundColor: colors.primaryDark, borderRadius: 18, gap: 8, padding: 22 },
  cardLabel: { color: '#B3ECFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  amount: { color: colors.surface, fontSize: 34, fontWeight: '800' },
  cardText: { color: '#D9E2EC', fontSize: 14 },
  indicators: { flexDirection: 'row', gap: 10 },
  indicator: { backgroundColor: colors.surface, borderRadius: 14, flex: 1, gap: 5, padding: 15 },
  indicatorLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  indicatorValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
  section: { backgroundColor: colors.surface, borderRadius: 16, gap: 12, padding: 18 },
  heading: { color: colors.text, fontSize: 19, fontWeight: '800' },
  category: { gap: 7 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  categorySelected: { color: colors.primary },
  track: { backgroundColor: '#EAF0F5', borderRadius: 4, height: 7, overflow: 'hidden' },
  bar: { backgroundColor: colors.primary, borderRadius: 4, height: 7 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  chart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 14,
    height: 130,
    justifyContent: 'space-around',
  },
  month: { alignItems: 'center', flex: 1, gap: 7, height: 130 },
  monthTrack: {
    backgroundColor: '#EAF0F5',
    borderRadius: 5,
    height: 102,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 22,
  },
  monthBar: { backgroundColor: colors.primary, borderRadius: 5, width: 22 },
  monthLabel: { color: colors.muted, fontSize: 12, textTransform: 'capitalize' },
  sectionTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  item: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    padding: 15,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: '#E6F4FE',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  itemCopy: { flex: 1, gap: 2 },
  end: { alignItems: 'flex-end', flexDirection: 'row', gap: 3 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  empty: { backgroundColor: colors.surface, borderRadius: 14, gap: 6, padding: 18 },
  add: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    padding: 17,
  },
  addText: { color: colors.surface, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
