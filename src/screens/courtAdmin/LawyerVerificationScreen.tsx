import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput, Modal, ScrollView, Linking, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { courtAdminApi, lawyersApi } from '../../services/api';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { formatDate } from '../../utils/date';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'history', label: 'My Verifications' },
];

export const LawyerVerificationScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const initialTab = route?.params?.tab || 'pending';
  const [tab, setTab] = useState(initialTab);
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Action modal
  const [selectedLawyer, setSelectedLawyer] = useState<any>(null);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getErrorMessage = (err: any, fallback: string) => {
    const raw = err?.response?.data?.error ?? err?.message;
    if (!raw) return fallback;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') {
      if (typeof raw?.message === 'string') return raw.message;
      try {
        return JSON.stringify(raw);
      } catch {
        return fallback;
      }
    }
    return String(raw);
  };

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      if (tab === 'pending') {
        const { data } = await courtAdminApi.getPendingVerifications();
        setPending(data.items || data.lawyers || data || []);
      } else {
        const { data } = await courtAdminApi.getMyVerifications({ page: 1, limit: 500 });
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
    if (!selectedLawyer || !actionType) return;
    setSubmitting(true);
    try {
      await courtAdminApi.verifyLawyer(selectedLawyer.lawyer?.id || selectedLawyer.id, {
        status: actionType,
        remarks: remarks.trim() || undefined,
      });
      Alert.alert('Success', `Lawyer ${actionType.toLowerCase()} successfully`);
      setSelectedLawyer(null);
      setActionType(null);
      setRemarks('');
      fetchData(false);
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Verification failed'));
    } finally { setSubmitting(false); }
  };

  const openAction = (lawyer: any, type: 'APPROVED' | 'REJECTED') => {
    setSelectedLawyer(lawyer);
    setActionType(type);
    setRemarks('');
  };

  const openDetails = (item: any) => setSelectedDetails(item);

  const toAbsoluteUrl = (value?: string) => {
    if (!value) return '';
    const url = String(value).trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
    return url;
  };

  const getProofUrlFromItem = (item: any, type: 'license' | 'barCouncil') => {
    const keys = type === 'license'
      ? ['licenseProofUrl', 'licenseDocumentUrl', 'licenseProof']
      : ['barCouncilProofUrl', 'barCouncilDocumentUrl', 'barCouncilProof'];

    const buckets = [
      item,
      item?.lawyer,
      item?.documents,
      item?.lawyer?.documents,
      item?.data,
      item?.data?.lawyer,
      item?.data?.documents,
      item?.lawyerInformation,
    ];

    for (const bucket of buckets) {
      if (!bucket || typeof bucket !== 'object') continue;
      for (const key of keys) {
        const candidate = bucket?.[key];
        if (typeof candidate === 'string' && candidate.trim()) {
          return toAbsoluteUrl(candidate);
        }
      }
    }
    return '';
  };

  const openProofLink = async (url?: string) => {
    if (!url) {
      Alert.alert('Unavailable', 'Proof document is not available.');
      return;
    }
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        Alert.alert('Unavailable', 'Unable to open this document URL.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Failed to open document link.');
    }
  };

  const openProofForItem = async (item: any, type: 'license' | 'barCouncil') => {
    const rawUrl = getProofUrlFromItem(item, type);
    if (rawUrl) {
      await openProofLink(rawUrl);
      return;
    }

    const lawyerId = item?.lawyer?.id || item?.lawyerId || item?.id;
    if (!lawyerId) {
      Alert.alert('Unavailable', 'Proof document is not available.');
      return;
    }

    try {
      // This endpoint is broadly available and often contains proof URLs in legacy deployments.
      const { data } = await lawyersApi.getById(lawyerId);
      const fetchedFromLawyer = getProofUrlFromItem(data, type);

      if (fetchedFromLawyer) {
        await openProofLink(fetchedFromLawyer);
        return;
      }

      const docsRes = await courtAdminApi.getVerificationDocuments(lawyerId);
      const fetchedUrl = getProofUrlFromItem(docsRes?.data, type);

      if (!fetchedUrl) {
        Alert.alert('Unavailable', 'Proof document is not available.');
        return;
      }

      await openProofLink(fetchedUrl);
    } catch {
      Alert.alert('Unavailable', 'Proof document is not available.');
    }
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

  const renderPending = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openDetails(item)}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBg, { backgroundColor: '#EDE9FE' }]}>
          {(item?.lawyer?.avatarUrl || item?.avatarUrl) ? (
            <Image source={{ uri: item?.lawyer?.avatarUrl || item?.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={22} color="#8B5CF6" />
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.lawyer?.name || item.name || 'Unknown Lawyer'}</Text>
          <Text style={styles.cardSub}>{item.lawyer?.email || item.email || ''}</Text>
        </View>
      </View>
      <View style={styles.detailsGrid}>
        {(item.lawyer?.licenseNumber || item.licenseNumber) && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>License</Text>
            <Text style={styles.detailValue}>{item.lawyer?.licenseNumber || item.licenseNumber}</Text>
          </View>
        )}
        {(item.lawyer?.barCouncilId || item.barCouncilId) && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Bar Council</Text>
            <Text style={styles.detailValue}>{item.lawyer?.barCouncilId || item.barCouncilId}</Text>
          </View>
        )}
        {(item.lawyer?.experienceYears ?? item.experienceYears) != null && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Experience</Text>
            <Text style={styles.detailValue}>{item.lawyer?.experienceYears ?? item.experienceYears} yrs</Text>
          </View>
        )}
        {(item.lawyer?.specializations || item.specializations)?.length > 0 && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Specializations</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{(item.lawyer?.specializations || item.specializations).join(', ')}</Text>
          </View>
        )}
      </View>

      {item?.isReapplied && String(item?.lastDecisionStatus || '').toUpperCase() === 'REJECTED' && (
        <View style={styles.reapplyInfoBox}>
          <Text style={styles.reapplyInfoTitle}>Reapplied After Rejection</Text>
          {!!item?.lastDecisionAt && (
            <Text style={styles.reapplyInfoText}>Last Rejected On: {formatDate(item.lastDecisionAt)}</Text>
          )}
          {!!item?.lastDecisionRemarks && (
            <Text style={styles.reapplyInfoText}>Last Rejection Remarks: {item.lastDecisionRemarks}</Text>
          )}
          {!!item?.reappliedAt && (
            <Text style={styles.reapplyInfoText}>Reapplied On: {formatDate(item.reappliedAt)}</Text>
          )}
        </View>
      )}

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

  const renderHistory = ({ item }: { item: any }) => {
    const normalizedStatus = String(item?.status || '').trim().toUpperCase();
    const isApproved = normalizedStatus === 'APPROVED';
    const isExpanded = expandedHistoryId === item.id;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => setExpandedHistoryId((prev) => (prev === item.id ? null : item.id))}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconBg, { backgroundColor: isApproved ? '#D1FAE5' : '#FEE2E2' }]}>
            {item?.lawyer?.avatarUrl ? (
              <Image source={{ uri: item.lawyer.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name={isApproved ? 'checkmark-circle' : 'close-circle'} size={22} color={isApproved ? '#10B981' : '#EF4444'} />
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.lawyer?.name || `Lawyer ID: ${(item.lawyerId || '').slice(0, 12)}...`}</Text>
            <Text style={styles.cardSub}>{normalizedStatus || 'UNKNOWN'} · {formatDate(item.verifiedAt || item.createdAt)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isApproved ? '#D1FAE5' : '#FEE2E2' }]}>
            <Text style={[styles.badgeText, { color: isApproved ? '#10B981' : '#EF4444' }]}>{normalizedStatus || 'UNKNOWN'}</Text>
          </View>
        </View>
        {item.remarks && (
          <Text style={styles.remarks}>Remarks: {item.remarks}</Text>
        )}

        {isExpanded && (
          <View style={styles.historyDetailsBlock}>
            <View style={styles.detailsGrid}>
              {(item.lawyer?.licenseNumber || item.licenseNumber) && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>License</Text>
                  <Text style={styles.detailValue}>{item.lawyer?.licenseNumber || item.licenseNumber}</Text>
                </View>
              )}
              {(item.lawyer?.barCouncilId || item.barCouncilId) && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Bar Council</Text>
                  <Text style={styles.detailValue}>{item.lawyer?.barCouncilId || item.barCouncilId}</Text>
                </View>
              )}
              {(item.lawyer?.experienceYears ?? item.experienceYears) != null && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Experience</Text>
                  <Text style={styles.detailValue}>{item.lawyer?.experienceYears ?? item.experienceYears} yrs</Text>
                </View>
              )}
              {(item.lawyer?.specializations || item.specializations)?.length > 0 && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Specializations</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>{(item.lawyer?.specializations || item.specializations).join(', ')}</Text>
                </View>
              )}
              {(item.lawyer?.city || item.city || item.lawyer?.state || item.state) && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{[item.lawyer?.city || item.city, item.lawyer?.state || item.state].filter(Boolean).join(', ')}</Text>
                </View>
              )}
              {item.verifiedAt && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Verified On</Text>
                  <Text style={styles.detailValue}>{formatDate(item.verifiedAt)}</Text>
                </View>
              )}
            </View>

            <View style={styles.proofBlockInline}>
              <Text style={styles.proofTitle}>Verification Documents</Text>
              <TouchableOpacity
                style={styles.proofBtn}
                onPress={() => openProofForItem(item, 'license')}
              >
                <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                <Text style={styles.proofBtnText}>Open License Proof</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.proofBtn}
                onPress={() => openProofForItem(item, 'barCouncil')}
              >
                <Ionicons name="document-attach-outline" size={18} color={COLORS.primary} />
                <Text style={styles.proofBtnText}>Open Bar Council Proof</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity onPress={() => openDetails(item)} style={styles.viewDetailsBtn}>
          <Ionicons name="eye-outline" size={15} color={COLORS.primary} />
          <Text style={styles.viewDetailsText}>View Full Details</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lawyer Verification</Text>
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
              title={tab === 'pending' ? 'No Pending Verifications' : 'No Verification History'}
              message={tab === 'pending' ? 'All lawyers have been reviewed' : 'Your verifications will appear here'}
            />
          }
        />
      )}

      {/* Verify/Reject Modal */}
      <Modal visible={!!actionType} transparent animationType="slide" onRequestClose={() => { setActionType(null); setSelectedLawyer(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{actionType === 'APPROVED' ? 'Approve Lawyer' : 'Reject Lawyer'}</Text>
              <TouchableOpacity onPress={() => { setActionType(null); setSelectedLawyer(null); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.confirmText}>
                {actionType === 'APPROVED'
                  ? `Are you sure you want to approve ${selectedLawyer?.lawyer?.name || selectedLawyer?.name || 'this lawyer'}?`
                  : `Are you sure you want to reject ${selectedLawyer?.lawyer?.name || selectedLawyer?.name || 'this lawyer'}?`}
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

      {/* Full Lawyer Details Modal */}
      <Modal visible={!!selectedDetails} transparent animationType="slide" onRequestClose={() => setSelectedDetails(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lawyer Details</Text>
              <TouchableOpacity onPress={() => setSelectedDetails(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailsScroll} contentContainerStyle={{ paddingBottom: SPACING.lg }}>
              <View style={styles.detailsTopCard}>
                <View style={[styles.iconBg, { backgroundColor: '#EDE9FE' }]}>
                  {(selectedDetails?.lawyer?.avatarUrl || selectedDetails?.avatarUrl) ? (
                    <Image source={{ uri: selectedDetails?.lawyer?.avatarUrl || selectedDetails?.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={22} color="#8B5CF6" />
                  )}
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{selectedDetails?.lawyer?.name || selectedDetails?.name || 'Unknown Lawyer'}</Text>
                  <Text style={styles.cardSub}>{selectedDetails?.lawyer?.email || selectedDetails?.email || ''}</Text>
                </View>
              </View>

              {renderDetailRow('Phone', selectedDetails?.lawyer?.phone || selectedDetails?.phone)}
              {renderDetailRow('License Number', selectedDetails?.lawyer?.licenseNumber || selectedDetails?.licenseNumber)}
              {renderDetailRow('Bar Council ID', selectedDetails?.lawyer?.barCouncilId || selectedDetails?.barCouncilId)}
              {renderDetailRow('Experience', ((selectedDetails?.lawyer?.experienceYears ?? selectedDetails?.experienceYears) != null)
                ? `${selectedDetails?.lawyer?.experienceYears ?? selectedDetails?.experienceYears} years`
                : undefined)}
              {renderDetailRow('Specializations', (selectedDetails?.lawyer?.specializations || selectedDetails?.specializations || []).join(', '))}
              {renderDetailRow('City', selectedDetails?.lawyer?.city || selectedDetails?.city)}
              {renderDetailRow('State', selectedDetails?.lawyer?.state || selectedDetails?.state)}
              {renderDetailRow('Pincode', selectedDetails?.lawyer?.pincode || selectedDetails?.pincode)}
              {renderDetailRow('Requested On', formatDate(selectedDetails?.createdAt || selectedDetails?.lawyer?.createdAt))}
              {renderDetailRow('Status', selectedDetails?.status)}
              {renderDetailRow('Verified On', selectedDetails?.verifiedAt ? formatDate(selectedDetails?.verifiedAt) : undefined)}
              {renderDetailRow('Remarks', selectedDetails?.remarks)}
              {renderDetailRow(
                'Previous Decision',
                selectedDetails?.isReapplied ? String(selectedDetails?.lastDecisionStatus || '').toUpperCase() : undefined,
              )}
              {renderDetailRow(
                'Last Rejected On',
                selectedDetails?.isReapplied && String(selectedDetails?.lastDecisionStatus || '').toUpperCase() === 'REJECTED' && selectedDetails?.lastDecisionAt
                  ? formatDate(selectedDetails.lastDecisionAt)
                  : undefined,
              )}
              {renderDetailRow(
                'Last Rejection Remarks',
                selectedDetails?.isReapplied && String(selectedDetails?.lastDecisionStatus || '').toUpperCase() === 'REJECTED'
                  ? selectedDetails?.lastDecisionRemarks
                  : undefined,
              )}
              {renderDetailRow(
                'Reapplied On',
                selectedDetails?.isReapplied && selectedDetails?.reappliedAt ? formatDate(selectedDetails.reappliedAt) : undefined,
              )}

              <View style={styles.proofBlock}>
                <Text style={styles.proofTitle}>Verification Documents</Text>
                <TouchableOpacity
                  style={styles.proofBtn}
                  onPress={() => openProofForItem(selectedDetails, 'license')}
                >
                  <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.proofBtnText}>Open License Proof</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.proofBtn}
                  onPress={() => openProofForItem(selectedDetails, 'barCouncil')}
                >
                  <Ionicons name="document-attach-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.proofBtnText}>Open Bar Council Proof</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  reapplyInfoBox: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: '#FEF2F2',
  },
  reapplyInfoTitle: { fontSize: FONT_SIZE.sm, fontWeight: '800', color: '#B91C1C', marginBottom: 6 },
  reapplyInfoText: { fontSize: FONT_SIZE.xs, color: '#991B1B', lineHeight: 18 },
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
  historyDetailsBlock: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
  },
  proofBlockInline: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, paddingBottom: SPACING.xxl,
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
  },
  detailRowModal: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  detailRowLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 2 },
  detailRowValue: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600' },
  proofBlock: {
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  proofTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  proofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  proofBtnText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.lg,
  },
});
