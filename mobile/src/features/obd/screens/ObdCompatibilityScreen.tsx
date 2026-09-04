import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ADAPTER_COMPATIBILITY, VEHICLE_COMPATIBILITY, type CompatibilityProfile } from '../obdCompatibility';
import { colors } from '../../../theme/colors';

function ProfileCard({ profile }: { profile: CompatibilityProfile }) {
  const validated = profile.status === 'validated';
  return (
    <View style={styles.card}>
      <Text style={[styles.status, { color: validated ? '#15803D' : '#D97706' }]}>
        {validated ? 'HOMOLOGADO' : 'CANDIDATO DO PILOTO'}
      </Text>
      <Text style={styles.title}>{profile.title}</Text>
      <Text style={styles.muted}>{profile.detail}</Text>
      <Text style={styles.note}>{profile.note}</Text>
    </View>
  );
}

export function ObdCompatibilityScreen() {
  const validatedVehicles = VEHICLE_COMPATIBILITY.filter((profile) => profile.status === 'validated');
  const validatedAdapters = ADAPTER_COMPATIBILITY.filter((profile) => profile.status === 'validated');
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.overline}>COBERTURA OBD</Text>
        <Text style={styles.heroTitle}>Compatibilidade transparente</Text>
        <Text style={styles.heroText}>
          Um item só vira homologado depois de teste físico registrado. Candidato não significa garantia de funcionamento.
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoTitle}>Homologação atual</Text>
        <Text style={styles.muted}>
          {validatedVehicles.length || validatedAdapters.length
            ? `${validatedVehicles.length} veículo(s) e ${validatedAdapters.length} adaptador(es) homologados.`
            : 'Ainda não há veículo ou dongle homologado nesta versão.'}
        </Text>
      </View>

      <Text style={styles.heading}>Veículos do piloto</Text>
      {VEHICLE_COMPATIBILITY.map((profile) => (
        <ProfileCard key={profile.id} profile={profile} />
      ))}

      <Text style={styles.heading}>Adaptadores do piloto</Text>
      {ADAPTER_COMPATIBILITY.map((profile) => (
        <ProfileCard key={profile.id} profile={profile} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 14, padding: 24, paddingBottom: 36 },
  hero: { backgroundColor: colors.primaryDark, borderRadius: 18, gap: 7, padding: 22 },
  overline: { color: '#B3ECFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  heroTitle: { color: colors.surface, fontSize: 24, fontWeight: '800' },
  heroText: { color: '#D9E2EC', fontSize: 14, lineHeight: 20 },
  info: { backgroundColor: '#FFF7E6', borderRadius: 14, gap: 4, padding: 16 },
  infoTitle: { color: '#7C2D12', fontSize: 15, fontWeight: '800' },
  heading: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 6 },
  card: { backgroundColor: colors.surface, borderRadius: 16, gap: 8, padding: 18 },
  status: { fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  note: { color: '#667085', fontSize: 12, lineHeight: 18 },
});
