import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminLegalUpdatesApi, legalUpdatesApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate } from '../../utils/date';

const SUGGESTED_CATEGORIES = ['New Law', 'Amendment', 'Scheme', 'Judgement', 'Notice'];

// Admin authoring surface for legal updates. The user-facing list lives at
// LegalUpdatesScreen; admins create/edit/delete entries here. Both reads
// hit the same /legal-updates endpoint, so editing flows immediately
// reflect in the user-facing list.
export const AdminLegalUpdatesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await legalUpdatesApi.getAll();
      setItems(data?.updates || data?.items || []);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load updates');
      setItems([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => {
    setEditing(null);
    setTitle(''); setContent(''); setCategory(SUGGESTED_CATEGORIES[0]);
    setShowForm(true);
  };

  const startEdit = (item: any) => {
    setEditing(item);
    setTitle(item.title || '');
    setContent(item.content || '');
    setCategory(item.category || SUGGESTED_CATEGORIES[0]);
    setShowForm(true);
  };

  const submit = async () => {
    if (!title.trim()) return Alert.alert('Required', 'Title is required.');
    if (!content.trim()) return Alert.alert('Required', 'Content is required.');
    if (!category.trim()) return Alert.alert('Required', 'Category is required.');
    setSubmitting(true);
    try {
      if (editing) {
        await adminLegalUpdatesApi.update(editing.id, {
          title: title.trim(),
          content: content.trim(),
          category: category.trim(),
        });
        Alert.alert('Saved', 'Update saved.');
      } else {
        await adminLegalUpdatesApi.create({
          title: title.trim(),
          content: content.trim(),
          category: category.trim(),
        });
        Alert.alert('Published', 'Update published.');
      }
      setShowForm(false);
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (item: any) => {
    Alert.alert(
      'Delete update?',
      `"${item.title}" will be permanently removed from the user-facing legal updates list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminLegalUpdatesApi.delete(item.id);
              Alert.alert('Deleted', 'The update has been removed.');
              load(false);
            } catch (err: any) {
              Alert.alert('Error', formatErrorMessage(err) || 'Failed to delete');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryText}>{item.category || 'Uncategorized'}</Text>
        </View>
        <Text style={styles.when}>{item.publishedAt ? formatDate(item.publishedAt) : '—'}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.content} numberOfLines={3}>{item.content}</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#DBEAFE' }]} onPress={() => startEdit(item)}>
          <Ionicons name="create-outline" size={16} color="#1D4ED8" />
          <Text style={[styles.iconBtnText, { color: '#1D4ED8' }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => confirmDelete(item)}>
          <Ionicons name="trash-outline" size={16} color="#B91C1C" />
          <Text style={[styles.iconBtnText, { color: '#B91C1C' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal Updates</Text>
        <TouchableOpacity onPress={startCreate} style={styles.publishBtn}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.publishBtnText}>Publish</Text>
        </TouchableOpacity>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="📰" title="No updates" message="Tap Publish to create the first one." />}
        />
      )}

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit update' : 'Publish update'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.label}>TITLE</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Concise headline"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
                {SUGGESTED_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.catChip, category === c && styles.catChipActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.catChipText, category === c && { color: '#FFFFFF' }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={[styles.input, { marginTop: SPACING.sm }]}
                value={category}
                onChangeText={setCategory}
                placeholder="Or type a custom category"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
              />

              <Text style={styles.label}>CONTENT</Text>
              <TextInput
                style={[styles.input, { height: 200, textAlignVertical: 'top' }]}
                value={content}
                onChangeText={setContent}
                placeholder="The body of the legal update — what changed, who's affected, when it takes effect."
                placeholderTextColor={COLORS.textMuted}
                multiline
              />

              <Button
                title={editing ? 'Save changes' : 'Publish update'}
                onPress={submit}
                loading={submitting}
                size="lg"
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: C.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.text },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: C.primary, borderRadius: BORDER_RADIUS.full,
  },
  publishBtnText: { color: '#FFFFFF', fontSize: FONT_SIZE.xs, fontWeight: '800' },

  list: { padding: SPACING.xl, paddingBottom: 120 },
  card: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  categoryPill: {
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    backgroundColor: C.primaryLight + '22', borderRadius: BORDER_RADIUS.full,
  },
  categoryText: { fontSize: 10, fontWeight: '800', color: C.primary, letterSpacing: 0.3 },
  when: { fontSize: FONT_SIZE.xs, color: C.textMuted },
  title: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  content: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: SPACING.xs },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  iconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  iconBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '92%', paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text },
  modalBody: { padding: SPACING.xl },
  label: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.textMuted, letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: SPACING.xs },
  input: {
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text, marginBottom: SPACING.sm,
  },
  catRow: { gap: SPACING.sm, paddingVertical: SPACING.xs },
  catChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, backgroundColor: C.surfaceAlt,
    borderWidth: 1, borderColor: C.border, marginRight: SPACING.xs,
  },
  catChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  catChipText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textSecondary },
});

export default AdminLegalUpdatesScreen;
