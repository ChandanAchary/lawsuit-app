import {  useThemeStore , useColors } from '../stores/themeStore';
import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { TextInput, View, Text, StyleSheet, TextInputProps, ViewStyle, TouchableOpacity } from 'react-native';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../constants';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  icon,
  rightIcon,
  style,
  secureTextEntry,
  ...props
}) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry !== undefined;
  const showInternalEye = isPassword && !rightIcon;

  const sanitizeInlineNode = (node: React.ReactNode): React.ReactNode => {
    if (node == null || typeof node === 'boolean') return null;
    if (typeof node === 'string') {
      if (!node.trim()) return null;
      return <Text style={styles.label}>{node}</Text>;
    }
    if (typeof node === 'number') {
      return <Text style={styles.label}>{String(node)}</Text>;
    }
    if (Array.isArray(node)) {
      return node.map((child, idx) => (
        <React.Fragment key={idx}>{sanitizeInlineNode(child)}</React.Fragment>
      ));
    }
    return node;
  };

  const safeIcon = sanitizeInlineNode(icon);
  const safeRightIcon = sanitizeInlineNode(rightIcon);

  const derivePlaceholderFromLabel = (rawLabel?: string): string => {
    const cleaned = (rawLabel || '')
      .replace(/\*/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();

    if (!cleaned) return '';
    if (/bio/i.test(cleaned)) return 'Tell us about yourself';
    if (/email/i.test(cleaned)) return 'Enter email address';
    if (/phone/i.test(cleaned)) return 'Enter phone number';
    return `Enter ${cleaned.toLowerCase()}`;
  };

  const resolvedPlaceholder =
    typeof props.placeholder === 'string' && props.placeholder.trim().length > 0
      ? props.placeholder
      : derivePlaceholderFromLabel(typeof label === 'string' ? label : '');

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, error ? styles.inputError : undefined]}>
        {safeIcon && <View style={styles.icon}>{safeIcon}</View>}
        <TextInput
          style={[styles.input, icon ? styles.inputWithIcon : undefined, style]}
          placeholderTextColor={COLORS.textSecondary}
          secureTextEntry={
            // If parent provided a rightIcon (likely controlling visibility externally), respect parent's secureTextEntry
            rightIcon ? (secureTextEntry as boolean | undefined) : (isPassword ? !showPassword : undefined)
          }
          {...props}
          placeholder={resolvedPlaceholder}
        />
        {showInternalEye && (
          <TouchableOpacity style={styles.rightIcon} onPress={() => setShowPassword((v) => !v)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
        {!showInternalEye && safeRightIcon && <View style={styles.rightIcon}>{safeRightIcon}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  icon: {
    paddingLeft: SPACING.lg,
  },
  rightIcon: {
    paddingRight: SPACING.lg,
    paddingLeft: SPACING.md,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.lg,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  inputWithIcon: {
    paddingLeft: SPACING.sm,
  },
  error: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },
});
