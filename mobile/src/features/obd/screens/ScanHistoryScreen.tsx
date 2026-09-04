import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../../components/AppButton';
import { useAppData } from '../../../data/AppDataProvider';
import type { ScanSession } from '../../../data/types';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function qualityLabel(scan: ScanSession) {
  const tier = scan.quality?.tier ?? (scan.qualityScore >= 0.75 ? 'good' : 'fair');
  return tier === 'good' ? 'Boa qualidade' : tier === 'fair' ? 'Qualidade regular' : 'Repetir coleta';
}

function qualityColor(scan: ScanSession) {
  const tier = scan.quality?.tier ?? (scan.qualityScore >= 0.75 ? 'good' : 'fair');
  return tier === 'good' ? '#15803D' : tier === 'fair' ? '#D97706' : '#B42318';
}

export function ScanHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { activeVehicle, scanSessions } = useAppData();
  const scans = scanSessions.filter((scan) => scan.vehicleId === activeVehicle?.id);

  if (!activeVehicle) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.emptyCard}>
          <Text style={styles.title}>Escolha um veículo</Text>
          <Text style={styles.muted}>O histórico de check-ups pertence sempre a um veículo.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.intro}>
        <Text style={styles.overline}>HISTÓRICO OBD</Text>
        <Text style={styles.title}>{activeVehicle.nickname || activeVehicle.model}</Text>
        <Text style={styles.muted}>
          Compare sessões equivalentes para transformar leituras isoladas em tendência.
        </Text>
      </View>

      {scans.length ? (
        scans.map((scan) => {
          const dtcCount = scan.dtcs.length;
          return (
            <Pressable
              key={scan.id}
              accessibilityRole="button"
              accessibilityHint="Abre o relatório deste check-up"
              onPress={() => navigation.navigate('ScanReport', { scanId: scan.id })}
              style={styles.card}
            >
              <View style={styles.row}>
                <View style={styles.icon}>
                  <MaterialCommunityIcons color={colors.primary} name="car-cog" size={22} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.cardTitle}>{scan.capturedAt.slice(0, 10)}</Text>
                  <Text style={styles.muted}>{scan.protocol ?? 'Protocolo não identificado'}</Text>
                </View>
                <MaterialCommunityIcons color={colors.muted} name="chevron-right" size={22} />
              </View>
              <View style={styles.badges}>
                <Text style={[styles.badge, { color: qualityColor(scan) }]}>{qualityLabel(scan)}</Text>
                <Text style={styles.badge}>
                  {dtcCount ? `${dtcCount} código(s)` : 'Sem DTCs'}
                </Text>
                <Text style={styles.badge}>{scan.segments?.length ?? 1} etapa(s)</Text>
              </View>
            </Pressable>
          );
        })
      ) : (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons color={colors.primary} name="chart-timeline-variant" size={30} />
          <Text style={styles.cardTitle}>Ainda não há check-ups salvos</Text>
          <Text style={styles.muted}>
            Faça a sessão guiada em marcha lenta para criar a primeira referência deste veículo.
          </Text>
          <AppButton title="Fazer check-up" onPress={() => navigation.navigate('Obd')} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 14, padding: 24 },
  intro: { gap: 7, marginBottom: 4 },
  overline: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 16, gap: 14, padding: 17 },
  emptyCard: { alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: 16, gap: 12, padding: 20 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  icon: { alignItems: 'center', backgroundColor: '#E6F4FE', borderRadius: 10, height: 42, justifyContent: 'center', width: 42 },
  copy: { flex: 1, gap: 3 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { backgroundColor: '#F2F4F7', borderRadius: 20, color: colors.muted, fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6 },
});
