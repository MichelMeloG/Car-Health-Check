import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AppButton } from '../../../components/AppButton';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme/colors';
import { adapterProfileForName } from '../obdCompatibility';
import { useObd } from '../ObdProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Obd'>;

const statusLabels = {
  idle: 'Pronto para procurar',
  scanning: 'Procurando adaptadores…',
  connecting: 'Conectando e preparando ELM327…',
  connected: 'Adaptador conectado',
  reading: 'Lendo dados do veículo…',
  guiding: 'Sessão guiada em andamento',
};

const stageCopy = {
  warm_idle: {
    title: 'Marcha lenta em coleta',
    text: 'Mantenha o veículo parado, motor ligado e em marcha lenta. A coleta termina sozinha em 30 segundos.',
  },
  controlled_rpm: {
    title: 'Rotação controlada em coleta',
    text: 'Somente com o veículo parado e em local seguro. Mantenha cerca de 2.500 RPM; a coleta termina sozinha.',
  },
  road: {
    title: 'Percurso em coleta',
    text: 'A coleta termina sozinha em 60 segundos. Não interaja com o celular durante a condução; mantenha o app aberto em local seguro.',
  },
};

export function ObdScreen({ navigation }: Props) {
  const {
    devices,
    connectedDevice,
    lastSnapshot,
    lastSessionId,
    status,
    error,
    guidedStage,
    guidedProgress,
    guidedSegments,
    scan,
    connect,
    runCheck,
    startGuidedCheck,
    collectControlledRpm,
    collectRoadSegment,
    finishGuidedCheck,
    discardGuidedCheck,
    disconnect,
    clearDtcs,
  } = useObd();
  const isBusy = status === 'scanning' || status === 'connecting' || status === 'reading' || status === 'guiding';
  const isCollecting = guidedStage === 'warm_idle' || guidedStage === 'controlled_rpm' || guidedStage === 'road';
  const hasSegment = (type: string) => guidedSegments.some((segment) => segment.type === type);

  useEffect(() => {
    if (!isCollecting) return;
    return navigation.addListener('beforeRemove', (event) => {
      // Durante a rota, a única ação segura é aguardar a conclusão automática.
      event.preventDefault();
    });
  }, [isCollecting, navigation]);

  function confirmGuidedStart() {
    Alert.alert(
      'Iniciar sessão guiada?',
      'Estacione em local seguro, mantenha ventilação adequada e deixe o motor em marcha lenta. A primeira etapa dura 30 segundos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar',
          onPress: () =>
            void startGuidedCheck().catch((cause: unknown) =>
              Alert.alert(
                'Não foi possível iniciar',
                cause instanceof Error ? cause.message : 'Tente novamente.',
              ),
            ),
        },
      ],
    );
  }

  function finishSession() {
    void finishGuidedCheck()
      .then((sessionId) => navigation.navigate('ScanReport', { scanId: sessionId }))
      .catch((cause: unknown) =>
        Alert.alert('Não foi possível salvar', cause instanceof Error ? cause.message : 'Tente novamente.'),
      );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.warning}>
        <Text style={styles.warningTitle}>Segurança primeiro</Text>
        <Text style={styles.warningText}>
          Faça a preparação com o veículo parado. A coleta de percurso é iniciada antes de dirigir e não exige toque no celular durante o trajeto.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>STATUS</Text>
        <Text style={styles.status}>{statusLabels[status]}</Text>
        {connectedDevice ? (
          <>
            <Text style={styles.meta}>{connectedDevice.name ?? connectedDevice.id}</Text>
            <Text style={styles.meta}>{adapterProfileForName(connectedDevice.name)}</Text>
          </>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {!connectedDevice ? (
        <>
          <AppButton
            disabled={isBusy}
            title={status === 'scanning' ? 'Procurando…' : 'Procurar adaptador OBD-II'}
            onPress={() => void scan()}
          />
          {devices.map((device) => (
            <View key={device.id} style={styles.device}>
              <View style={styles.flex}>
                <Text style={styles.deviceName}>{device.name ?? 'Adaptador sem nome'}</Text>
                <Text style={styles.meta}>{device.rssi ? `${device.rssi} dBm` : device.id}</Text>
              </View>
              <AppButton
                disabled={isBusy}
                title="Conectar"
                onPress={() => void connect(device)}
                variant="secondary"
              />
            </View>
          ))}
        </>
      ) : (
        <>
          {!guidedStage ? (
            <View style={styles.actions}>
              <AppButton disabled={isBusy} title="Iniciar sessão guiada" onPress={confirmGuidedStart} />
              <AppButton
                disabled={isBusy}
                title={status === 'reading' ? 'Lendo…' : 'Leitura rápida'}
                onPress={() => void runCheck()}
                variant="secondary"
              />
            </View>
          ) : null}

          {isCollecting ? (
            <View style={styles.guidedCard}>
              <MaterialCommunityIcons color={colors.primary} name="progress-clock" size={28} />
              <Text style={styles.sectionTitle}>{stageCopy[guidedStage].title}</Text>
              <Text style={styles.meta}>{stageCopy[guidedStage].text}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(4, guidedProgress)}%` }]} />
              </View>
              <Text style={styles.progressText}>{guidedProgress}% concluído</Text>
            </View>
          ) : null}

          {guidedStage === 'review' ? (
            <View style={styles.guidedCard}>
              <Text style={styles.sectionTitle}>Etapas registradas</Text>
              {guidedSegments.map((segment) => (
                <Text key={`${segment.type}-${segment.startedAt}`} style={styles.meta}>
                  ✓ {segment.type === 'warm_idle' ? 'Marcha lenta' : segment.type === 'controlled_rpm' ? 'Rotação controlada' : 'Percurso'} · {segment.sampleCount} amostra(s)
                </Text>
              ))}
              {!hasSegment('controlled_rpm') ? (
                <AppButton
                  title="Coletar rotação controlada · 10s"
                  variant="secondary"
                  onPress={() =>
                    Alert.alert(
                      'Rotação controlada',
                      'Somente com o veículo parado e freio acionado. Mantenha aproximadamente 2.500 RPM até a coleta terminar.',
                      [
                        { text: 'Agora não', style: 'cancel' },
                        { text: 'Iniciar coleta', onPress: () => void collectControlledRpm() },
                      ],
                    )
                  }
                />
              ) : null}
              {!hasSegment('road') ? (
                <AppButton
                  title="Iniciar coleta de percurso · 60s"
                  variant="secondary"
                  onPress={() =>
                    Alert.alert(
                      'Coleta de percurso',
                      'Inicie somente antes de dirigir. O app coleta por 60 segundos e encerra sozinho; não interaja com o celular durante o percurso.',
                      [
                        { text: 'Agora não', style: 'cancel' },
                        { text: 'Iniciar coleta', onPress: () => void collectRoadSegment() },
                      ],
                    )
                  }
                />
              ) : null}
              <AppButton title="Salvar relatório" onPress={finishSession} />
              <AppButton title="Descartar sessão" variant="secondary" onPress={discardGuidedCheck} />
            </View>
          ) : null}

          {!isCollecting ? (
            <View style={styles.actions}>
              <AppButton title="Histórico de check-ups" variant="secondary" onPress={() => navigation.navigate('ScanHistory')} />
              <AppButton
                title="Ver compatibilidade"
                variant="secondary"
                onPress={() => navigation.navigate('ObdCompatibility')}
              />
              <AppButton
                disabled={isBusy}
                title="Limpar códigos de falha"
                variant="secondary"
                onPress={() =>
                  Alert.alert(
                    'Limpar DTCs?',
                    'Isso pode apagar evidências e reiniciar monitores de emissões. A ação será registrada na auditoria.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Limpar códigos',
                        style: 'destructive',
                        onPress: () =>
                          void clearDtcs()
                            .then(() => Alert.alert('Comando enviado', 'A limpeza foi registrada no histórico de auditoria.'))
                            .catch((cause: unknown) =>
                              Alert.alert(
                                'Não foi possível limpar',
                                cause instanceof Error ? cause.message : 'Tente novamente.',
                              ),
                            ),
                      },
                    ],
                  )
                }
              />
              <AppButton disabled={isBusy} title="Desconectar" onPress={() => void disconnect()} variant="secondary" />
            </View>
          ) : null}
        </>
      )}

      {!isCollecting && lastSnapshot ? (
        <View style={styles.card}>
          <Text style={styles.label}>ÚLTIMA LEITURA</Text>
          <Text style={styles.sectionTitle}>{lastSnapshot.protocol ?? 'Protocolo não identificado'}</Text>
          <Text style={styles.meta}>
            {lastSnapshot.dtcs.length ? `DTCs: ${lastSnapshot.dtcs.join(', ')}` : 'Nenhum DTC identificado'}
          </Text>
          <Text style={styles.meta}>
            Qualidade: {Math.round(lastSnapshot.quality.score * 100)}% · {lastSnapshot.supportedPids.length} PID(s) detectado(s)
          </Text>
          {lastSessionId ? (
            <Pressable onPress={() => navigation.navigate('ScanReport', { scanId: lastSessionId })}>
              <Text style={styles.link}>Ver relatório salvo</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 16, padding: 24, paddingBottom: 36 },
  warning: { backgroundColor: '#FFF7E6', borderRadius: 12, gap: 6, padding: 16 },
  warningTitle: { color: '#7C2D12', fontSize: 16, fontWeight: '700' },
  warningText: { color: '#9A3412', fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 16, gap: 8, padding: 18 },
  guidedCard: { backgroundColor: '#E6F4FE', borderRadius: 16, gap: 12, padding: 18 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  status: { color: colors.text, fontSize: 20, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 20 },
  device: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, flexDirection: 'row', gap: 12, padding: 16 },
  deviceName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  flex: { flex: 1, gap: 3 },
  actions: { gap: 10 },
  progressTrack: { backgroundColor: '#B3ECFF', borderRadius: 8, height: 8, overflow: 'hidden' },
  progressFill: { backgroundColor: colors.primary, borderRadius: 8, height: '100%' },
  progressText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800', marginTop: 4 },
});
