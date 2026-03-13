import { useThemeStore } from '../../stores/themeStore';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';

const PRIVACY_POLICY = [
  { title: '1. Information We Collect', body: 'We collect personal information you provide when registering, including your name, email address, phone number, and location. For lawyers, we additionally collect bar council ID, license details, specialization, and experience information. We may also collect usage data, device information, and interaction logs to improve our services.' },
  { title: '2. How We Use Your Information', body: 'Your information is used to: provide and maintain our legal services platform; connect clients with verified lawyers; process consultations and payments; send notifications about appointments, cases, and messages; improve and personalize your experience; comply with legal obligations.' },
  { title: '3. Data Security', body: 'We implement industry-standard security measures including encryption of data in transit and at rest, secure authentication with JWT tokens, and regular security audits. Payment processing is handled through Razorpay with PCI-DSS compliance.' },
  { title: '4. Data Sharing', body: 'We do not sell your personal data. Information is shared only with: lawyers you choose to consult with; payment processors for transaction handling; service providers who assist in platform operations. All third parties are bound by confidentiality agreements.' },
  { title: '5. Your Rights', body: 'You have the right to: access, update, or delete your personal information; opt out of marketing communications; request data portability; withdraw consent at any time. Contact us at support@lawsoft.in for any privacy-related requests.' },
  { title: '6. Data Retention', body: 'We retain your data for as long as your account is active or as needed to provide services. Legal case records may be retained as required by applicable law. You may request deletion of your account and associated data at any time.' },
];

const TERMS_OF_SERVICE = [
  { title: '1. Acceptance of Terms', body: 'By using LawSoft, you agree to these Terms of Service. If you do not agree, please do not use the platform. We reserve the right to modify these terms at any time, and continued use constitutes acceptance of modifications.' },
  { title: '2. User Accounts', body: 'You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your credentials. Accounts are personal and non-transferable. We reserve the right to suspend or terminate accounts that violate these terms.' },
  { title: '3. Legal Services Disclaimer', body: 'LawSoft is a platform that connects clients with lawyers. We do not provide legal advice directly. All legal advice and representation is provided by independent lawyers registered on the platform. LawSoft is not liable for the quality of legal advice provided by lawyers.' },
  { title: '4. Payments & Refunds', body: 'Consultation fees are set by individual lawyers. Payments are processed securely through Razorpay. Cancellation and refund policies apply as per appointment terms. Wallet balances are non-transferable and subject to platform rules.' },
  { title: '5. Lawyer Verification', body: 'All lawyers on the platform undergo verification of their Bar Council registration and credentials. However, LawSoft does not guarantee the outcome of any legal matter. Clients should exercise their own judgment when selecting a lawyer.' },
  { title: '6. Prohibited Conduct', body: 'Users must not: provide false information; harass other users; misuse the platform for illegal activities; attempt to circumvent the platform for direct payments; share account credentials; scrape or reverse-engineer the platform.' },
  { title: '7. Limitation of Liability', body: 'LawSoft shall not be liable for any indirect, incidental, or consequential damages arising from use of the platform. Our total liability is limited to the amount paid by you in the preceding 12 months.' },
  { title: '8. Governing Law', body: 'These terms are governed by the laws of India. Any disputes shall be resolved through arbitration in accordance with the Arbitration and Conciliation Act, 1996, with the seat of arbitration in New Delhi.' },
];

type Tab = 'privacy' | 'terms';

export const PrivacyTermsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../../stores/themeStore').DARK_COLORS : require('../../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [activeTab, setActiveTab] = useState<Tab>('privacy');
  const sections = activeTab === 'privacy' ? PRIVACY_POLICY : TERMS_OF_SERVICE;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'privacy' && styles.tabActive]}
          onPress={() => setActiveTab('privacy')}
        >
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terms' && styles.tabActive]}
          onPress={() => setActiveTab('terms')}
        >
          <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>Terms of Service</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.lastUpdated}>Last updated: February 2026</Text>
          {sections.map((s, idx) => (
            <View key={idx} style={styles.section}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              <Text style={styles.sectionBody}>{s.body}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.contactText}>
          For questions about these policies, contact support@lawsoft.in
        </Text>
      </ScrollView>
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
  tabRow: {
    flexDirection: 'row', marginHorizontal: SPACING.xl, marginTop: SPACING.lg,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.full, padding: 4,
  },
  tab: { flex: 1, paddingVertical: SPACING.md, alignItems: 'center', borderRadius: BORDER_RADIUS.full },
  tabActive: { backgroundColor: COLORS.text },
  tabText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.white },
  content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm,
  },
  lastUpdated: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.xl },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },
  sectionBody: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, lineHeight: 24 },
  contactText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, textAlign: 'center', marginTop: SPACING.xl },
});
