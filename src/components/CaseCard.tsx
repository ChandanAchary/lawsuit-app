import { useThemeStore } from '../stores/themeStore';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, CASE_STATUS_COLORS } from '../constants';
import { Case } from '../types';
import { formatDate } from '../utils/date';

interface CaseCardProps {
  caseItem: Case;
  onPress: () => void;
  style?: ViewStyle;
}

export const CaseCard: React.FC<CaseCardProps> = ({ caseItem, onPress, style }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../stores/themeStore').DARK_COLORS : require('../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const statusColor = CASE_STATUS_COLORS[caseItem.status] || CASE_STATUS_COLORS.OPEN;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="briefcase" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.titleInfo}>
            <Text style={styles.title} numberOfLines={1}>{caseItem.title}</Text>
            {caseItem.caseNumber && (
              <Text style={styles.caseNumber}>#{caseItem.caseNumber}</Text>
            )}
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusText, { color: statusColor.text }]}>{caseItem.status}</Text>
        </View>
      </View>

      {caseItem.category && (
        <View style={styles.categoryRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{caseItem.category}</Text>
          </View>
          {caseItem.resolutionMethod && (
            <View style={[styles.categoryBadge, { backgroundColor: COLORS.infoLight }]}>
              <Text style={[styles.categoryText, { color: COLORS.info }]}>
                {caseItem.resolutionMethod}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="person-outline" size={13} color={COLORS.textSecondary} />
          <Text style={styles.footerText}>
            {caseItem.lawyer?.name || caseItem.client?.name || 'Assigned'}
          </Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
          <Text style={styles.footerText}>{formatDate(caseItem.createdAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  caseNumber: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  categoryBadge: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  footerText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
});
