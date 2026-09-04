import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { useAppData } from '../../../data/AppDataProvider';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Maintenance'>;
const evidenceOptions = [
  ['declared', 'Informado'],
  ['documented', 'Documentado'],
  ['verified', 'Verificado'],
  ['corroborated', 'Confirmado'],
] as const;
type EvidenceLevel = (typeof evidenceOptions)[number][0];
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) =>
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const amountText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

function parseAmount(value: string) {
  const normalized = value.trim();
  return Number(
    normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized,
  );
}

export function MaintenanceScreen({ navigation, route }: Props) {
  const {
    activeVehicle,
    maintenance,
    transactions,
    addMaintenance,
    updateMaintenance,
    deleteTransaction,
  } = useAppData();
  const existing = useMemo(
    () => maintenance.find((entry) => entry.id === route.params?.maintenanceId),
    [maintenance, route.params?.maintenanceId],
  );
  const [serviceType, setServiceType] = useState('');
  const [date, setDate] = useState(today());
  const [labor, setLabor] = useState('');
  const [parts, setParts] = useState('');
  const [odometer, setOdometer] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceLevel, setEvidenceLevel] = useState<EvidenceLevel>('declared');
  const [saving, setSaving] = useState(false);
  const list = maintenance.filter((item) => item.vehicleId === activeVehicle?.id);

  useEffect(() => {
    if (existing) {
      setServiceType(existing.serviceType);
      setDate(existing.occurredAt);
      setLabor(amountText(existing.laborCents));
      setParts(amountText(existing.partsCents));
      setOdometer(existing.odometerKm?.toString() ?? '');
      setWorkshop(existing.workshop);
      setNotes(existing.notes);
      setEvidenceLevel(existing.evidenceLevel);
      return;
    }
    if (activeVehicle?.odometerKm)
      setOdometer((value) => value || String(activeVehicle.odometerKm));
  }, [activeVehicle?.odometerKm, existing]);

  async function submit() {
    const laborCents = labor.trim() ? Math.round(parseAmount(labor) * 100) : 0;
    const partsCents = parts.trim() ? Math.round(parseAmount(parts) * 100) : 0;
    const parsedOdometer = odometer ? Number.parseInt(odometer, 10) : null;
    if (!serviceType.trim() || !date.trim()) {
      Alert.alert('Campos obrigatórios', 'Informe o serviço e a data de realização.');
      return;
    }
    if (
      !Number.isFinite(laborCents) ||
      laborCents < 0 ||
      !Number.isFinite(partsCents) ||
      partsCents < 0 ||
      (parsedOdometer !== null && (!Number.isInteger(parsedOdometer) || parsedOdometer < 0))
    ) {
      Alert.alert('Confira os valores', 'Informe valores e quilometragem válidos.');
      return;
    }
    setSaving(true);
    try {
      const input = {
        serviceType: serviceType.trim(),
        occurredAt: date.trim(),
        odometerKm: parsedOdometer,
        workshop: workshop.trim(),
        laborCents,
        partsCents,
        notes: notes.trim(),
        evidenceLevel,
      };
      if (existing) await updateMaintenance(existing.id, input);
      else await addMaintenance(input);
      Alert.alert(
        existing ? 'Serviço atualizado' : 'Manutenção registrada',
        'O custo já entrou em Finanças e no total deste veículo.',
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
      (item) => item.sourceEntityType === 'maintenance' && item.sourceEntityId === existing.id,
    );
    if (!transaction) return Alert.alert('Serviço indisponível', 'Tente atualizar a tela.');
    Alert.alert('Excluir manutenção?', 'O custo também será removido do histórico financeiro.', [
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
      <Text style={styles.title}>{existing ? 'Editar manutenção' : 'Manutenção'}</Text>
      <Text style={styles.description}>
        Registre o serviço técnico; os valores formam um único lançamento financeiro.
      </Text>
      <View style={styles.card}>
        <AppInput
          label="Serviço realizado"
          value={serviceType}
          onChangeText={setServiceType}
          placeholder="Ex.: Troca de óleo"
        />
        <AppInput label="Data" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" />
        <AppInput
          label="Mão de obra"
          value={labor}
          onChangeText={setLabor}
          keyboardType="decimal-pad"
          placeholder="R$ 0,00"
        />
        <AppInput
          label="Peças"
          value={parts}
          onChangeText={setParts}
          keyboardType="decimal-pad"
          placeholder="R$ 0,00"
        />
        <AppInput
          label="Quilometragem (opcional)"
          value={odometer}
          onChangeText={setOdometer}
          keyboardType="numeric"
          placeholder="187320"
        />
        <AppInput
          label="Oficina ou fornecedor (opcional)"
          value={workshop}
          onChangeText={setWorkshop}
          placeholder="Ex.: Oficina do bairro"
        />
        <AppInput
          label="Observação (opcional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Peças, garantia ou detalhes"
        />
        <View style={styles.evidence}>
          <Text style={styles.label}>Evidência do registro</Text>
          <View style={styles.evidenceOptions}>
            {evidenceOptions.map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setEvidenceLevel(value)}
                style={[
                  styles.evidenceOption,
                  evidenceLevel === value && styles.evidenceOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.evidenceText,
                    evidenceLevel === value && styles.evidenceTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <AppButton
          title={saving ? 'Salvando…' : existing ? 'Salvar alterações' : 'Registrar serviço'}
          disabled={saving}
          onPress={() => void submit()}
        />
        {existing ? (
          <AppButton title="Excluir manutenção" variant="secondary" onPress={remove} />
        ) : null}
      </View>
      {!existing ? (
        <View style={styles.history}>
          <Text style={styles.heading}>Histórico técnico</Text>
          {list.length ? (
            list.slice(0, 5).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => navigation.push('Maintenance', { maintenanceId: item.id })}
                style={styles.item}
              >
                <View style={styles.copy}>
                  <Text style={styles.itemTitle}>{item.serviceType}</Text>
                  <Text style={styles.meta}>
                    {item.occurredAt}
                    {item.workshop ? ` · ${item.workshop}` : ''}
                  </Text>
                </View>
                <Text style={styles.itemTitle}>{money(item.laborCents + item.partsCents)}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.meta}>Nenhum serviço registrado ainda.</Text>
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
  evidence: { gap: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  evidenceOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  evidenceOption: {
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  evidenceOptionActive: { backgroundColor: '#E6F4FE', borderColor: colors.primary },
  evidenceText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  evidenceTextActive: { color: colors.primary },
  history: { backgroundColor: colors.surface, borderRadius: 16, gap: 10, padding: 18 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '800' },
  item: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  copy: { flex: 1 },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 3 },
});
