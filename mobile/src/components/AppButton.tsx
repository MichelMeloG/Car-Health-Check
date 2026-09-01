import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function AppButton({ title, onPress, variant = 'primary', disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, padding: 16 },
  secondary: { backgroundColor: '#E6F4FE' },
  label: { color: colors.surface, fontSize: 16, fontWeight: '700' },
  secondaryLabel: { color: colors.primary },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
});
