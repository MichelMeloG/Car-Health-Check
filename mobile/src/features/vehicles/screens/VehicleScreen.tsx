import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { useAppData } from '../../../data/AppDataProvider';
import { colors } from '../../../theme/colors';

export function VehicleScreen() {
  const { vehicle, saveVehicle } = useAppData();
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(vehicle?.year?.toString() ?? '');
  const [odometer, setOdometer] = useState(vehicle?.odometerKm?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!model.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o modelo do veículo.');
      return;
    }
    setSaving(true);
    try {
      await saveVehicle({
        model: model.trim(),
        year: year ? Number.parseInt(year, 10) : null,
        odometerKm: odometer ? Number.parseInt(odometer, 10) : null,
      });
      Alert.alert('Veículo salvo', 'Os dados serão sincronizados automaticamente.');
    } catch {
      Alert.alert(
        'Não foi possível salvar',
        'Tente novamente quando a conexão estiver disponível.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meu veículo</Text>
      <Text style={styles.description}>Esses dados ajudam a organizar seus gastos por carro.</Text>
      <View style={styles.form}>
        <AppInput
          label="Modelo"
          onChangeText={setModel}
          placeholder="Ex.: Honda Fit"
          value={model}
        />
        <AppInput
          keyboardType="numeric"
          label="Ano"
          onChangeText={setYear}
          placeholder="2004"
          value={year}
        />
        <AppInput
          keyboardType="numeric"
          label="Quilometragem atual"
          onChangeText={setOdometer}
          placeholder="187320"
          value={odometer}
        />
        <AppButton
          disabled={saving}
          title={saving ? 'Salvando…' : 'Salvar veículo'}
          onPress={() => void handleSave()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1, gap: 12, padding: 24 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 12 },
  form: { gap: 18 },
});
