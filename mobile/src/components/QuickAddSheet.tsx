import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const actions: Array<{
  label: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route: keyof Pick<RootStackParamList, 'Fuel' | 'Maintenance' | 'ExpenseForm' | 'Mileage' | 'Obd'>;
}> = [
  {
    label: 'Abastecimento',
    description: 'Litros, valor e odômetro',
    icon: 'gas-station-outline',
    route: 'Fuel',
  },
  {
    label: 'Manutenção',
    description: 'Serviço, oficina e valor',
    icon: 'wrench-outline',
    route: 'Maintenance',
  },
  {
    label: 'Despesa',
    description: 'Seguro, IPVA, pedágio e outros',
    icon: 'receipt-text-outline',
    route: 'ExpenseForm',
  },
  {
    label: 'Quilometragem',
    description: 'Atualizar odômetro do veículo',
    icon: 'speedometer',
    route: 'Mileage',
  },
  { label: 'Check-up OBD', description: 'Diagnóstico do veículo', icon: 'car-cog', route: 'Obd' },
];

export function QuickAddSheet({ visible, onClose, navigation }: Props) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <Text style={styles.title}>Registrar</Text>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                navigation.navigate(action.route);
              }}
              style={styles.action}
            >
              <View style={styles.icon}>
                <MaterialCommunityIcons color={colors.primary} name={action.icon} size={22} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.label}>{action.label}</Text>
                <Text style={styles.description}>{action.description}</Text>
              </View>
              <MaterialCommunityIcons color={colors.muted} name="chevron-right" size={24} />
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#0008', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: 2,
    height: 4,
    marginBottom: 18,
    width: 44,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  action: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 14 },
  icon: {
    alignItems: 'center',
    backgroundColor: '#E6F4FE',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copy: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 13 },
});
