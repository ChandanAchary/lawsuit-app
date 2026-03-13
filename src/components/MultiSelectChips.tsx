import { useThemeStore } from '../stores/themeStore';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BORDER_RADIUS, FONT_SIZE, SPACING } from '../constants';

interface MultiSelectChipsProps {
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  label?: string;
}

export const MultiSelectChips: React.FC<MultiSelectChipsProps> = ({ items, selected, onToggle, label }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../stores/themeStore').DARK_COLORS : require('../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.chipRow}>
        {items.map((item) => {
          const isActive = selected.includes(item);
          return (
            <TouchableOpacity
              key={item}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onToggle(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONT_SIZE.sm, fontWeight: '500', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white, fontWeight: '600' },
});
