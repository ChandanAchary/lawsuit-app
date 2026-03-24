import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { courtAdminApi, usersApi } from '../../services/api';
import { Button } from '../../components/Button';
import { EmptyState, Loading } from '../../components/Common';

type CourtAdminItem = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  registrationNumber?: string;
  court?: {
    id: string;
    name: string;
    type?: string;
    district?: string;
    state?: string;
    address?: string;
  };
};

type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type VerificationRequestMeta = {
  status: VerificationStatus;
  verifiedAt?: string;
  remarks?: string;
  courtAdminName?: string;
  registrationNumber?: string;
  courtName?: string;
};

export const LawyerVerificationRequestScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [pincode, setPincode] = useState('');
  const [items, setItems] = useState<CourtAdminItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [statusByAdminId, setStatusByAdminId] = useState<Record<string, VerificationStatus>>({});
  const [requestMetaByAdminId, setRequestMetaByAdminId] = useState<Record<string, VerificationRequestMeta>>({});

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const fetchStatuses = useCallback(async () => {
    try {
      const { data } = await courtAdminApi.getMyVerificationRequests();
      const rows = Array.isArray(data?.items) ? data.items : [];
      const statusMap = rows.reduce((acc: Record<string, VerificationStatus>, row: any) => {
        const adminId = row?.courtAdminId || row?.courtAdmin?.id;
        const status = row?.status as VerificationStatus | undefined;
        if (adminId && status) acc[adminId] = status;
        return acc;
      }, {});
      const requestMeta = rows.reduce((acc: Record<string, VerificationRequestMeta>, row: any) => {
        const adminId = row?.courtAdminId || row?.courtAdmin?.id;
        const status = row?.status as VerificationStatus | undefined;
        if (!adminId || !status) return acc;
        acc[adminId] = {
          status,
          verifiedAt: row?.verifiedAt,
          remarks: row?.remarks,
          courtAdminName: row?.courtAdmin?.name,
          registrationNumber: row?.courtAdmin?.registrationNumber,
          courtName: row?.courtAdmin?.court?.name,
        };
        return acc;
      }, {});
      setStatusByAdminId(statusMap);
      setRequestMetaByAdminId(requestMeta);
    } catch {
      setStatusByAdminId({});
      setRequestMetaByAdminId({});
    }
  }, []);

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await usersApi.getLawyerInformation();
      const lawyer = data?.lawyer || {};
      const pin = String(lawyer?.pincode || '').trim();

      if (!/^\d{6}$/.test(pin)) {
        setPincode('');
        setItems([]);
        return;
      }

      setPincode(pin);
      const res = await courtAdminApi.getPublicAdminsByPincode(pin);
      const admins = res.data?.courtAdmins || [];
      setItems(Array.isArray(admins) ? admins : []);
      if (!admins.length) {
        setSelectedId('');
      }

      await fetchStatuses();
    } catch {
      setItems([]);
      setSelectedId('');
      setStatusByAdminId({});
      setRequestMetaByAdminId({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchStatuses]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const submitRequest = async () => {
    if (!selectedId) {
      Alert.alert('Select Court Admin', 'Please select a nearby court admin first.');
      return;
    }

    setSubmitting(true);
    try {
      await courtAdminApi.submitVerificationRequest(selectedId);
      setStatusByAdminId((prev) => ({ ...prev, [selectedId]: 'PENDING' }));
      setRequestMetaByAdminId((prev) => ({
        ...prev,
        [selectedId]: {
          status: 'PENDING',
          courtAdminName: items.find((admin) => admin.id === selectedId)?.name,
          registrationNumber: items.find((admin) => admin.id === selectedId)?.registrationNumber,
          courtName: items.find((admin) => admin.id === selectedId)?.court?.name,
        },
      }));
      Alert.alert('Request Sent', 'Your lawyer verification request has been sent to the selected court admin.');
      await fetchStatuses();
    } catch (err: any) {
      const status = err?.response?.status;
      const rawError = err?.response?.data?.error || err?.message || '';
      const msg = String(rawError).toLowerCase();
      if (status === 503 || msg.includes('connection pool') || msg.includes('server is busy')) {
        Alert.alert('Failed', 'Server is busy right now. Please try again in a few seconds.');
      } else {
        Alert.alert('Failed', rawError || 'Could not submit verification request.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedAdmin = () => items.find((admin) => admin.id === selectedId);

  const getSelectedStatus = (): VerificationStatus | undefined => {
    if (!selectedId) return undefined;
    return statusByAdminId[selectedId];
  };

  const escapeHtml = (value?: string) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const downloadCertificate = async (item: CourtAdminItem, requestMeta: VerificationRequestMeta) => {
    if (requestMeta.status !== 'APPROVED') {
      Alert.alert('Not Available', 'Certificate can only be downloaded after approval.');
      return;
    }
    setDownloading(true);
    try {
      const approvedDate = formatDate(requestMeta.verifiedAt);
      const approvedBy = requestMeta.courtAdminName || item.name || '-';
      const courtName = requestMeta.courtName || item.court?.name || '-';
      const certificateNo = requestMeta.registrationNumber || 'N/A';
      const remarks = requestMeta.remarks || 'N/A';

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; padding: 28px; color: #14532D; }
              .sheet { border: 2px solid #86EFAC; border-radius: 16px; padding: 20px; background: #F0FDF4; }
              .title { font-size: 24px; font-weight: 700; margin-bottom: 10px; color: #166534; }
              .subtitle { font-size: 15px; margin-bottom: 16px; }
              .row { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #BBF7D0; padding-bottom: 6px; }
              .label { font-weight: 600; }
              .value { font-weight: 700; text-align: right; }
              .remarks { margin-top: 16px; font-style: italic; }
              .footer { margin-top: 22px; font-size: 12px; color: #166534; opacity: .9; }
            </style>
          </head>
          <body>
            <div class="sheet">
              <div class="title">Approved Court Verification Certificate</div>
              <div class="subtitle">This is to certify that the lawyer court verification request has been approved.</div>

              <div class="row"><div class="label">Approved Date</div><div class="value">${escapeHtml(approvedDate)}</div></div>
              <div class="row"><div class="label">Approved By</div><div class="value">${escapeHtml(approvedBy)}</div></div>
              <div class="row"><div class="label">Court</div><div class="value">${escapeHtml(courtName)}</div></div>
              <div class="row"><div class="label">Certificate No.</div><div class="value">${escapeHtml(certificateNo)}</div></div>
              <div class="row"><div class="label">Lawyer Pincode</div><div class="value">${escapeHtml(pincode || 'N/A')}</div></div>

              <div class="remarks">Remarks: ${escapeHtml(remarks)}</div>
              <div class="footer">Generated by NyayaX App on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Saved', `Certificate created at: ${uri}`);
        return;
      }

      const filenameDate = approvedDate.replace(/\s+/g, '-');
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: `Verification-Certificate-${filenameDate}`,
      });
    } catch {
      Alert.alert('Download Failed', 'Unable to generate certificate right now. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const onPrimaryAction = async () => {
    if (!selectedId) {
      Alert.alert('Select Court Admin', 'Please select a nearby court admin first.');
      return;
    }

    const status = getSelectedStatus();
    const selectedAdmin = getSelectedAdmin();
    const requestMeta = requestMetaByAdminId[selectedId];

    if (status === 'APPROVED' && selectedAdmin && requestMeta) {
      await downloadCertificate(selectedAdmin, requestMeta);
      return;
    }

    if (status === 'PENDING') {
      Alert.alert('Already Pending', 'Your verification request is already pending review.');
      return;
    }

    if (status === 'REJECTED') {
      Alert.alert(
        'Apply for Re-Verification',
        'After fixing the issues mentioned in remarks, you can apply again. Continue? ',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Apply Again', onPress: () => submitRequest() },
        ],
      );
      return;
    }

    await submitRequest();
  };

  const getPrimaryButtonTitle = () => {
    const status = getSelectedStatus();
    if (status === 'PENDING') return 'Request Pending';
    if (status === 'APPROVED') return 'Download Approved Certificate';
    if (status === 'REJECTED') return 'Apply for Re-Verification';
    return 'Send Verification Request';
  };

  const isPrimaryDisabled = () => {
    if (!pincode || !selectedId) return true;
    const status = getSelectedStatus();
    if (status === 'PENDING') return true;
    return submitting || downloading;
  };

  const getStatusMeta = (status?: VerificationStatus) => {
    if (status === 'APPROVED') {
      return { label: 'Approved', color: COLORS.success || '#16a34a', bg: (COLORS.success || '#16a34a') + '18' };
    }
    if (status === 'REJECTED') {
      return { label: 'Rejected', color: COLORS.error || '#dc2626', bg: (COLORS.error || '#dc2626') + '16' };
    }
    if (status === 'PENDING') {
      return { label: 'Pending', color: COLORS.warning || '#d97706', bg: (COLORS.warning || '#d97706') + '18' };
    }
    return null;
  };

  const renderItem = ({ item }: { item: CourtAdminItem }) => {
    const selected = selectedId === item.id;
    const locationText = [item.court?.district, item.court?.state].filter(Boolean).join(', ');
    const status = statusByAdminId[item.id];
    const statusMeta = getStatusMeta(status);
    const requestMeta = requestMetaByAdminId[item.id];
    const showApprovedCertificate = requestMeta?.status === 'APPROVED';
    const isRejected = requestMeta?.status === 'REJECTED';

    return (
      <TouchableOpacity
        style={[styles.card, selected && styles.cardSelected]}
        onPress={() => setSelectedId(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.row}> 
          <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'shield-checkmark-outline'}
              size={22}
              color={selected ? COLORS.primary : COLORS.textSecondary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, selected && styles.nameSelected]}>{item.name}</Text>
            <Text style={styles.meta}>{item.email || item.phone || 'Court Admin'}</Text>
          </View>
          {statusMeta ? (
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}> 
              <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.infoText} numberOfLines={1}>{item.court?.name || 'Court'}</Text>
        </View>

        {!!locationText && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{locationText}</Text>
          </View>
        )}

        {!!item.court?.address && (
          <Text style={styles.address} numberOfLines={2}>{item.court.address}</Text>
        )}

        {showApprovedCertificate && (
          <View style={styles.certificateCard}>
            <View style={styles.certificateHeader}>
              <Ionicons name="ribbon" size={18} color="#166534" />
              <Text style={styles.certificateTitle}>Approved Certificate</Text>
            </View>
            <Text style={styles.certificateLine}>This is to certify that your court verification request has been approved.</Text>
            <View style={styles.certificateGrid}>
              <View style={styles.certificateRow}>
                <Text style={styles.certificateLabel}>Approved Date</Text>
                <Text style={styles.certificateValue}>{formatDate(requestMeta?.verifiedAt)}</Text>
              </View>
              <View style={styles.certificateRow}>
                <Text style={styles.certificateLabel}>Approved By</Text>
                <Text style={styles.certificateValue}>{requestMeta?.courtAdminName || item.name}</Text>
              </View>
              <View style={styles.certificateRow}>
                <Text style={styles.certificateLabel}>Court</Text>
                <Text style={styles.certificateValue}>{requestMeta?.courtName || item.court?.name || '-'}</Text>
              </View>
              <View style={styles.certificateRow}>
                <Text style={styles.certificateLabel}>Certificate No.</Text>
                <Text style={styles.certificateValue}>{requestMeta?.registrationNumber || 'N/A'}</Text>
              </View>
            </View>
            {!!requestMeta?.remarks && (
              <Text style={styles.certificateRemarks}>Remarks: {requestMeta.remarks}</Text>
            )}

            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={() => downloadCertificate(item, requestMeta)}
              disabled={downloading}
            >
              <Ionicons name="download-outline" size={16} color="#14532D" />
              <Text style={styles.downloadBtnText}>{downloading ? 'Preparing...' : 'Download Certificate'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isRejected && (
          <View style={styles.rejectedCard}>
            <View style={styles.rejectedHeader}>
              <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
              <Text style={styles.rejectedTitle}>Verification Rejected</Text>
            </View>
            <Text style={styles.rejectedMessage}>
              Please fix the issues mentioned by court admin and apply for re-verification.
            </Text>
            {!!requestMeta?.remarks && (
              <Text style={styles.rejectedRemarks}>Remarks: {requestMeta.remarks}</Text>
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
        <Text style={styles.headerTitle}>Court Verification Request</Text>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Lawyer Pincode</Text>
        <Text style={styles.bannerValue}>{pincode || 'Not Set'}</Text>
        {!pincode && (
          <Text style={styles.bannerHint}>
            Please complete your lawyer profile pincode to find nearest court admins.
          </Text>
        )}
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData(false);
              }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="🏛️"
              title="No Court Admins Found"
              message={
                pincode
                  ? 'No active court admin is mapped to your pincode yet.'
                  : 'Set pincode in profile, then retry.'
              }
            />
          }
        />
      )}

      <View style={styles.footer}>
        <Button
          title={getPrimaryButtonTitle()}
          onPress={onPrimaryAction}
          loading={submitting || downloading}
          disabled={isPrimaryDisabled()}
          size="lg"
        />
      </View>
    </View>
  );
};

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.huge,
      paddingBottom: SPACING.md,
      backgroundColor: COLORS.white,
      ...SHADOWS.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
    banner: {
      margin: SPACING.xl,
      padding: SPACING.lg,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: COLORS.white,
      ...SHADOWS.sm,
    },
    bannerTitle: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: '700' },
    bannerValue: { fontSize: FONT_SIZE.lg, color: COLORS.primary, fontWeight: '900', marginTop: 4 },
    bannerHint: { marginTop: SPACING.sm, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
    list: { paddingHorizontal: SPACING.xl, paddingBottom: 120 },
    card: {
      backgroundColor: COLORS.white,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    cardSelected: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.primary + '10',
    },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
    },
    iconWrapSelected: { backgroundColor: COLORS.white },
    name: { fontSize: FONT_SIZE.md, fontWeight: '800', color: COLORS.text },
    nameSelected: { color: COLORS.primary },
    meta: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
    statusBadge: {
      borderRadius: BORDER_RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    statusText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginTop: SPACING.xs,
    },
    infoText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, flex: 1 },
    address: { marginTop: SPACING.xs, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
    certificateCard: {
      marginTop: SPACING.md,
      borderWidth: 1,
      borderColor: '#86EFAC',
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: '#F0FDF4',
      padding: SPACING.md,
    },
    certificateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginBottom: SPACING.xs,
    },
    certificateTitle: {
      fontSize: FONT_SIZE.md,
      fontWeight: '900',
      color: '#166534',
    },
    certificateLine: {
      fontSize: FONT_SIZE.sm,
      color: '#166534',
      marginBottom: SPACING.sm,
    },
    certificateGrid: {
      borderTopWidth: 1,
      borderTopColor: '#BBF7D0',
      paddingTop: SPACING.sm,
    },
    certificateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: SPACING.md,
      paddingVertical: 3,
    },
    certificateLabel: {
      fontSize: FONT_SIZE.xs,
      color: '#15803D',
      fontWeight: '700',
      flex: 1,
    },
    certificateValue: {
      fontSize: FONT_SIZE.sm,
      color: '#14532D',
      fontWeight: '800',
      flex: 1,
      textAlign: 'right',
    },
    certificateRemarks: {
      marginTop: SPACING.sm,
      fontSize: FONT_SIZE.xs,
      color: '#166534',
      fontStyle: 'italic',
    },
    downloadBtn: {
      marginTop: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      borderWidth: 1,
      borderColor: '#86EFAC',
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: '#DCFCE7',
      paddingVertical: SPACING.sm,
    },
    downloadBtnText: {
      color: '#14532D',
      fontSize: FONT_SIZE.sm,
      fontWeight: '800',
    },
    rejectedCard: {
      marginTop: SPACING.md,
      borderWidth: 1,
      borderColor: '#FCA5A5',
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: '#FEF2F2',
      padding: SPACING.md,
    },
    rejectedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginBottom: SPACING.xs,
    },
    rejectedTitle: {
      fontSize: FONT_SIZE.sm,
      color: '#B91C1C',
      fontWeight: '800',
    },
    rejectedMessage: {
      fontSize: FONT_SIZE.sm,
      color: '#991B1B',
      lineHeight: 20,
    },
    rejectedRemarks: {
      marginTop: SPACING.sm,
      fontSize: FONT_SIZE.xs,
      color: '#B91C1C',
      fontStyle: 'italic',
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.xl,
      backgroundColor: COLORS.white,
      borderTopWidth: 1,
      borderTopColor: COLORS.borderLight,
    },
  });

export default LawyerVerificationRequestScreen;
