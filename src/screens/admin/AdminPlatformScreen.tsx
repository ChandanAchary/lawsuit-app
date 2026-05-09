import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { useColors, useThemeStore } from '../../stores/themeStore';

// =============================================================================
// AdminPlatformScreen — the navigation menu surface that previously lived
// inside AdminDashboardScreen. The dashboard now hosts only stats + charts
// + the attention widget, with profile / notifications reachable via the
// top-right header. Every drill-down (People, Courts, Content, Platform)
// lives here, gated by the same per-admin permission check used elsewhere.
// =============================================================================

export const AdminPlatformScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const user = useAuthStore((s) => s.user);
  const isSuper = user?.level === 'SUPER_ADMIN';
  // Mirrors the server-side requirePermission middleware. SUPER_ADMIN gets
  // implicit "all"; ADMINs need the matching permission key on their row.
  const canAccess = (key: string) => isSuper || (user?.permissions ?? []).includes(key);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <LinearGradient colors={[COLORS.midnight, COLORS.primary]} style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="grid" size={26} color={COLORS.accent} />
        </View>
        <Text style={styles.heroTitle}>Platform</Text>
        <Text style={styles.heroSub}>
          Manage people, courts, content & platform settings
        </Text>
      </LinearGradient>

      <Section label="PEOPLE" styles={styles}>
        {canAccess('USERS') && (
          <MenuItem
            icon="people-outline"
            label="All users"
            desc={isSuper
              ? 'Browse all roles · ban, KYC override, verify from each user'
              : 'Verify and inspect clients & lawyers'}
            onPress={() => navigation.navigate('AdminUsers')}
            styles={styles} COLORS={COLORS}
          />
        )}
      </Section>

      <Section label="COURTS" styles={styles}>
        {isSuper && (
          <MenuItem
            icon="checkmark-done-outline"
            label="Court admin approvals"
            desc="Review and approve self-onboarded court admins"
            onPress={() => navigation.navigate('SuperAdminCourtAdminApprovals')}
            styles={styles} COLORS={COLORS}
          />
        )}
        {canAccess('COURTS') && (
          <MenuItem
            icon="business-outline"
            label="Courts directory"
            desc="Manage courts in the platform"
            onPress={() => navigation.navigate('CourtManagement')}
            styles={styles} COLORS={COLORS}
          />
        )}
        {canAccess('COURT_ADMIN_TEAM') && (
          <MenuItem
            icon="shield-outline"
            label="Court admin team"
            desc="Manage court admins"
            onPress={() => navigation.navigate('CourtAdminManagement')}
            styles={styles} COLORS={COLORS}
          />
        )}
        {isSuper && (
          <MenuItem
            icon="ribbon-outline"
            label="Performance & salary"
            desc="Court admin metrics, salary cycle and payouts"
            onPress={() => navigation.navigate('SuperAdminCourtAdminOps')}
            styles={styles} COLORS={COLORS}
          />
        )}
      </Section>

      <Section label="CONTENT" styles={styles}>
        {canAccess('REPORTS') && (
          <MenuItem
            icon="alert-circle-outline"
            label="User reports"
            desc="Triage bug reports and issues from users"
            onPress={() => navigation.navigate('AdminReports')}
            styles={styles} COLORS={COLORS}
          />
        )}
        {canAccess('LEGAL_UPDATES') && (
          <MenuItem
            icon="newspaper-outline"
            label="Legal updates"
            desc="Publish and edit legal news entries"
            onPress={() => navigation.navigate('AdminLegalUpdates')}
            styles={styles} COLORS={COLORS}
          />
        )}
        {isSuper && (
          <MenuItem
            icon="megaphone-outline"
            label="Announcements"
            desc="Broadcast a message to every user on the platform"
            onPress={() => navigation.navigate('AdminAnnouncements')}
            styles={styles} COLORS={COLORS}
          />
        )}
      </Section>

      {isSuper && (
        <Section label="PLATFORM" styles={styles}>
          <MenuItem
            icon="people-circle-outline"
            label="Admin team"
            desc="Invite, edit, and deactivate platform admins"
            onPress={() => navigation.navigate('AdminTeam')}
            styles={styles} COLORS={COLORS}
          />
          <MenuItem
            icon="settings-outline"
            label="Platform config"
            desc="Commission, GST, TDS and feature flags"
            onPress={() => navigation.navigate('SuperAdminPlatformConfig')}
            styles={styles} COLORS={COLORS}
          />
          <MenuItem
            icon="cash-outline"
            label="Salary Management"
            desc="Performance-based payroll for lawyers, organisations & court admins"
            onPress={() => navigation.navigate('SuperAdminEntitySalaryCycle')}
            styles={styles} COLORS={COLORS}
          />
        </Section>
      )}
    </ScrollView>
  );
};

const Section = ({ label, styles, children }: any) => {
  // Strip the divider on the last menu item so the rounded card doesn't
  // leave a stray hairline against its bottom edge.
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  const cloned = items.map((child: any, idx: number) =>
    React.isValidElement(child) && idx === items.length - 1
      ? React.cloneElement(child, { isLast: true } as any)
      : child,
  );
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      <View style={styles.menuCard}>{cloned}</View>
    </View>
  );
};

const MenuItem = ({ icon, label, desc, onPress, isLast, styles, COLORS }: any) => (
  <TouchableOpacity
    style={[styles.menuItem, isLast && styles.menuItemLast]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.menuIcon}>
      <Ionicons name={icon} size={20} color={COLORS.primary} />
    </View>
    <View style={styles.menuInfo}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuDesc}>{desc}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 120 },

  hero: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge + SPACING.md,
    paddingBottom: SPACING.xxxl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl, borderBottomRightRadius: BORDER_RADIUS.xxl,
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: { fontSize: FONT_SIZE.xxxl, fontWeight: '900', color: COLORS.white },
  heroSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.78)', marginTop: 4, textAlign: 'center' },

  section: { paddingHorizontal: SPACING.xl, marginTop: SPACING.xl },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.sm, paddingHorizontal: SPACING.xs,
  },
  sectionLabel: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },

  menuCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, ...SHADOWS.sm, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primaryLight + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  menuDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
});

export default AdminPlatformScreen;
