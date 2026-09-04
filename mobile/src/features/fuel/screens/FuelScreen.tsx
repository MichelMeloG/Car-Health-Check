import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { useAppData } from '../../../data/AppDataProvider';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Fuel'>;
const today = () => new Date().toISOString().slice(0, 10);
const money = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const amountText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
const numberText = (value: number) => value.toString().replace('.', ',');

function parseDecimal(value: string) {
  const cleaned = value.trim();
  return Number(cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned);
}

export function FuelScreen({ navigation, route }: Props) {
  const {
    activeVehicle,
    fuelEntries,
    transactions,
    addFuelEntry,
    updateFuelEntry,
    deleteTransaction,
  } = useAppData();
  const existing = useMemo(
    () => fuelEntries.find((entry) => entry.id === route.params?.fuelEntryId),
    [fuelEntries, route.params?.fuelEntryId],
  );
  const [liters, setLiters] = useState('');
  const [cost, setCost] = useState('');
  const [odometer, setOdometer] = useState('');
  const [date, setDate] = useState(today());
  const [fuelType, setFuelType] = useState('Gasolina');
  const [station, setStation] = useState('');
  const [tankFull, setTankFull] = useState(true);
  const [saving, setSaving] = useState(false);
  const list = fuelEntries.filter((entry) => entry.vehicleId === activeVehicle?.id);

  useEffect(() => {
    if (existing) {
      setLiters(numberText(existing.liters));
      setCost(amountText(existing.totalCents));
      setOdometer(existing.odometerKm.toString());
      setDate(existing.occurredAt);
      setFuelType(existing.fuelType);
      setStation(existing.station);
      setTankFull(existing.tankFull);
      return;
    }
    if (activeVehicle?.odometerKm)
      setOdometer((current) => current || String(activeVehicle.odometerKm));
  }, [activeVehicle?.odometerKm, existing]);

  async function submit() {
    const parsedLiters = parseDecimal(liters);
    const parsedCost = parseDecimal(cost);
    const parsedOdometer = Number.parseInt(odometer, 10);
    if (
      !date.trim() ||
      !fuelType.trim() ||
      !Number.isFinite(parsedLiters) ||
      parsedLiters <= 0 ||
      !Number.isFinite(parsedCost) ||
      parsedCost <= 0 ||
      !Number.isInteger(parsedOdometer) ||
      parsedOdometer < 0
    ) {
      Alert.alert(
        'Confira os dados',
        'Informe data, tipo de combustível, litros, valor e quilometragem válidos.',
      );
      return;
    }
    setSaving(true);
    try {
      const input = {
        occurredAt: date.trim(),
        odometerKm: parsedOdometer,
        liters: parsedLiters,
        totalCents: Math.round(parsedCost * 100),
        fuelType: fuelType.trim(),
        station: station.trim(),
        tankFull,
      };
      if (existing) await updateFuelEntry(existing.id, input);
      else await addFuelEntry(input);
      Alert.alert(
        existing ? 'Abastecimento atualizado' : 'Abastecimento registrado',
        'O valor já entrou em Finanças e nos totais deste veículo.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    if (!existing) return;
    const transaction = transactions.find(
      (item) => item.sourceEntityType === 'fuel' && item.sourceEntityId === existing.id,
    );
    if (!transaction) return Alert.alert('Abastecimento indisponível', 'Tente atualizar a tela.');
    Alert.alert('Excluir abastecimento?', 'O custo também será removido do histórico financeiro.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => void deleteTransaction(transaction.id).then(() => navigation.goBack()),
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{existing ? 'Editar abastecimento' : 'Abastecimento'}</Text>
      <Text style={styles.description}>
        Cada abastecimento alimenta automaticamente o histórico único de Finanças.
      </Text>
      <View style={styles.card}>
        <AppInput label="Data" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" />
        <AppInput
          label="Tipo de combustível"
          value={fuelType}
          onChangeText={setFuelType}
          placeholder="Ex.: Gasolina, Etanol, Diesel"
        />
        <AppInput
          label="Litros"
          value={liters}
          onChangeText={setLiters}
          keyboardType="decimal-pad"
          placeholder="0,00"
        />
        <AppInput
          label="Valor total"
          value={cost}
          onChangeText={setCost}
          keyboardType="decimal-pad"
          placeholder="R$ 0,00"
        />
        <AppInput
          label="Quilometragem"
          value={odometer}
          onChangeText={setOdometer}
          keyboardType="numeric"
          placeholder="187320"
        />
        <AppInput
          label="Posto (opcional)"
          value={station}
          onChangeText={setStation}
          placeholder="Ex.: Posto da avenida"
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: tankFull }}
          onPress={() => setTankFull((value) => !value)}
          style={[styles.check, tankFull && styles.checkActive]}
        >
          <Text style={[styles.checkText, tankFull && styles.checkTextActive]}>
            {tankFull ? '✓ Tanque completo' : 'Tanque parcial'}
          </Text>
        </Pressable>
        <AppButton
          title={saving ? 'Salvando…' : existing ? 'Salvar alterações' : 'Registrar abastecimento'}
          disabled={saving}
          onPress={() => void submit()}
        />
        {existing ? (
          <AppButton title="Excluir abastecimento" variant="secondary" onPress={remove} />
        ) : null}
      </View>
      {!existing ? (
        <View style={styles.history}>
          <Text style={styles.heading}>Últimos abastecimentos</Text>
          {list.length ? (
            list.slice(0, 5).map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => navigation.push('Fuel', { fuelEntryId: entry.id })}
                style={styles.item}
              >
                <View>
                  <Text style={styles.itemTitle}>
                    {entry.fuelType} · {entry.liters.toFixed(2)} L
                  </Text>
                  <Text style={styles.meta}>
                    {entry.occurredAt} · {entry.odometerKm.toLocaleString('pt-BR')} km
                  </Text>
                </View>
                <Text style={styles.itemTitle}>{money(entry.totalCents)}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.meta}>Nenhum abastecimento registrado ainda.</Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 14, padding: 24 },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderRadius: 16, gap: 16, padding: 18 },
  check: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, padding: 14 },
  checkActive: { backgroundColor: '#E6F4FE', borderColor: colors.primary },
  checkText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  checkTextActive: { color: colors.primary },
  history: { backgroundColor: colors.surface, borderRadius: 16, gap: 10, padding: 18 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '800' },
  item: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 3 },
});
