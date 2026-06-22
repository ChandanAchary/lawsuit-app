import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { esignApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useColors } from '../../stores/themeStore';
import { FONT_SIZE } from '../../constants';

type Party = {
  id: string;
  name?: string;
  email?: string;
  roleLabel?: string;
  status?: string;
  userId?: string;
};

/**
 * OTP-based document signing — the mobile counterpart of the web's
 * SignDocumentPage (/app/sign/:id). View the request → request a signing code →
 * enter the 6-digit OTP to sign → download the completed PDF. Reachable via
 * navigation.navigate('SignDocument', { signatureRequestId }).
 */
export const SignDocumentScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const id: string = route.params?.signatureRequestId || route.params?.id || '';
  const C = useColors();
  const userId = useAuthStore((s) => s.user?.id);
  const insets = useSafeAreaInsets();

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError('Missing signature request.');
      setLoading(false);
      return;
    }
    try {
      const res = await esignApi.getRequest(id);
      const req = res.data?.data ?? res.data;
      setRequest(req);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not load this signature request.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const parties: Party[] = request?.parties || [];
  const myParty = parties.find((p) => p.userId && p.userId === userId);
  const completed = request?.status === 'COMPLETED';
  const iSigned = myParty?.status === 'SIGNED';

  const sendOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      await esignApi.sendOtp(id, myParty?.id);
      setOtpSent(true);
      Alert.alert('Code sent', 'A 6-digit signing code has been sent to you. It is valid for 10 minutes.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not send the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await esignApi.sign(id, otp.trim(), myParty?.id);
      setOtp('');
      setOtpSent(false);
      await load();
      Alert.alert('Signed', 'Your signature has been recorded.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not sign. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const res = await esignApi.signedUrl(id);
      const url = (res.data?.data ?? res.data)?.url;
      if (url) await WebBrowser.openBrowserAsync(url);
      else Alert.alert('Not ready', 'The signed document is not available yet.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Could not fetch the signed document.');
    } finally {
      setBusy(false);
    }
  };

  const statusColor = (status?: string) => {
    if (status === 'SIGNED') return '#10B981';
    if (status === 'DECLINED') return '#DC2626';
    return C.textSecondary;
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: C.border, backgroundColor: C.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]} numberOfLines={1}>
          Sign Document
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={C.primary}
            />
          }
        >
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {request && (
            <>
              <Text style={[styles.docTitle, { color: C.text }]}>{request.title || 'Document'}</Text>

              {/* Parties + statuses */}
              <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.cardLabel, { color: C.textSecondary }]}>Signing parties</Text>
                {parties.map((p) => (
                  <View key={p.id} style={styles.partyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.partyName, { color: C.text }]}>
                        {p.name || p.email}
                        {p.userId === userId ? '  (you)' : ''}
                      </Text>
                      {!!p.roleLabel && <Text style={[styles.partyRole, { color: C.textSecondary }]}>{p.roleLabel}</Text>}
                    </View>
                    <Text style={[styles.partyStatus, { color: statusColor(p.status) }]}>
                      {p.status === 'SIGNED' ? 'Signed' : p.status === 'DECLINED' ? 'Declined' : 'Pending'}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Action area */}
              {completed ? (
                <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border, alignItems: 'center' }]}>
                  <Ionicons name="checkmark-circle" size={40} color="#10B981" />
                  <Text style={[styles.doneTitle, { color: C.text }]}>All parties have signed</Text>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: C.primary }]}
                    onPress={download}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={18} color="#fff" />
                        <Text style={styles.primaryBtnText}>Download signed PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : !myParty ? (
                <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[styles.infoText, { color: C.textSecondary }]}>
                    You are not a signing party on this document.
                  </Text>
                </View>
              ) : iSigned ? (
                <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border, alignItems: 'center' }]}>
                  <Ionicons name="checkmark-done" size={36} color="#10B981" />
                  <Text style={[styles.doneTitle, { color: C.text }]}>You've signed</Text>
                  <Text style={[styles.infoText, { color: C.textSecondary }]}>Waiting for the other parties to sign.</Text>
                </View>
              ) : (
                <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[styles.cardLabel, { color: C.textSecondary }]}>Sign with a one-time code</Text>
                  {!otpSent ? (
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: C.primary }]}
                      onPress={sendOtp}
                      disabled={busy}
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="key-outline" size={18} color="#fff" />
                          <Text style={styles.primaryBtnText}>Send me a signing code</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TextInput
                        style={[styles.otpInput, { color: C.text, backgroundColor: C.background, borderColor: C.border }]}
                        value={otp}
                        onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        placeholderTextColor={C.textSecondary}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: C.primary }, otp.length !== 6 && { opacity: 0.5 }]}
                        onPress={sign}
                        disabled={busy || otp.length !== 6}
                      >
                        {busy ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="create-outline" size={18} color="#fff" />
                            <Text style={styles.primaryBtnText}>Sign document</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={sendOtp} disabled={busy} style={styles.resend}>
                        <Text style={[styles.resendText, { color: C.primary }]}>Resend code</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {!!request.documentHash && (
                <Text style={[styles.hash, { color: C.textSecondary }]} numberOfLines={1}>
                  Document hash: {request.documentHash}
                </Text>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FONT_SIZE.lg, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { color: '#DC2626', fontSize: FONT_SIZE.sm, flex: 1 },
  docTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', marginBottom: 14 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.4 },
  partyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  partyName: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  partyRole: { fontSize: FONT_SIZE.xs, marginTop: 1 },
  partyStatus: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  doneTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  infoText: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    marginTop: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
  otpInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: FONT_SIZE.xl,
    letterSpacing: 6,
    textAlign: 'center',
  },
  resend: { alignItems: 'center', paddingVertical: 12 },
  resendText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  hash: { fontSize: FONT_SIZE.xs - 1, marginTop: 4 },
});
