import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../constants';
import { useColors } from '../stores/themeStore';

interface TabBarProps {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onSelect: (key: string) => void;
  /** 'pill'   = filled grey pills (default)
   *  'capsule' = tall oval capsules for Cases
   *  'filter'  = bordered white pills (matches SearchScreen sort chips) */
  variant?: 'pill' | 'capsule' | 'filter';
  /** When true, renders the filter variant with inverted colours for dark/primary headers */
  onDarkBg?: boolean;
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, active, onSelect, variant = 'pill', onDarkBg = false }) => {
  const C = useColors();

  if (variant === 'filter') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          filterStyles.container,
        ]}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const chipBg = onDarkBg
            ? (isActive ? C.white : 'rgba(255,255,255,0.15)')
            : (isActive ? C.primary : C.surface);
          const chipBorder = onDarkBg
            ? (isActive ? C.white : 'rgba(255,255,255,0.35)')
            : (isActive ? C.primary : C.border);
          const chipText = onDarkBg
            ? (isActive ? C.primary : 'rgba(255,255,255,0.9)')
            : (isActive ? C.white : C.textSecondary);
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onSelect(tab.key)}
              activeOpacity={0.75}
              style={[
                filterStyles.chip,
                { backgroundColor: chipBg, borderColor: chipBorder },
              ]}
            >
              <Text style={[filterStyles.chipText, { color: chipText }]}>
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count > 0 && (
                <View
                  style={[
                    filterStyles.badge,
                    {
                      backgroundColor: isActive
                        ? (onDarkBg ? 'rgba(11,77,100,0.15)' : 'rgba(255,255,255,0.25)')
                        : C.surfaceAlt,
                    },
                  ]}
                >
                  <Text style={[filterStyles.badgeText, { color: chipText }]}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  if (variant === 'capsule') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          capsuleStyles.container,
          { backgroundColor: C.background },
        ]}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onSelect(tab.key)}
              activeOpacity={0.75}
              style={[
                capsuleStyles.capsule,
                {
                  backgroundColor: isActive ? C.primary : C.surfaceAlt,
                  ...(isActive ? SHADOWS.md : {}),
                },
              ]}
            >
              <Text
                style={[
                  capsuleStyles.capsuleText,
                  { color: isActive ? C.white : C.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count > 0 && (
                <View
                  style={[
                    capsuleStyles.badge,
                    {
                      backgroundColor: isActive
                        ? 'rgba(255,255,255,0.25)'
                        : C.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      capsuleStyles.badgeText,
                      { color: isActive ? C.white : C.textSecondary },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  // ── pill variant (Appointments) ──────────────────────────
  return (
    <View style={[pillStyles.wrapper, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={pillStyles.container}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onSelect(tab.key)}
              activeOpacity={0.75}
              style={[
                pillStyles.pill,
                {
                  backgroundColor: isActive ? C.primary : C.surfaceAlt,
                  ...(isActive ? SHADOWS.sm : {}),
                },
              ]}
            >
              <Text
                style={[
                  pillStyles.pillText,
                  { color: isActive ? C.white : C.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count > 0 && (
                <View
                  style={[
                    pillStyles.badge,
                    {
                      backgroundColor: isActive
                        ? 'rgba(255,255,255,0.25)'
                        : C.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      pillStyles.badgeText,
                      { color: isActive ? C.white : C.textSecondary },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

interface ChipGroupProps {
  items: string[];
  selected: string;
  onSelect: (item: string) => void;
}

export const ChipGroup: React.FC<ChipGroupProps> = ({ items, selected, onSelect }) => {
  const C = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={chipStyles.container}
    >
      {items.map((item) => {
        const isActive = item === selected;
        return (
          <TouchableOpacity
            key={item}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
            style={[
              chipStyles.chip,
              {
                backgroundColor: isActive ? C.primary : C.surface,
                borderColor: isActive ? C.primary : C.border,
              },
            ]}
          >
            <Text
              style={[
                chipStyles.chipText,
                { color: isActive ? C.white : C.textSecondary },
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

// ── Filter (search-chip) styles ─────────────────────────────────
const filterStyles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  chipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
});

// ── Pill styles ──────────────────────────────────────────────────
const pillStyles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    paddingBottom: SPACING.sm,
  },
  container: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  pillText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
});

// ── Capsule styles ───────────────────────────────────────────────
const capsuleStyles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  capsule: {
    width: 72,
    height: 96,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  capsuleText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  badge: {
    marginTop: SPACING.xs,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
});

// ── Chip styles ──────────────────────────────────────────────────
const chipStyles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  chip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
});
