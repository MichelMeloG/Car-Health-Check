import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
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

export function ExpenseFormScreen({ navigation }: Props) {
  const { addExpense } = useAppData();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [odometer, setOdometer] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!amount || !category || !date) {
      Alert.alert('Campos obrigatórios', 'Preencha valor, categoria e data.');
      return;
    }

    const parsedAmount = parseAmount(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero.');
      return;
    }

    setSaving(true);
    try {
      await addExpense({
        amountCents: Math.round(parsedAmount * 100),
        category: category.trim(),
        occurredAt: parseDate(date),
        odometerKm: odometer ? Number.parseInt(odometer, 10) : null,
        description: description.trim(),
      });
      Alert.alert('Gasto salvo', 'O lançamento foi salvo e será sincronizado automaticamente.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert(
        'Não foi possível salvar',
        'Tente novamente. Nenhum dado financeiro foi exibido em logs.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Novo gasto</Text>
      <Text style={styles.description}>
        Registre uma despesa para começar a construir o histórico do carro.
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
          placeholder="Ex.: combustível"
          value={category}
        />
        <AppInput label="Data" onChangeText={setDate} placeholder="DD/MM/AAAA" value={date} />
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
          title={saving ? 'Salvando…' : 'Salvar gasto'}
          onPress={() => void handleSubmit()}
        />
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
