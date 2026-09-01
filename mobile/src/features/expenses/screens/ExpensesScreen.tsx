import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../../../components/AppButton';
import { useAppData } from '../../../data/AppDataProvider';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Expenses'>;

const currency = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ExpensesScreen({ navigation }: Props) {
  const { expenses, deleteExpense, loading, syncError } = useAppData();
  const month = new Date().toISOString().slice(0, 7);
  const monthlyTotal = expenses
    .filter((expense) => expense.occurredAt.startsWith(month))
    .reduce((total, expense) => total + expense.amountCents, 0);

  function confirmDelete(id: string) {
    Alert.alert('Excluir gasto?', 'Essa ação não poderá ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void deleteExpense(id) },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.label}>TOTAL DO MÊS</Text>
        <Text style={styles.amount}>{currency(monthlyTotal)}</Text>
      </View>
      {syncError ? <Text style={styles.error}>{syncError}</Text> : null}
      {loading ? (
        <View style={styles.empty} accessibilityLabel="Carregando gastos">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.description}>Carregando seus gastos…</Text>
        </View>
      ) : expenses.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.title}>Nenhum gasto ainda</Text>
          <Text style={styles.description}>
            Registre abastecimentos, manutenções e outros custos do carro.
          </Text>
          <AppButton title="Adicionar gasto" onPress={() => navigation.navigate('ExpenseForm')} />
        </View>
      ) : (
        <View style={styles.list}>
          {expenses.map((expense) => (
            <Pressable
              key={expense.id}
              accessibilityRole="button"
              accessibilityLabel={`${expense.category}, ${currency(expense.amountCents)}, ${expense.occurredAt}`}
              accessibilityHint="Toque e segure para excluir este gasto"
              onLongPress={() => confirmDelete(expense.id)}
              style={styles.item}
            >
              <View>
                <Text style={styles.itemTitle}>{expense.category}</Text>
                <Text style={styles.itemMeta}>
                  {expense.occurredAt}
                  {expense.description ? ` · ${expense.description}` : ''}
                </Text>
              </View>
              <Text style={styles.itemAmount}>{currency(expense.amountCents)}</Text>
            </Pressable>
          ))}
          <AppButton title="Adicionar gasto" onPress={() => navigation.navigate('ExpenseForm')} />
          <Text style={styles.hint}>Toque e segure um lançamento para excluir.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 24, padding: 24 },
  summary: { backgroundColor: colors.surface, borderRadius: 16, gap: 8, padding: 20 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  amount: { color: colors.text, fontSize: 30, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 14, marginTop: 48 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  list: { gap: 12 },
  item: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  itemMeta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  itemAmount: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  error: { color: '#B42318', fontSize: 14, lineHeight: 20 },
});
