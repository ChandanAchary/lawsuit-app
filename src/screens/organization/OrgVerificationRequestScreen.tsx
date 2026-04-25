import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';

export const OrgVerificationRequestScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [courtAdmins, setCourtAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchCourtAdmins = useCallback(async () => {
    try {
      const { data } = await organizationsApi.getEligibleCourtAdmins();
      setCourtAdmins(data.courtAdmins || data.items || data || []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to load court admins';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCourtAdmins(); }, [fetchCourtAdmins]);

  const handleSubmit = async () => {
    if (!selectedId) return Alert.alert('Required', 'Please select a court admin');
    setSubmitting(true);
    try {
      await organizationsApi.requestVerification({ courtAdminId: selectedId });
      Alert.alert('Success', 'Verification request submitted successfully! The court admin will review your organization.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to submit verification request');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCourtAdmin = ({ item }: { item: any }) => {
    const isSelected = selectedId === item.id;
    const court = item.court || {};
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => setSelectedId(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconBg, isSelected && { backgroundColor: COLORS.primary + '20' }]}>
            <Ionicons name="shield-checkmark" size={22} color={isSelected ? COLORS.primary : '#8B5CF6'} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardSub}>{item.email}</Text>
          </View>
          <View style={[styles.radio, isSelected && styles.radioSelected]}>
            {isSelected && <View style={styles.radioInner} />}
          </View>
        </View>

        {court.name && (
          <View style={styles.courtDetails}>
            <View style={styles.courtRow}>
              <Ionicons name="business-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.courtText}>{court.name}</Text>
            </View>
            {court.type && (
              <View style={styles.courtRow}>
                <Ionicons name="ribbon-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.courtText}>{court.type}</Text>
              </View>
            )}
            {(court.city || court.district) && (
              <View style={styles.courtRow}>
                <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.courtText}>{[court.city, court.district, court.state].filter(Boolean).join(', ')}</Text>
              </View>
            )}
            {court.pincode && (
              <View style={styles.courtRow}>
                <Ionicons name="pin-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.courtText}>Pincode: {court.pincode}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Verification</Text>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color={COLORS.primary} />
        <Text style={styles.infoText}>
          Select a court admin from your pincode area to verify your organization. Once verified, your lawyers will be auto-verified too.
        </Text>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={courtAdmins}
          keyExtractor={(item) => item.id}
          renderItem={renderCourtAdmin}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCourtAdmins(); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <EmptyState
              icon="🏛️"
              title="No Court Admins Found"
              message="No eligible court admins found for your pincode. Make sure your organization profile has a valid pincode."
            />
          }
        />
      )}

      {courtAdmins.length > 0 && (
        <View style={styles.footer}>
          <Button
            title="Submit Verification Request"
            onPress={handleSubmit}
            loading={submitting}
            size="lg"
            disabled={!selectedId}
          />
        </View>
      )}
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm, zIndex: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginTop: SPACING.md,
    backgroundColor: COLORS.primary + '08', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.primary + '20',
  },
  infoText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  list: { padding: SPACING.xl, paddingBottom: 120 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm, borderWidth: 2, borderColor: 'transparent',
  },
  cardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '04' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBg: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#EDE9FE',
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: COLORS.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  courtDetails: {
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1,
    borderTopColor: COLORS.borderLight, gap: SPACING.xs,
  },
  courtRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  courtText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, padding: SPACING.xl, paddingBottom: SPACING.xxl,
    ...SHADOWS.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
});
