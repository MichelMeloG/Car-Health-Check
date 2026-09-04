import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { useAppData } from '../../../data/AppDataProvider';
import { colors } from '../../../theme/colors';
export function RemindersScreen() {
  const { activeVehicle, reminders, addReminder, completeReminder } = useAppData();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const list = reminders.filter((x) => x.vehicleId === activeVehicle?.id);
  return (
    <ScrollView contentContainerStyle={s.c}>
      <Text style={s.t}>Lembretes</Text>
      <View style={s.card}>
        <AppInput label="Tarefa" value={title} onChangeText={setTitle} />
        <AppInput
          label="Data limite"
          value={date}
          onChangeText={setDate}
          placeholder="AAAA-MM-DD"
        />
        <AppButton
          title="Criar lembrete"
          disabled={!title}
          onPress={() =>
            void addReminder({ title, dueDate: date || null, dueOdometerKm: null }).then(() =>
              setTitle(''),
            )
          }
        />
      </View>
      {list.map((x) => (
        <View key={x.id} style={s.card}>
          <Text style={s.item}>
            {x.completed ? '✓ ' : ''}
            {x.title}
          </Text>
          <Text style={s.meta}>{x.dueDate ?? 'Sem data'}</Text>
          {!x.completed ? (
            <AppButton
              title="Concluir"
              variant="secondary"
              onPress={() => void completeReminder(x.id)}
            />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  c: { backgroundColor: colors.background, flexGrow: 1, gap: 14, padding: 24 },
  t: { color: colors.text, fontSize: 25, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderRadius: 14, gap: 10, padding: 16 },
  item: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.muted },
});
