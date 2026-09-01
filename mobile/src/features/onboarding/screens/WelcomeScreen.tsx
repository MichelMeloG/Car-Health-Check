import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../../../components/AppButton';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>CAR HEALTH</Text>
        <Text style={styles.title}>Cuidar do carro começa por entender os gastos.</Text>
        <Text style={styles.description}>
          Organize o histórico do seu veículo hoje. A saúde automotiva vem depois.
        </Text>
      </View>
      <View style={styles.actions}>
        <AppButton title="Começar" onPress={() => navigation.navigate('Login')} />
        <Text style={styles.note}>Um app simples para acompanhar o seu carro.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  hero: { gap: 20, marginTop: 80 },
  logo: { color: colors.primary, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 36, fontWeight: '800', lineHeight: 43 },
  description: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  actions: { gap: 16, marginBottom: 24 },
  note: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
