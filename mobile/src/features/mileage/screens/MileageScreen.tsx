import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { useAppData } from '../../../data/AppDataProvider';
import { colors } from '../../../theme/colors';

export function MileageScreen() {
  const { activeVehicle, saveVehicle } = useAppData();
  const [odometer, setOdometer] = useState(activeVehicle?.odometerKm?.toString() ?? '');
  const vehicle = activeVehicle;
  if (!vehicle)
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Selecione um veículo primeiro.</Text>
      </View>
    );
  const selectedVehicle = vehicle;
  async function save() {
    const value = Number(odometer);
    if (!Number.isFinite(value) || value < 0) return Alert.alert('Quilometragem inválida');
    if (selectedVehicle.odometerKm && value < selectedVehicle.odometerKm)
      return Alert.alert(
        'Quilometragem menor que a atual',
        'Confirme o valor no painel do veículo.',
      );
    await saveVehicle(
      {
        model: selectedVehicle.model,
        brand: selectedVehicle.brand,
        nickname: selectedVehicle.nickname,
        year: selectedVehicle.year,
        engine: selectedVehicle.engine,
        transmission: selectedVehicle.transmission,
        fuel: selectedVehicle.fuel,
        color: selectedVehicle.color,
        plate: selectedVehicle.plate,
        vin: selectedVehicle.vin,
        odometerKm: value,
      },
      selectedVehicle.id,
    );
    Alert.alert('Quilometragem atualizada');
  }
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Atualizar quilometragem</Text>
      <Text style={styles.description}>
        Informe o valor mostrado no painel. Ele será usado em manutenção, consumo e lembretes.
      </Text>
      <AppInput
        label="Quilometragem atual"
        value={odometer}
        onChangeText={setOdometer}
        keyboardType="numeric"
        placeholder="113000"
      />
      <AppButton title="Salvar quilometragem" onPress={() => void save()} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 18, padding: 24 },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23 },
});
