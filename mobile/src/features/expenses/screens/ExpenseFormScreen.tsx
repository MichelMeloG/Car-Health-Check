import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { useAppData } from '../../../data/AppDataProvider';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseForm'>;

function parseDate(value: string) {
  const brazilianDate = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return brazilianDate
    ? `${brazilianDate[3]}-${brazilianDate[2]}-${brazilianDate[1]}`
    : value.trim();
}

function parseAmount(value: string) {
  const normalized = value.replace(/R\$\s?/i, '').trim();
  return Number(
    normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized,
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const amountText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

export function ExpenseFormScreen({ navigation, route }: Props) {
  const { addExpense, updateExpense, deleteTransaction, expenses, transactions } = useAppData();
  const existing = useMemo(
    () => expenses.find((expense) => expense.id === route.params?.expenseId),
    [expenses, route.params?.expenseId],
  );
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(today());
  const [supplier, setSupplier] = useState('');
  const [odometer, setOdometer] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setAmount(amountText(existing.amountCents));
    setCategory(existing.category);
    setDate(existing.occurredAt);
    setSupplier(existing.supplier ?? '');
    setOdometer(existing.odometerKm?.toString() ?? '');
    setDescription(existing.description);
  }, [existing]);

  async function handleSubmit() {
    if (!amount || !category.trim() || !date.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha valor, categoria e data.');
      return;
    }
    const parsedAmount = parseAmount(amount);
    const parsedOdometer = odometer ? Number.parseInt(odometer, 10) : null;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero.');
      return;
    }
    if (parsedOdometer !== null && (!Number.isInteger(parsedOdometer) || parsedOdometer < 0)) {
      Alert.alert('Quilometragem inválida', 'Informe uma quilometragem válida.');
      return;
    }

    setSaving(true);
    try {
      const input = {
        amountCents: Math.round(parsedAmount * 100),
        category: category.trim(),
        occurredAt: parseDate(date),
        supplier: supplier.trim() || undefined,
        odometerKm: parsedOdometer,
        description: description.trim(),
      };
      if (existing) await updateExpense(existing.id, input);
      else await addExpense(input);
      Alert.alert(
        existing ? 'Lançamento atualizado' : 'Lançamento salvo',
        'O histórico financeiro foi atualizado e será sincronizado automaticamente.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!existing) return;
    const transaction = transactions.find(
      (item) => item.sourceEntityType === 'expense' && item.sourceEntityId === existing.id,
    );
    if (!transaction) {
      Alert.alert('Lançamento indisponível', 'Não foi possível localizar o lançamento financeiro.');
      return;
    }
    Alert.alert(
      'Excluir lançamento?',
      'Ele será removido do histórico e sincronizado nos seus dispositivos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void deleteTransaction(transaction.id).then(() => navigation.goBack());
          },
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{existing ? 'Editar lançamento' : 'Novo lançamento'}</Text>
      <Text style={styles.description}>
        {existing
          ? 'Altere os dados deste custo. Os totais e categorias serão recalculados.'
          : 'Seguro, IPVA, pedágio e outras despesas entram no mesmo histórico financeiro.'}
      </Text>
      <View style={styles.form}>
        <AppInput
          keyboardType="decimal-pad"
          label="Valor"
          onChangeText={setAmount}
          placeholder="R$ 0,00"
          value={amount}
        />
        <AppInput
          label="Categoria"
          onChangeText={setCategory}
          placeholder="Ex.: Seguro, IPVA, Pedágio"
          value={category}
        />
        <AppInput label="Data" onChangeText={setDate} placeholder="AAAA-MM-DD" value={date} />
        <AppInput
          label="Fornecedor (opcional)"
          onChangeText={setSupplier}
          placeholder="Ex.: Seguradora, estacionamento"
          value={supplier}
        />
        <AppInput
          keyboardType="numeric"
          label="Quilometragem (opcional)"
          onChangeText={setOdometer}
          placeholder="187320"
          value={odometer}
        />
        <AppInput
          label="Observação (opcional)"
          onChangeText={setDescription}
          placeholder="Detalhes do gasto"
          value={description}
        />
        <AppButton
          disabled={saving}
          title={saving ? 'Salvando…' : existing ? 'Salvar alterações' : 'Salvar lançamento'}
          onPress={() => void handleSubmit()}
        />
        {existing ? (
          <AppButton title="Excluir lançamento" variant="secondary" onPress={handleDelete} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 10, padding: 24 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 16 },
  form: { gap: 18 },
});
