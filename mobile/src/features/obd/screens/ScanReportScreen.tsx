import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { evaluateHealth } from '../../health/healthRules';
import { useAppData } from '../../../data/AppDataProvider';
import type { ObdSessionSegment, ScanSession } from '../../../data/types';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanReport'>;

const segmentLabels: Record<ObdSessionSegment['type'], string> = {
  quick: 'Leitura rápida',
  warm_idle: 'Marcha lenta',
  controlled_rpm: 'Rotação controlada',
  road: 'Percurso',
};
const telemetryLabels: Record<string, string> = {
  loadPct: 'Carga do motor',
  coolantC: 'Temperatura do motor',
  stftPct: 'STFT',
  ltftPct: 'LTFT',
  mapKpa: 'MAP',
  rpm: 'RPM',
  speedKph: 'Velocidade',
  mafGps: 'MAF',
  voltageV: 'Tensão',
};

function metricValue(key: string, value: number) {
  if (key === 'coolantC') return `${value.toFixed(1)} °C`;
  if (key === 'voltageV') return `${value.toFixed(2)} V`;
  if (key === 'stftPct' || key === 'ltftPct' || key === 'loadPct') return `${value.toFixed(1)} %`;
  if (key === 'mapKpa') return `${value.toFixed(0)} kPa`;
  if (key === 'mafGps') return `${value.toFixed(2)} g/s`;
  if (key === 'speedKph') return `${value.toFixed(0)} km/h`;
  if (key === 'rpm') return `${value.toFixed(0)} rpm`;
  return value.toFixed(2);
}

function qualityCopy(scan: ScanSession) {
  const score = scan.quality?.score ?? scan.qualityScore;
  if (score >= 0.75) return ['Coleta confiável', 'Os dados podem ser usados como referência inicial.'];
  if (score >= 0.5) return ['Coleta parcial', 'Use com cautela e repita em condição semelhante.'];
  return ['Repita a coleta', 'A qualidade não é suficiente para conclusões fortes.'];
}

function DtcGroup({ title, codes }: { title: string; codes: string[] }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailTitle}>{title}</Text>
      <Text style={styles.detailValue}>{codes.length ? codes.join(', ') : 'Nenhum'}</Text>
    </View>
  );
}

export function ScanReportScreen({ route }: Props) {
  const { activeVehicle, scanSessions } = useAppData();
  const scan = scanSessions.find((item) => item.id === route.params.scanId);

  if (!scan) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Relatório indisponível</Text>
          <Text style={styles.muted}>Este check-up não está salvo neste aparelho.</Text>
        </View>
      </ScrollView>
    );
  }

  const [qualityTitle, qualityText] = qualityCopy(scan);
  const findings = evaluateHealth([scan]);
  const groups = scan.dtcGroups ?? { stored: scan.dtcs, pending: [], permanent: [] };
  const segments = scan.segments?.length
    ? scan.segments
    : [
        {
          type: 'quick' as const,
          startedAt: scan.capturedAt,
          completedAt: scan.capturedAt,
          durationSec: 0,
          sampleCount: 1,
          telemetry: scan.telemetry,
          qualityScore: scan.qualityScore,
        },
      ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.overline}>RELATÓRIO DE CHECK-UP</Text>
        <Text style={styles.title}>{activeVehicle?.nickname || activeVehicle?.model || 'Veículo'}</Text>
        <Text style={styles.muted}>{new Date(scan.capturedAt).toLocaleString('pt-BR')}</Text>
        <Text style={styles.quality}>{qualityTitle}</Text>
        <Text style={styles.heroText}>{qualityText}</Text>
      </View>

      <View style={styles.warning}>
        <Text style={styles.warningTitle}>Leitura informativa</Text>
        <Text style={styles.warningText}>
          O relatório mostra indícios dos dados disponíveis e não substitui diagnóstico mecânico.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Sessão</Text>
        <DtcGroup title="Protocolo" codes={scan.protocol ? [scan.protocol] : []} />
        <DtcGroup title="Adaptador" codes={scan.adapterName ? [scan.adapterName] : []} />
        <DtcGroup title="Qualidade" codes={[`${Math.round((scan.quality?.score ?? scan.qualityScore) * 100)}%`]} />
        <DtcGroup title="Amostras" codes={[String(scan.quality?.sampleCount ?? 1)]} />
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Códigos de falha</Text>
        <DtcGroup title="Armazenados" codes={groups.stored} />
        <DtcGroup title="Pendentes" codes={groups.pending} />
        <DtcGroup title="Permanentes" codes={groups.permanent} />
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Etapas coletadas</Text>
        {segments.map((segment) => (
          <View key={`${segment.type}-${segment.startedAt}`} style={styles.segment}>
            <Text style={styles.detailTitle}>{segmentLabels[segment.type]}</Text>
            <Text style={styles.muted}>
              {segment.sampleCount} amostra(s) · {segment.durationSec}s · qualidade{' '}
              {Math.round(segment.qualityScore * 100)}%
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Parâmetros resumidos</Text>
        {Object.entries(scan.telemetry).length ? (
          Object.entries(scan.telemetry).map(([key, value]) => (
            <View key={key} style={styles.detailRow}>
              <Text style={styles.detailTitle}>{telemetryLabels[key] ?? key}</Text>
              <Text style={styles.detailValue}>{metricValue(key, value)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>Nenhum PID essencial respondeu nesta sessão.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Achados deste check-up</Text>
        {findings.length ? (
          findings.map((finding) => (
            <View key={finding.id} style={styles.finding}>
              <Text style={styles.detailTitle}>{finding.title}</Text>
              <Text style={styles.muted}>{finding.nextStep}</Text>
              <Text style={styles.limit}>{finding.limitations.join(' ')}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>Nenhuma regra simples foi acionada nesta leitura.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Cobertura e privacidade</Text>
        <Text style={styles.muted}>
          PIDs disponíveis: {scan.supportedPids?.length ? scan.supportedPids.join(', ') : 'não identificado'}
        </Text>
        {scan.missingPids?.length ? (
          <Text style={styles.muted}>PIDs não informados pela ECU: {scan.missingPids.join(', ')}</Text>
        ) : null}
        <Text style={styles.muted}>
          {scan.rawRetentionUntil
            ? `As respostas brutas ficam apenas neste celular até ${new Date(scan.rawRetentionUntil).toLocaleDateString('pt-BR')}.`
            : 'Não há respostas brutas retidas neste aparelho.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 14, padding: 24, paddingBottom: 36 },
  hero: { backgroundColor: colors.primaryDark, borderRadius: 18, gap: 7, padding: 22 },
  overline: { color: '#B3ECFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: colors.surface, fontSize: 25, fontWeight: '800' },
  quality: { color: '#B3ECFF', fontSize: 16, fontWeight: '800', marginTop: 8 },
  heroText: { color: '#D9E2EC', fontSize: 14, lineHeight: 20 },
  warning: { backgroundColor: '#FFF7E6', borderRadius: 14, gap: 4, padding: 16 },
  warningTitle: { color: '#7C2D12', fontSize: 15, fontWeight: '800' },
  warningText: { color: '#9A3412', fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 16, gap: 12, padding: 18 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  detailRow: { borderTopColor: colors.border, borderTopWidth: 1, gap: 3, paddingTop: 11 },
  detailTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  detailValue: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  segment: { borderTopColor: colors.border, borderTopWidth: 1, gap: 4, paddingTop: 11 },
  finding: { borderTopColor: colors.border, borderTopWidth: 1, gap: 5, paddingTop: 11 },
  limit: { color: '#667085', fontSize: 12, lineHeight: 18 },
});
