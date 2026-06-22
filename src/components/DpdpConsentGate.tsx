import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usersApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useColors } from '../stores/themeStore';
import { FONT_SIZE } from '../constants';

/**
 * One-time DPDP (Digital Personal Data Protection Act, 2023) privacy-notice
 * gate. Mounted once at the app root: on first authenticated boot it asks the
 * server whether the user has acknowledged the notice and, if not, blocks the
 * screen with a modal until they accept. Mirrors the web's DpdpNoticeGate.
 *
 * Soft-fails: if the status check errors we do NOT block the app.
 */
export const DpdpConsentGate: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const C = useColors();

  const [needsConsent, setNeedsConsent] = useState<boolean | null>(null);
  const [noticeText, setNoticeText] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll consent status whenever the authed user changes. No user → no modal.
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setNeedsConsent(null);
      return;
    }
    (async () => {
      try {
        const res = await usersApi.getDpdpConsentStatus();
        const data = (res.data?.data ?? res.data) as { consented?: boolean; text?: string };
        if (cancelled) return;
        if (data?.text) setNoticeText(data.text);
        setNeedsConsent(!data?.consented);
      } catch {
        // Soft-fail — never lock the user out over a flaky status call.
        if (!cancelled) setNeedsConsent(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleAgree = async () => {
    if (!agreed) {
      setError('Please tick the consent box to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await usersApi.recordDpdpConsent();
      setNeedsConsent(false);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          "We couldn't record your consent right now. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const visible = needsConsent === true && !!user?.id;
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: C.surface }]}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: C.primary + '1A' }]}>
              <Ionicons name="shield-checkmark" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: C.text }]}>Privacy notice</Text>
              <Text style={[styles.subtitle, { color: C.textSecondary }]}>
                Under the Digital Personal Data Protection Act, 2023
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: 4 }}
            showsVerticalScrollIndicator
          >
            <Text style={[styles.noticeText, { color: C.text }]}>
              {noticeText ||
                'I have read NyayaX\'s Privacy Notice and consent to the processing of my personal data for the purpose of providing legal services on the platform — including identity verification, communication with assigned lawyers/mediators, case management and (where applicable) payments.\n\nI understand my rights under the Digital Personal Data Protection Act, 2023, including the right to withdraw consent, the right to access my data, and the right to request erasure.'}
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.7}
            onPress={() => {
              setAgreed((v) => !v);
              if (error) setError(null);
            }}
          >
            <Ionicons
              name={agreed ? 'checkbox' : 'square-outline'}
              size={22}
              color={agreed ? C.primary : C.textSecondary}
            />
            <Text style={[styles.checkboxLabel, { color: C.text }]}>
              I have read and agree to the Privacy Notice above.
            </Text>
          </TouchableOpacity>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: C.primary }, (!agreed || busy) && styles.buttonDisabled]}
            onPress={handleAgree}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>I agree and continue</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.footer, { color: C.textSecondary }]}>
            You may withdraw consent later by contacting support.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  body: {
    maxHeight: 240,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 21,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  error: {
    color: '#DC2626',
    fontSize: FONT_SIZE.xs,
    marginTop: 6,
  },
  button: {
    marginTop: 14,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  footer: {
    fontSize: FONT_SIZE.xs - 1,
    textAlign: 'center',
    marginTop: 12,
  },
});
