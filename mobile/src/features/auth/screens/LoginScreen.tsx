import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { useAuth } from '../AuthProvider';
import { colors } from '../../../theme/colors';

function messageFor(error: unknown) {
  const code = (error as { code?: string }).code;
  if (code === 'auth/invalid-credential') return 'E-mail ou senha inválidos.';
  if (code === 'auth/email-already-in-use') return 'Este e-mail já possui uma conta.';
  if (code === 'auth/weak-password') return 'Use uma senha com pelo menos 6 caracteres.';
  if (code === 'auth/invalid-email') return 'Informe um e-mail válido.';
  return 'Não foi possível concluir agora. Verifique sua conexão e tente novamente.';
}

export function LoginScreen() {
  const { resetPassword, signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert('Campos obrigatórios', 'Informe e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      if (registering) await signUp(email, password);
      else await signIn(email, password);
    } catch (error) {
      Alert.alert('Acesso não realizado', messageFor(error));
    } finally {
      setLoading(false);
    }
  }

  async function recoverAccess() {
    if (!email.trim()) {
      Alert.alert('Informe seu e-mail', 'Preencha o e-mail para receber o link de recuperação.');
      return;
    }
    try {
      await resetPassword(email);
      Alert.alert('E-mail enviado', 'Verifique sua caixa de entrada para redefinir a senha.');
    } catch (error) {
      Alert.alert('Não foi possível enviar', messageFor(error));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{registering ? 'Criar conta' : 'Entrar'}</Text>
        <Text style={styles.description}>
          {registering
            ? 'Crie uma conta para manter os gastos sincronizados.'
            : 'Acesse seus veículos e gastos sincronizados.'}
        </Text>
      </View>
      <View style={styles.form}>
        <AppInput
          keyboardType="email-address"
          label="E-mail"
          onChangeText={setEmail}
          placeholder="voce@exemplo.com"
          value={email}
        />
        <AppInput
          label="Senha"
          onChangeText={setPassword}
          placeholder="Mínimo de 6 caracteres"
          secureTextEntry
          value={password}
        />
        <AppButton
          disabled={loading}
          title={loading ? 'Aguarde…' : registering ? 'Criar conta' : 'Entrar'}
          onPress={() => void submit()}
        />
        <AppButton
          title={registering ? 'Já tenho uma conta' : 'Criar uma conta'}
          variant="secondary"
          onPress={() => setRegistering((value) => !value)}
        />
        {!registering && (
          <Text onPress={() => void recoverAccess()} style={styles.link}>
            Esqueci minha senha
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1, gap: 32, padding: 24 },
  header: { gap: 12, marginTop: 24 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  form: { gap: 16 },
  link: { color: colors.primary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
