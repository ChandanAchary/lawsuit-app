import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, COLORS as STATIC_COLORS } from '../../constants';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../services/api';
import { formatErrorMessage } from '../../utils/formatError';

const getPasswordStrength = (pw: string): { label: string; color: string; width: string } => {
  if (!pw) return { label: '', color: STATIC_COLORS.border, width: '0%' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: 'Weak', color: STATIC_COLORS.error, width: '33%' };
  if (score <= 3) return { label: 'Medium', color: STATIC_COLORS.warning, width: '66%' };
  return { label: 'Strong', color: STATIC_COLORS.success, width: '100%' };
};

interface Props {
  // When `forced` is true, this screen is rendered because the server set
  // mustChangePassword=true on the user. The only escape hatches are
  // completing the change or logging out.
  forced?: boolean;
  onDone?: () => void;
  navigation?: any;
}

export const ChangePasswordScreen: React.FC<Props> = ({ forced, onDone, navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const handleSubmit = async () => {
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Error', 'New password must be different from the current one');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      // Re-fetch /auth/me so the locally-cached user clears mustChangePassword.
      try {
        const { data } = await authApi.getMe();
        const fresh = (data?.user || data) as any;
        if (fresh) setUser({ ...(user as any), ...fresh, mustChangePassword: false });
      } catch {
        if (user) setUser({ ...user, mustChangePassword: false });
      }

      Alert.alert('Success', 'Password updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            if (onDone) onDone();
            else if (navigation && !forced) navigation.goBack();
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Logout without changing your password?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => { void logout(); } },
    ]);
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!forced && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        )}

        <View style={styles.iconSection}>
          <View style={styles.iconBg}>
            <Ionicons name="key-outline" size={36} color={COLORS.primary} />
          </View>
        </View>

        <Text style={styles.title}>
          {forced ? 'Set Your Password' : 'Change Password'}
        </Text>
        <Text style={styles.subtitle}>
          {forced
            ? 'For security, you must replace the temporary password before continuing. Use the temp password from your invitation email as the current password.'
            : 'Pick a strong new password for your account.'}
        </Text>

        <View style={styles.formSection}>
          <Input
            label={forced ? 'Temporary Password' : 'Current Password'}
            placeholder={forced ? 'From your invitation email' : 'Enter current password'}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showCurrent}
            icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            }
          />

          <Input
            label="New Password"
            placeholder="Enter new password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNew}
            icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            }
          />

          {newPassword.length > 0 && (
            <View style={styles.strengthSection}>
              <View style={styles.strengthBar}>
                <View style={[styles.strengthFill, { width: strength.width as any, backgroundColor: strength.color }]} />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </View>
          )}

          <Input
            label="Confirm New Password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirm}
            icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            }
            error={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : undefined}
          />

          <Button
            title={forced ? 'Set Password & Continue' : 'Update Password'}
            onPress={handleSubmit}
            loading={submitting}
            size="lg"
          />

          {forced && (
            <TouchableOpacity onPress={handleLogout} style={styles.logoutLink}>
              <Text style={styles.logoutLinkText}>Log out instead</Text>
            </TouchableOpacity>
          )}
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
  iconSection: { alignItems: 'center', marginTop: SPACING.xxxl + SPACING.md },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    lineHeight: 22,
  },
  formSection: { marginTop: SPACING.xxxl },
  strengthSection: { marginTop: -SPACING.sm, marginBottom: SPACING.lg },
  strengthBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 3 },
  strengthLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    marginTop: SPACING.xs,
    textAlign: 'right',
  },
  logoutLink: { alignItems: 'center', marginTop: SPACING.xl },
  logoutLinkText: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, fontWeight: '600' },
});
