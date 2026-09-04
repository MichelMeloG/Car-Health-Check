import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { useAppData } from '../../../data/AppDataProvider';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme/colors';
type Props = NativeStackScreenProps<RootStackParamList, 'VehicleForm'>;
export function VehicleFormScreen({ navigation, route }: Props) {
  const { vehicles, createVehicle, saveVehicle } = useAppData();
  const existing = useMemo(
    () => vehicles.find((v) => v.id === route.params?.vehicleId),
    [route.params?.vehicleId, vehicles],
  );
  const [model, setModel] = useState(existing?.model ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [year, setYear] = useState(existing?.year?.toString() ?? '');
  const [engine, setEngine] = useState(existing?.engine ?? '');
  const [transmission, setTransmission] = useState(existing?.transmission ?? '');
  const [fuel, setFuel] = useState(existing?.fuel ?? '');
  const [color, setColor] = useState(existing?.color ?? '');
  const [plate, setPlate] = useState(existing?.plate ?? '');
  const [vin, setVin] = useState(existing?.vin ?? '');
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [km, setKm] = useState(existing?.odometerKm?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!model.trim()) return Alert.alert('Campo obrigatório', 'Informe o modelo do veículo.');
    setSaving(true);
    try {
      const value = {
        model: model.trim(),
        brand: brand.trim() || undefined,
        nickname: nickname.trim() || undefined,
        year: year ? Number(year) : null,
        engine: engine.trim() || undefined,
        transmission: transmission.trim() || undefined,
        fuel: fuel.trim() || undefined,
        color: color.trim() || undefined,
        plate: plate.trim() || undefined,
        vin: vin.trim() || undefined,
        odometerKm: km ? Number(km) : null,
      };
      if (existing) await saveVehicle(value, existing.id);
      else await createVehicle(value);
      navigation.goBack();
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>{existing ? 'Editar veículo' : 'Adicionar veículo'}</Text>
      <View style={s.form}>
        <AppInput
          label="Apelido (opcional)"
          value={nickname}
          onChangeText={setNickname}
          placeholder="Ex.: Carro da família"
        />
        <AppInput label="Marca" value={brand} onChangeText={setBrand} placeholder="Ex.: Honda" />
        <AppInput
          label="Modelo"
          value={model}
          onChangeText={setModel}
          placeholder="Ex.: Honda Fit"
        />
        <AppInput label="Motor" value={engine} onChangeText={setEngine} placeholder="Ex.: 1.4" />
        <AppInput
          label="Câmbio"
          value={transmission}
          onChangeText={setTransmission}
          placeholder="Ex.: Manual"
        />
        <AppInput label="Combustível" value={fuel} onChangeText={setFuel} placeholder="Ex.: Flex" />
        <AppInput
          label="Cor (opcional)"
          value={color}
          onChangeText={setColor}
          placeholder="Ex.: Prata"
        />
        <AppInput
          label="Placa (opcional)"
          value={plate}
          onChangeText={setPlate}
          autoCapitalize="characters"
          placeholder="ABC1D23"
        />
        <AppInput
          label="Chassi / VIN (opcional)"
          value={vin}
          onChangeText={setVin}
          autoCapitalize="characters"
          placeholder="17 caracteres"
        />
        <AppInput
          label="Ano"
          value={year}
          onChangeText={setYear}
          keyboardType="numeric"
          placeholder="2004"
        />
        <AppInput
          label="Quilometragem atual"
          value={km}
          onChangeText={setKm}
          keyboardType="numeric"
          placeholder="187320"
        />
        <AppButton
          title={saving ? 'Salvando…' : 'Salvar veículo'}
          disabled={saving}
          onPress={() => void submit()}
        />
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 20, padding: 24 },
  title: { color: colors.text, fontSize: 27, fontWeight: '800' },
  form: { gap: 18 },
});
