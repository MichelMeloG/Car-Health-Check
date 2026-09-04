import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../../theme/colors';

export function ProfileScreen() {
  const { user, updateDisplayName } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const displayName = user?.displayName || 'Motorista';
  async function save() {
    setSaving(true);
    try {
      await updateDisplayName(name);
      Alert.alert('Perfil atualizado', 'Seu nome será exibido na tela inicial.');
    } catch {
      Alert.alert('Não foi possível atualizar', 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.initial}>{displayName[0]?.toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{displayName}</Text>
      <View style={styles.card}>
        <AppInput
          label="Como podemos chamar você?"
          value={name}
          onChangeText={setName}
          placeholder="Ex.: Michel"
        />
        <AppButton
          title={saving ? 'Salvando…' : 'Salvar nome'}
          disabled={saving}
          onPress={() => void save()}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>E-MAIL</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flexGrow: 1,
    gap: 16,
    padding: 24,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    marginTop: 18,
    width: 96,
  },
  initial: { color: colors.surface, fontSize: 42, fontWeight: '800' },
  name: { color: colors.text, fontSize: 26, fontWeight: '800' },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 14,
    gap: 12,
    padding: 18,
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  email: { color: colors.text, fontSize: 16 },
});
