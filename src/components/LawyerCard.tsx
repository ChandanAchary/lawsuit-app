import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../constants';
import { Lawyer } from '../types';

interface LawyerCardProps {
  lawyer: Lawyer;
  onPress: () => void;
  style?: ViewStyle;
}

export const LawyerCard: React.FC<LawyerCardProps> = ({ lawyer, onPress, style }) => {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.card, style]}>
      <View style={styles.row}>
        <View style={styles.avatarWrapper}>
          {((lawyer.avatar && lawyer.avatar.length) || lawyer.name) ? (
            <Image
              source={{ uri: lawyer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(lawyer.name)}&size=256&background=EAF2F3&color=0B4D64` }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={28} color={COLORS.textMuted} />
            </View>
          )}
          {lawyer.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{lawyer.name}</Text>
          {lawyer.specialization?.length > 0 && (
            <Text style={styles.specialization} numberOfLines={1}>
              {lawyer.specialization.slice(0, 2).join(' · ')}
            </Text>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={13} color={COLORS.accent} />
              <Text style={styles.metaText}>{lawyer.rating?.toFixed(1) || '0.0'}</Text>
              <Text style={styles.metaSubtext}>({lawyer.reviewsCount || 0})</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="briefcase-outline" size={13} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{lawyer.experienceYears}y</Text>
            </View>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
              <Text style={styles.locationText} numberOfLines={1}>{lawyer.location || 'N/A'}</Text>
            </View>
            <View style={styles.feeContainer}>
              <Text style={styles.feeLabel}>₹</Text>
              <Text style={styles.fee}>{lawyer.fee?.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.xl,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: COLORS.white,
    borderRadius: 10,
  },
  info: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  name: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  specialization: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.textMuted,
    marginHorizontal: SPACING.sm,
  },
  metaText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  metaSubtext: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  locationText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  feeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  feeLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  fee: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.primary,
    fontWeight: '800',
  },
});
