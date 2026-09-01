import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { colors } from '../../../theme/colors';
import { useObd } from '../ObdProvider';

const statusLabels = {
  idle: 'Pronto para procurar',
  scanning: 'Procurando adaptadores…',
  connecting: 'Conectando e preparando ELM327…',
  connected: 'Adaptador conectado',
  reading: 'Lendo dados do veículo…',
};

export function ObdScreen() {
  const {
    devices,
    connectedDevice,
    lastSnapshot,
    status,
    error,
    scan,
    connect,
    runCheck,
    disconnect,
  } = useObd();
  const isBusy = status === 'scanning' || status === 'connecting' || status === 'reading';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.warning}>
        <Text style={styles.warningTitle}>Use com o veículo parado</Text>
        <Text style={styles.warningText}>
          Conecte o adaptador, estacione em local seguro e não interaja com o celular durante a
          condução.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>STATUS</Text>
        <Text style={styles.status}>{statusLabels[status]}</Text>
        {connectedDevice ? (
          <Text style={styles.meta}>{connectedDevice.name ?? connectedDevice.id}</Text>
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
              <View>
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
        <View style={styles.actions}>
          <AppButton
            disabled={isBusy}
            title={status === 'reading' ? 'Lendo…' : 'Fazer check-up'}
            onPress={() => void runCheck()}
          />
          <AppButton
            disabled={isBusy}
            title="Desconectar"
            onPress={() => void disconnect()}
            variant="secondary"
          />
        </View>
      )}

      {lastSnapshot ? (
        <View style={styles.card}>
          <Text style={styles.label}>ÚLTIMA LEITURA</Text>
          <Text style={styles.sectionTitle}>Códigos de falha</Text>
          <Text style={styles.value}>
            {lastSnapshot.dtcs.length ? lastSnapshot.dtcs.join(', ') : 'Nenhum DTC armazenado'}
          </Text>
          <Text style={styles.sectionTitle}>Parâmetros disponíveis</Text>
          {Object.entries(lastSnapshot.telemetry).map(([key, value]) => (
            <Text
              key={key}
              style={styles.value}
            >{`${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`}</Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 16, padding: 24 },
  warning: { backgroundColor: '#FFF7E6', borderRadius: 12, gap: 6, padding: 16 },
  warningTitle: { color: '#7C2D12', fontSize: 16, fontWeight: '700' },
  warningText: { color: '#9A3412', fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 16, gap: 8, padding: 18 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  status: { color: colors.text, fontSize: 20, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 20 },
  device: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  deviceName: { color: colors.text, fontSize: 16, fontWeight: '700', maxWidth: 180 },
  actions: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 8 },
  value: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
