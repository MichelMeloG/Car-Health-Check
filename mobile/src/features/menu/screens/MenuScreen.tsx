import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppData } from '../../../data/AppDataProvider';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme/colors';
import { useAuth } from '../../auth/AuthProvider';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RowProps = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  detail?: string;
  onPress?: () => void;
  destructive?: boolean;
};

function MenuRow({ icon, title, detail, onPress, destructive = false }: RowProps) {
  const content = (
    <>
      <View style={[styles.icon, destructive && styles.destructiveIcon]}>
        <MaterialCommunityIcons
          color={destructive ? '#B42318' : colors.primary}
          name={icon}
          size={21}
        />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.rowTitle, destructive && styles.destructiveText]}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {onPress ? (
        <MaterialCommunityIcons color={colors.muted} name="chevron-right" size={22} />
      ) : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      {content}
    </Pressable>
  );
}

export function MenuScreen() {
  const navigation = useNavigation<Nav>();
  const { exportData, deleteAccount, syncError } = useAppData();
  const { logout } = useAuth();

  function confirmDelete() {
    Alert.alert(
      'Excluir conta?',
      'Todos os veículos e lançamentos serão removidos permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir conta',
          style: 'destructive',
          onPress: () =>
            void deleteAccount().catch(() =>
              Alert.alert('Não foi possível excluir', 'Entre novamente e tente de novo.'),
            ),
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Conta</Text>
      <View style={styles.group}>
        <MenuRow
          icon="account-circle-outline"
          title="Meu perfil"
          detail="Nome exibido na tela inicial"
          onPress={() => navigation.navigate('Profile')}
        />
      </View>
      <Text style={styles.heading}>Dados e privacidade</Text>
      <View style={styles.group}>
        <MenuRow
          icon="export-variant"
          title="Exportar meus dados"
          detail="Baixar uma cópia dos seus veículos e lançamentos"
          onPress={() =>
            void exportData().catch(() =>
              Alert.alert('Exportação indisponível', 'Não foi possível criar o arquivo agora.'),
            )
          }
        />
        <MenuRow
          icon="shield-lock-outline"
          title="Privacidade"
          detail="Seus dados são separados e protegidos pela sua conta."
        />
      </View>
      <Text style={styles.heading}>Suporte</Text>
      <View style={styles.group}>
        <MenuRow
          icon="lifebuoy"
          title="Ajuda e suporte"
          detail="Em caso de problema, informe a versão do app e uma descrição do ocorrido."
        />
        <MenuRow
          icon={syncError ? 'cloud-alert-outline' : 'cloud-check-outline'}
          title={syncError ? 'Sincronização pendente' : 'Dados sincronizados automaticamente'}
          detail={syncError ?? 'Alterações são enviadas quando houver conexão disponível.'}
        />
      </View>
      <Text style={styles.heading}>Sessão</Text>
      <View style={styles.group}>
        <MenuRow icon="logout" title="Sair" onPress={() => void logout()} />
        <MenuRow
          destructive
          icon="delete-outline"
          title="Excluir minha conta"
          detail="Remove todos os dados da sua conta"
          onPress={confirmDelete}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    gap: 10,
    padding: 24,
    paddingBottom: 36,
  },
  heading: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 10 },
  group: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 70,
    padding: 15,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: '#E6F4FE',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  destructiveIcon: { backgroundColor: '#FEE4E2' },
  copy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  destructiveText: { color: '#B42318' },
  detail: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
