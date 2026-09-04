import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppData } from '../../../data/AppDataProvider';
import { colors } from '../../../theme/colors';
const money = (v: number) =>
  (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function AllVehiclesScreen() {
  const { vehicleSummaries } = useAppData();
  const total = vehicleSummaries.reduce((sum, v) => sum + v.totalCents, 0);
  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.total}>
        <Text style={s.label}>TOTAL DE TODOS OS CARROS</Text>
        <Text style={s.amount}>{money(total)}</Text>
      </View>
      {vehicleSummaries.map(({ vehicle, totalCents, expenseCount }) => (
        <View key={vehicle.id} style={s.card}>
          <Text style={s.name}>{vehicle.model}</Text>
          <Text style={s.detail}>
            {expenseCount} lançamento(s) · {money(totalCents)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 12, padding: 24 },
  total: { backgroundColor: colors.primaryDark, borderRadius: 16, gap: 8, padding: 20 },
  label: { color: '#B3ECFF', fontSize: 12, fontWeight: '700' },
  amount: { color: colors.surface, fontSize: 30, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderRadius: 14, gap: 6, padding: 18 },
  name: { color: colors.text, fontSize: 18, fontWeight: '800' },
  detail: { color: colors.muted },
});
