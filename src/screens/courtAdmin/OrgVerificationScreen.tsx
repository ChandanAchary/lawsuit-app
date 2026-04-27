import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput, Modal, ScrollView, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { courtAdminApi, lawyersApi } from '../../services/api';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { formatDate } from '../../utils/date';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'history', label: 'History' },
];

export const OrgVerificationScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Action modal
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Lawyers modal
  const [orgLawyers, setOrgLawyers] = useState<any[]>([]);
  const [showLawyersModal, setShowLawyersModal] = useState(false);
  const [loadingLawyers, setLoadingLawyers] = useState(false);

  const fetchLawyersForOrg = async (orgId: string) => {
    setLoadingLawyers(true);
    setShowLawyersModal(true);
    try {
      const { data } = await lawyersApi.getAll({ organizationId: orgId });
      let fetchedLawyers = data.lawyers || data.items || data || [];
      // Client-side filter to ensure we only show lawyers for this org
      fetchedLawyers = fetchedLawyers.filter((l: any) => l.organizationId === orgId);
      setOrgLawyers(fetchedLawyers);
    } catch {
      setOrgLawyers([]);
    } finally {
      setLoadingLawyers(false);
    }
  };

  const getErrorMessage = (err: any, fallback: string) => {
    const raw = err?.response?.data?.error ?? err?.message;
    if (!raw) return fallback;
    if (typeof raw === 'string') return raw;
    return String(raw);
  };

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      if (tab === 'pending') {
        const { data } = await courtAdminApi.getPendingOrganizationVerifications();
        setPending(data.items || data.organizations || data || []);
      } else {
        const { data } = await courtAdminApi.getMyOrganizationVerifications();
        const rows = data.verifications || data.items || data || [];
        const normalized = Array.isArray(rows)
          ? rows.filter((row: any) => String(row?.status || '').trim().toUpperCase() !== 'PENDING')
          : [];
        setHistory(normalized);
      }
    } catch { tab === 'pending' ? setPending([]) : setHistory([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVerify = async () => {
    if (!selectedOrg || !actionType) return;
    setSubmitting(true);
    try {
      const orgId = selectedOrg.organization?.id || selectedOrg.organizationId || selectedOrg.id;
      await courtAdminApi.verifyOrganization(orgId, {
        status: actionType,
        notes: remarks.trim() || undefined,
      });
      Alert.alert('Success', `Organization ${actionType.toLowerCase()} successfully`);
      setSelectedOrg(null);
      setActionType(null);
      setRemarks('');
      fetchData(false);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Verification failed'));
    } finally { setSubmitting(false); }
  };

  const openAction = (org: any, type: 'APPROVED' | 'REJECTED') => {
    setSelectedOrg(org);
    setActionType(type);
    setRemarks('');
  };

  const openDetails = (item: any) => setSelectedDetails(item);

  const renderPending = ({ item }: { item: any }) => {
    const org = item.organization || item;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openDetails(item)}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBg, { backgroundColor: '#EDE9FE' }]}>
            {org.logoUrl ? (
              <Image source={{ uri: org.logoUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="business" size={22} color="#8B5CF6" />
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{org.name || 'Unknown Organization'}</Text>
            <Text style={styles.cardSub}>{org.email || ''}</Text>
          </View>
        </View>
        
        <View style={styles.detailsGrid}>
          {org.registrationNumber && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Reg Number</Text>
              <Text style={styles.detailValue}>{org.registrationNumber}</Text>
            </View>
          )}
          {org.type && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>{org.type}</Text>
            </View>
          )}
          {org.city && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>City</Text>
              <Text style={styles.detailValue}>{org.city}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={() => openDetails(item)} style={styles.viewDetailsBtn}>
          <Ionicons name="eye-outline" size={15} color={COLORS.primary} />
          <Text style={styles.viewDetailsText}>View Full Details</Text>
        </TouchableOpacity>
        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#D1FAE5' }]} onPress={() => openAction(item, 'APPROVED')}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={[styles.actionText, { color: '#10B981' }]}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => openAction(item, 'REJECTED')}>
            <Ionicons name="close-circle" size={18} color="#EF4444" />
            <Text style={[styles.actionText, { color: '#EF4444' }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHistory = ({ item }: { item: any }) => {
    const org = item.organization || item;
    const normalizedStatus = String(item?.status || '').trim().toUpperCase();
    const isApproved = normalizedStatus === 'APPROVED';
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openDetails(item)}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBg, { backgroundColor: isApproved ? '#D1FAE5' : '#FEE2E2' }]}>
            {org.logoUrl ? (
              <Image source={{ uri: org.logoUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name={isApproved ? 'checkmark-circle' : 'close-circle'} size={22} color={isApproved ? '#10B981' : '#EF4444'} />
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{org.name || 'Unknown Organization'}</Text>
            <Text style={styles.cardSub}>{normalizedStatus} · {formatDate(item.verifiedAt || item.createdAt)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isApproved ? '#D1FAE5' : '#FEE2E2' }]}>
            <Text style={[styles.badgeText, { color: isApproved ? '#10B981' : '#EF4444' }]}>{normalizedStatus}</Text>
          </View>
        </View>
        {item.remarks && (
          <Text style={styles.remarks}>Remarks: {item.remarks}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderDetailRow = (label: string, value?: string) => {
    if (!value) return null;
    return (
      <View style={styles.detailRowModal}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowValue}>{value}</Text>
      </View>
    );
  };

  const orgData = selectedDetails?.organization || selectedDetails || {};

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Org Verification</Text>
      </View>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />

      {loading ? <Loading /> : (
        <FlatList
          data={tab === 'pending' ? pending : history}
          keyExtractor={(item) => item.id}
          renderItem={tab === 'pending' ? renderPending : renderHistory}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'pending' ? '✅' : '📋'}
              title={tab === 'pending' ? 'No Pending Organizations' : 'No History'}
              message={tab === 'pending' ? 'All organizations have been reviewed' : 'Your verifications will appear here'}
            />
          }
        />
      )}

      {/* Verify/Reject Modal */}
      <Modal visible={!!actionType} transparent animationType="slide" onRequestClose={() => { setActionType(null); setSelectedOrg(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{actionType === 'APPROVED' ? 'Approve Organization' : 'Reject Organization'}</Text>
              <TouchableOpacity onPress={() => { setActionType(null); setSelectedOrg(null); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.confirmText}>
                {actionType === 'APPROVED'
                  ? `Are you sure you want to approve ${selectedOrg?.organization?.name || selectedOrg?.name || 'this organization'}?`
                  : `Are you sure you want to reject ${selectedOrg?.organization?.name || selectedOrg?.name || 'this organization'}?`}
              </Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Add remarks (optional)"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
              <Button
                title={actionType === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection'}
                onPress={handleVerify}
                loading={submitting}
                size="lg"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Details Modal */}
      <Modal visible={!!selectedDetails} transparent animationType="slide" onRequestClose={() => setSelectedDetails(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Organization Details</Text>
              <TouchableOpacity onPress={() => setSelectedDetails(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailsScroll} contentContainerStyle={{ paddingBottom: SPACING.lg }}>
              <View style={styles.detailsTopCard}>
                <View style={[styles.iconBg, { backgroundColor: '#EDE9FE' }]}>
                  {orgData?.logoUrl ? (
                    <Image source={{ uri: orgData?.logoUrl }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="business" size={22} color="#8B5CF6" />
                  )}
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{orgData?.name || 'Unknown Organization'}</Text>
                  <Text style={styles.cardSub}>{orgData?.email || ''}</Text>
                </View>
              </View>

              {renderDetailRow('Phone', orgData?.phone)}
              {renderDetailRow('Registration Number', orgData?.registrationNumber)}
              {renderDetailRow('Type', orgData?.type)}
              {renderDetailRow('Address', orgData?.address)}
              {renderDetailRow('City', orgData?.city)}
              {renderDetailRow('State', orgData?.state)}
              {renderDetailRow('Pincode', orgData?.pincode)}
              {renderDetailRow('Description', orgData?.description)}
              {renderDetailRow('Requested On', formatDate(selectedDetails?.createdAt))}
              {renderDetailRow('Status', selectedDetails?.status)}
              {renderDetailRow('Verified On', selectedDetails?.verifiedAt ? formatDate(selectedDetails?.verifiedAt) : undefined)}
              {renderDetailRow('Remarks', selectedDetails?.remarks)}

              {String(selectedDetails?.status || '').toUpperCase() === 'APPROVED' && orgData?.id && (
                <Button 
                  title="View Organization Lawyers" 
                  onPress={() => {
                    setSelectedDetails(null);
                    fetchLawyersForOrg(orgData.id);
                  }} 
                  style={{ marginTop: SPACING.xl }} 
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Lawyers List Modal */}
      <Modal visible={showLawyersModal} transparent animationType="slide" onRequestClose={() => setShowLawyersModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Organization Lawyers</Text>
              <TouchableOpacity onPress={() => setShowLawyersModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {loadingLawyers ? (
              <View style={{ padding: SPACING.xxxl }}><Loading /></View>
            ) : (
              <FlatList
                data={orgLawyers}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: SPACING.xl, paddingBottom: SPACING.xxl }}
                renderItem={({ item }) => (
                  <View style={styles.lawyerCard}>
                    <View style={styles.lawyerHeader}>
                      <View style={styles.lawyerAvatar}>
                        {item.avatarUrl ? (
                          <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                        ) : (
                          <Ionicons name="person" size={20} color={COLORS.primary} />
                        )}
                      </View>
                      <View style={styles.lawyerInfo}>
                        <Text style={styles.lawyerName}>{item.name}</Text>
                        <Text style={styles.lawyerEmail}>{item.email}</Text>
                      </View>
                      {item.isVerified && (
                        <View style={[styles.badge, { backgroundColor: '#D1FAE5' }]}>
                          <Text style={[styles.badgeText, { color: '#10B981' }]}>Verified</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.lawyerDetails}>
                      {item.licenseNumber && <Text style={styles.lawyerText}>License: {item.licenseNumber}</Text>}
                      {item.barCouncilId && <Text style={styles.lawyerText}>Bar Council: {item.barCouncilId}</Text>}
                      {item.phone && <Text style={styles.lawyerText}>Phone: {item.phone}</Text>}
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <EmptyState icon="👥" title="No Lawyers Found" message="This organization hasn't added any lawyers yet." />
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBg: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  detailsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md,
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  detailItem: { width: '45%' },
  detailLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  detailValue: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  viewDetailsBtn: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  viewDetailsText: { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '700' },
  cardActions: {
    flexDirection: 'row', gap: SPACING.md,
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg,
  },
  actionText: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  badge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  remarks: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.md, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, paddingBottom: SPACING.xxl, maxHeight: '85%'
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  modalBody: { padding: SPACING.xl },
  confirmText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 22 },
  detailsScroll: { paddingHorizontal: SPACING.xl },
  detailsTopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    marginTop: SPACING.md
  },
  detailRowModal: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  detailRowLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 2 },
  detailRowValue: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.lg,
  },
  lawyerCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg,
    marginBottom: SPACING.md, ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  lawyerHeader: { flexDirection: 'row', alignItems: 'center' },
  lawyerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' },
  lawyerInfo: { flex: 1, marginLeft: SPACING.md },
  lawyerName: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  lawyerEmail: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  lawyerDetails: { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  lawyerText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: 2 },
});
