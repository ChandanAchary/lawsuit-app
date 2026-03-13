import { useThemeStore } from '../../stores/themeStore';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { courtAdminApi } from '../../services/api';
import { Button } from '../../components/Button';
import { storage } from '../../services/storage';
import { useAuthStore } from '../../stores/authStore';

export const CourtAdminLoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../../stores/themeStore').DARK_COLORS : require('../../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      return Alert.alert('Error', 'Please enter email and password');
    }
    setLoading(true);
    try {
      const { data } = await courtAdminApi.login(email.trim(), password);
      if (data.accessToken) {
        await storage.setToken(data.accessToken);
        // Store court admin session via zustand setState (same pattern as authStore.login)
        const courtAdmin = data.courtAdmin || {};
        const courtAdminUser = {
          id: courtAdmin.id,
          name: courtAdmin.name,
          email: courtAdmin.email,
          role: 'COURT_ADMIN' as any,
        };
        await storage.setUser(courtAdminUser as any);
        useAuthStore.setState({ user: courtAdminUser, token: data.accessToken, isAuthenticated: true, isLoading: false });
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Invalid credentials';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={48} color={COLORS.accent} />
        </View>
        <Text style={styles.title}>Court Admin</Text>
        <Text style={styles.subtitle}>Sign in to manage lawyer verifications</Text>
      </LinearGradient>

      <View style={styles.form}>
        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <Button title="Sign In" onPress={handleLogin} loading={loading} size="lg" />
      </View>
    </KeyboardAvoidingView>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: SPACING.huge + SPACING.xl, paddingBottom: SPACING.xxxl,
    paddingHorizontal: SPACING.xl, alignItems: 'center',
    borderBottomLeftRadius: BORDER_RADIUS.xxl, borderBottomRightRadius: BORDER_RADIUS.xxl,
  },
  backBtn: {
    position: 'absolute', top: SPACING.huge, left: SPACING.xl,
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg,
  },
  title: { fontSize: FONT_SIZE.hero, fontWeight: '900', color: COLORS.white },
  subtitle: { fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.sm, textAlign: 'center' },
  form: { padding: SPACING.xl, marginTop: SPACING.xl },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg, ...SHADOWS.sm,
  },
  inputIcon: { marginRight: SPACING.sm },
  input: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text, paddingVertical: SPACING.lg },
});
