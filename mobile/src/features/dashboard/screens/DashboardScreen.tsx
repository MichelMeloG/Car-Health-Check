import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../../../components/AppButton';
import { useAppData } from '../../../data/AppDataProvider';
import { useAuth } from '../../auth/AuthProvider';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { categoryTotals, filterExpenses, periodLabel, totalOf, type Period } from '../metrics';
import { colors } from '../../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const currency = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function DashboardScreen({ navigation }: Props) {
  const { deleteAccount, exportData, expenses, vehicle, syncError, loading } = useAppData();
  const { logout, user } = useAuth();
  const [period, setPeriod] = useState<Period>('current');
  const visibleExpenses = useMemo(() => filterExpenses(expenses, period), [expenses, period]);
  const currentTotal = totalOf(filterExpenses(expenses, 'current'));
  const previousTotal = totalOf(filterExpenses(expenses, 'previous'));
  const selectedTotal = totalOf(visibleExpenses);
  const categories = categoryTotals(visibleExpenses);
  const comparison =
    previousTotal === 0 ? null : ((currentTotal - previousTotal) / previousTotal) * 100;

  function confirmDeleteAccount() {
    Alert.alert(
      'Excluir conta e dados?',
      'Todos os gastos, veículo e dados da conta serão excluídos permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir tudo',
          style: 'destructive',
          onPress: () =>
            void deleteAccount().catch((error: unknown) => {
              const code = (error as { code?: string }).code;
              Alert.alert(
                'Não foi possível excluir a conta',
                code === 'auth/requires-recent-login'
                  ? 'Por segurança, saia e entre novamente antes de excluir a conta.'
                  : 'Tente novamente quando estiver conectado à internet.',
              );
            }),
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header} accessible accessibilityLabel="Resumo do seu carro">
        <Text style={styles.eyebrow}>MEU CARRO</Text>
        <Text style={styles.title}>Vamos cuidar do seu carro.</Text>
        <Text style={styles.description}>
          {vehicle ? vehicle.model : 'Comece cadastrando seu veículo e registre o primeiro gasto.'}
        </Text>
        <Text style={styles.account}>{user?.email}</Text>
      </View>

      {loading ? (
        <View style={styles.state} accessibilityLabel="Carregando resumo">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.description}>Carregando seus dados…</Text>
        </View>
      ) : (
        <>
          <View
            style={styles.periods}
            accessibilityRole="tablist"
            accessibilityLabel="Período do resumo"
          >
            {(['current', 'previous', 'threeMonths', 'all'] as Period[]).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="tab"
                accessibilityState={{ selected: period === option }}
                accessibilityLabel={`Filtrar por ${periodLabel(option)}`}
                onPress={() => setPeriod(option)}
                style={[styles.period, period === option && styles.periodSelected]}
              >
                <Text style={[styles.periodText, period === option && styles.periodTextSelected]}>
                  {periodLabel(option)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View
            style={styles.card}
            accessible
            accessibilityLabel={`Total selecionado: ${currency(selectedTotal)}`}
          >
            <Text style={styles.cardLabel}>GASTOS · {periodLabel(period).toUpperCase()}</Text>
            <Text style={styles.amount}>{currency(selectedTotal)}</Text>
            <Text style={styles.cardDescription}>
              {visibleExpenses.length
                ? `${visibleExpenses.length} lançamento(s) neste período.`
                : 'Nenhum gasto neste período.'}
            </Text>
          </View>

          <View style={styles.comparisonCard} accessibilityLabel="Comparação com o mês anterior">
            <Text style={styles.sectionTitle}>Comparação mensal</Text>
            {comparison === null ? (
              <Text style={styles.description}>Ainda não há dados suficientes para comparar.</Text>
            ) : (
              <Text style={styles.description}>
                {Math.abs(comparison).toFixed(0)}% {comparison >= 0 ? 'a mais' : 'a menos'} que no
                mês anterior.
              </Text>
            )}
          </View>

          {categories.length > 0 ? (
            <View
              style={styles.categoryCard}
              accessibilityLabel="Distribuição de gastos por categoria"
            >
              <Text style={styles.sectionTitle}>Por categoria</Text>
              {categories.map(([category, cents]) => (
                <View key={category} style={styles.categoryRow}>
                  <Text style={styles.categoryName}>{category}</Text>
                  <Text style={styles.categoryAmount}>{currency(cents)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.sectionTitle}>Seu resumo começa aqui</Text>
              <Text style={styles.description}>
                Registre o primeiro gasto para acompanhar categorias e evolução mensal.
              </Text>
            </View>
          )}
        </>
      )}

      {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
      <View style={styles.actions}>
        <AppButton title="Adicionar gasto" onPress={() => navigation.navigate('ExpenseForm')} />
        <AppButton
          title="Ver gastos"
          onPress={() => navigation.navigate('Expenses')}
          variant="secondary"
        />
        <AppButton
          title={vehicle ? 'Editar veículo' : 'Cadastrar veículo'}
          onPress={() => navigation.navigate('Vehicle')}
          variant="secondary"
        />
        <AppButton title="Fazer check-up OBD-II" onPress={() => navigation.navigate('Obd')} />
        <AppButton title="Sair" onPress={() => void logout()} variant="secondary" />
        <AppButton
          title="Exportar meus dados"
          onPress={() =>
            void exportData().catch(() =>
              Alert.alert('Exportação indisponível', 'Não foi possível preparar o arquivo agora.'),
            )
          }
          variant="secondary"
        />
        <AppButton title="Excluir minha conta" onPress={confirmDeleteAccount} variant="secondary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, gap: 18, padding: 24 },
  header: { gap: 10, marginTop: 12 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  account: { color: colors.muted, fontSize: 13 },
  periods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  period: {
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  periodSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  periodTextSelected: { color: colors.surface },
  card: { backgroundColor: colors.primaryDark, borderRadius: 18, gap: 8, padding: 24 },
  cardLabel: { color: '#B3ECFF', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  amount: { color: colors.surface, fontSize: 34, fontWeight: '800' },
  cardDescription: { color: '#D9E2EC', fontSize: 14 },
  comparisonCard: { backgroundColor: colors.surface, borderRadius: 16, gap: 8, padding: 18 },
  categoryCard: { backgroundColor: colors.surface, borderRadius: 16, gap: 12, padding: 18 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 16, gap: 8, padding: 18 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  categoryRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  categoryName: { color: colors.text, fontSize: 15, textTransform: 'capitalize' },
  categoryAmount: { color: colors.text, fontSize: 15, fontWeight: '700' },
  state: { alignItems: 'center', gap: 12, padding: 32 },
  actions: { gap: 12 },
  syncError: { color: '#B42318', fontSize: 14, lineHeight: 20 },
});
