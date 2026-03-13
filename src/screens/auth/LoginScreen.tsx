import { useThemeStore } from '../../stores/themeStore';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuthStore } from '../../stores/authStore';

type RoleChoice = 'CLIENT' | 'LAWYER';

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../../stores/themeStore').DARK_COLORS : require('../../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [selectedRole, setSelectedRole] = useState<RoleChoice | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

  const [localError, setLocalError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setLocalError('Please fill in all fields');
      return;
    }
    setLocalError('');
    clearError();
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Invalid credentials';
      setLocalError(msg);
    }
  };

  // ─── Role Selection Screen ────────────────────────────
  if (!selectedRole) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.roleScreen}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.roleHeader}>
            <Text style={styles.roleTitle}>Sign in as</Text>
            <Text style={styles.roleSubtitle}>Choose how you want to continue</Text>
          </View>

          <View style={styles.roleCards}>
            <TouchableOpacity
              style={styles.roleCard}
              activeOpacity={0.7}
              onPress={() => setSelectedRole('CLIENT')}
            >
              <View style={[styles.roleCardIcon, { backgroundColor: COLORS.primary + '12' }]}>
                <Ionicons name="person" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.roleCardTitle}>Client</Text>
              <Text style={styles.roleCardDesc}>Find lawyers & manage your legal matters</Text>
              <View style={styles.roleCardArrow}>
                <Ionicons name="arrow-forward" size={20} color={COLORS.primary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.roleCard}
              activeOpacity={0.7}
              onPress={() => setSelectedRole('LAWYER')}
            >
              <View style={[styles.roleCardIcon, { backgroundColor: COLORS.midnight + '12' }]}>
                <Ionicons name="briefcase" size={32} color={COLORS.midnight} />
              </View>
              <Text style={styles.roleCardTitle}>Lawyer</Text>
              <Text style={styles.roleCardDesc}>Manage appointments, cases & clients</Text>
              <View style={styles.roleCardArrow}>
                <Ionicons name="arrow-forward" size={20} color={COLORS.midnight} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ─── Login Form Screen ────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedRole(null)}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in as{' '}
            <Text style={{ fontWeight: '700', color: COLORS.primary }}>
              {selectedRole === 'CLIENT' ? 'Client' : 'Lawyer'}
            </Text>
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            icon={<Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />}
          />
          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            }
          />

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {(localError || error) ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.error} />
              <Text style={styles.errorText}>{localError || error}</Text>
            </View>
          ) : null}

          <Button title="Sign In" onPress={handleLogin} loading={isLoading} size="lg" />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.xxl, paddingBottom: SPACING.xxxl },
  backBtn: {
    marginTop: SPACING.huge,
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Role Selection ──
  roleScreen: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
  },
  roleHeader: {
    marginTop: SPACING.xxxl,
    marginBottom: SPACING.xxxl,
  },
  roleTitle: {
    fontSize: FONT_SIZE.hero,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  roleSubtitle: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  roleCards: {
    gap: SPACING.lg,
  },
  roleCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.md,
  },
  roleCardIcon: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  roleCardTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  roleCardDesc: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    lineHeight: 20,
  },
  roleCardArrow: {
    position: 'absolute',
    top: SPACING.xxl,
    right: SPACING.xxl,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Login Form ──
  headerSection: { marginTop: SPACING.xxxl, marginBottom: SPACING.xxxl },
  welcome: { fontSize: FONT_SIZE.hero, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: FONT_SIZE.lg, color: COLORS.textSecondary, marginTop: SPACING.sm },
  form: {},
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error + '12',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    fontWeight: '500',
  },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: SPACING.xxl, marginTop: -SPACING.sm },
  forgotText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.xxl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: {
    marginHorizontal: SPACING.lg,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 48,
    marginBottom: 24,
  },
  footerText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  footerLink: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
});
