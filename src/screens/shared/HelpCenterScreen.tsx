import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  TextInput, Alert, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';

const FAQ_DATA = [
  { q: 'How do I book a consultation?', a: 'Search for a lawyer by specialization, view their profile, and tap "Book Appointment". Select your preferred date and time, then confirm the booking.' },
  { q: 'How are payments processed?', a: 'Payments are processed securely through Razorpay. You can pay using your wallet balance, UPI, debit/credit card, or net banking.' },
  { q: 'Can I cancel an appointment?', a: 'Yes, you can cancel an appointment from the Appointments tab. Cancellation policies vary by lawyer — check the appointment details for the refund policy.' },
  { q: 'How do I contact my lawyer?', a: 'Once an appointment is confirmed, you can chat with your lawyer directly through the Chats tab. For ongoing cases, use the case chat feature.' },
  { q: 'Is my data secure?', a: 'Yes, we use industry-standard encryption for all communications and data storage. Your personal information is never shared without your consent.' },
  { q: 'How do I verify my account?', a: 'After registration, an OTP will be sent to your email. Enter the OTP to verify your account. Lawyers need additional Bar Council verification.' },
];

export const HelpCenterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const handleSendMessage = () => {
    if (!message.trim()) { Alert.alert('Error', 'Please enter your message'); return; }
    Alert.alert('Message Sent', 'Our support team will get back to you within 24 hours.', [
      { text: 'OK', onPress: () => setMessage('') },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Quick Actions */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <TouchableOpacity style={styles.actionRow} onPress={() => Linking.openURL('mailto:support@lawsoft.in')}>
              <View style={[styles.actionIcon, { backgroundColor: COLORS.primaryLight + '15' }]}>
                <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Email Support</Text>
                <Text style={styles.actionDesc}>support@lawsoft.in</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={() => Linking.openURL('tel:+911800123456')}>
              <View style={[styles.actionIcon, { backgroundColor: COLORS.successLight }]}>
                <Ionicons name="call-outline" size={20} color={COLORS.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Call Us</Text>
                <Text style={styles.actionDesc}>1800-123-456 (Toll Free)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* FAQ */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
            {FAQ_DATA.map((faq, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.faqItem, idx < FAQ_DATA.length - 1 && styles.faqBorder]}
                onPress={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                activeOpacity={0.7}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <Ionicons name={expandedIdx === idx ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} />
                </View>
                {expandedIdx === idx && (
                  <Text style={styles.faqAnswer}>{faq.a}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Contact Form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Send us a Message</Text>
            <Text style={styles.formHint}>Describe your issue and we'll respond within 24 hours.</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Type your message here..."
              placeholderTextColor={COLORS.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
              <Ionicons name="send" size={18} color={COLORS.white} />
              <Text style={styles.sendBtnText}>Send Message</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  content: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.lg, ...SHADOWS.sm,
  },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.lg },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  actionDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  faqItem: { paddingVertical: SPACING.lg },
  faqBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, flex: 1, marginRight: SPACING.sm },
  faqAnswer: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 22, marginTop: SPACING.sm },
  formHint: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.md },
  textArea: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.lg, fontSize: FONT_SIZE.md, color: COLORS.text,
    minHeight: 100, marginBottom: SPACING.lg,
  },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.lg,
  },
  sendBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.white },
});
