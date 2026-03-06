import React from 'react';
import {
  View, Text, StyleSheet, FlatList, 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, LEX_RATES } from '../../constants';
import { TouchableOpacity } from 'react-native';

export const LexRatesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const renderItem = ({ item, index }: { item: typeof LEX_RATES[0]; index: number }) => (
    <View style={[styles.card, index % 2 === 0 ? styles.cardEven : styles.cardOdd]}>
      <View style={styles.cardHeader}>
        <Text style={styles.category}>{item.category}</Text>
      </View>
      <View style={styles.feeRow}>
        <View style={styles.feeItem}>
          <Text style={styles.feeLabel}>Min</Text>
          <Text style={styles.feeValue}>₹{item.min.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.feeDivider} />
        <View style={styles.feeItem}>
          <Text style={[styles.feeLabel, { color: COLORS.primary }]}>Average</Text>
          <Text style={[styles.feeValue, { color: COLORS.primary }]}>₹{item.avg.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.feeDivider} />
        <View style={styles.feeItem}>
          <Text style={styles.feeLabel}>Max</Text>
          <Text style={styles.feeValue}>₹{item.max.toLocaleString('en-IN')}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.primary, COLORS.midnight]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="analytics" size={32} color={COLORS.accent} />
          <Text style={styles.headerTitle}>Lex Rates</Text>
          <Text style={styles.headerSub}>Standard legal fee ranges across categories in India</Text>
        </View>
      </LinearGradient>

      <FlatList
        data={LEX_RATES}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: SPACING.huge + 10,
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg,
  },
  headerContent: { alignItems: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xxl + 2, fontWeight: '900', color: COLORS.white, marginTop: SPACING.sm },
  headerSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: SPACING.xs },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardEven: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  cardOdd: { borderLeftWidth: 4, borderLeftColor: COLORS.accent },
  cardHeader: { marginBottom: SPACING.md },
  category: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  feeRow: { flexDirection: 'row', alignItems: 'center' },
  feeItem: { flex: 1, alignItems: 'center' },
  feeDivider: { width: 1, height: 30, backgroundColor: COLORS.borderLight },
  feeLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: '500' },
  feeValue: { fontSize: FONT_SIZE.md, fontWeight: '800', color: COLORS.text, marginTop: 4 },
});
