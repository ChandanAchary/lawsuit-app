import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';

const WHY_ITEMS = [
  { icon: 'shield-checkmark-outline', title: 'Secure', desc: 'End-to-end encrypted communications' },
  { icon: 'people-outline', title: 'Trusted', desc: 'Bar Council verified lawyers' },
  { icon: 'flash-outline', title: 'Fast', desc: 'Book consultations in under 2 minutes' },
  { icon: 'globe-outline', title: 'Accessible', desc: 'Available across India in 10+ languages' },
];

export const AboutScreen: React.FC<{ navigation: any }> = ({ navigation }) => (
  <View style={styles.container}>
    <StatusBar barStyle="dark-content" />
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>About</Text>
      <View style={{ width: 36 }} />
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* App Icon */}
      <View style={styles.iconWrap}>
        <Ionicons name="chatbubbles" size={48} color={COLORS.accent} />
      </View>
      <Text style={styles.appName}>LawSoft</Text>
      <Text style={styles.version}>Version 1.0.0</Text>
      <Text style={styles.tagline}>Making Legal Services Accessible to Everyone</Text>

      {/* About Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.cardText}>
          LawSoft connects clients with verified legal professionals across India. Whether you need a consultation, want to manage ongoing cases, or need immediate legal advice, LawSoft provides a seamless platform for all your legal needs.
        </Text>
      </View>

      {/* Why LawSoft Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Why LawSoft?</Text>
        {WHY_ITEMS.map((item, idx) => (
          <View key={item.title} style={[styles.featureRow, idx < WHY_ITEMS.length - 1 && styles.featureRowBorder]}>
            <View style={styles.featureIcon}>
              <Ionicons name={item.icon as any} size={22} color={COLORS.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.copyright}>© 2026 LawSoft. All rights reserved.</Text>
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xxxl, paddingBottom: 100, alignItems: 'center' },
  iconWrap: {
    width: 88, height: 88, borderRadius: BORDER_RADIUS.xl, backgroundColor: COLORS.text,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg,
  },
  appName: { fontSize: FONT_SIZE.xxxl, fontWeight: '900', color: COLORS.text },
  version: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.xs },
  tagline: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.sm, marginBottom: SPACING.xxxl },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    width: '100%', marginBottom: SPACING.lg, ...SHADOWS.sm,
  },
  cardTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  cardText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, lineHeight: 24 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  featureRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  featureIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  featureDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  copyright: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.xl },
});
