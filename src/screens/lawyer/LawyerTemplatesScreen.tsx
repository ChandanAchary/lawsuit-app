import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, ScrollView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useTemplateStore } from '../../stores/templateStore';
import { AgreementTemplate } from '../../types';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/Modals';
import { Loading, EmptyState } from '../../components/Common';
import { formatErrorMessage } from '../../utils/formatError';

export const LawyerTemplatesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const { templates, loading, fetchTemplates, createTemplate, updateTemplate, deleteTemplate } = useTemplateStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTemplates(); }, []);

  const openCreate = () => {
    setEditingId(null); setTitle(''); setContent(''); setDescription(''); setCategory('');
    setShowForm(true);
  };

  const openEdit = (t: AgreementTemplate) => {
    setEditingId(t.id); setTitle(t.title); setContent(t.content); setDescription((t as any).description || ''); setCategory(t.category || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return Alert.alert('Required', 'Title and content are required');
    setSaving(true);
    try {
      if (editingId) {
        await updateTemplate(editingId, { title, description: description || undefined, content, category: category || undefined });
      } else {
        await createTemplate({ title, description: description || undefined, content, category: category || undefined });
      }
      setShowForm(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Template', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteTemplate(id); } catch { Alert.alert('Error', 'Delete failed'); }
      }},
    ]);
  };

  const baseCategories = ['Retainer', 'NDA', 'Service Agreement', 'Employment', 'Partnership', 'Lease', 'Other'];
  const dynamicCategories = Array.from(
    new Set(
      templates
        .map((t) => String(t.category || '').trim())
        .filter(Boolean),
    ),
  );
  const categories = ['All', ...Array.from(new Set([...baseCategories, ...dynamicCategories]))];

  const filteredTemplates = templates.filter((template) => {
    const q = searchQuery.trim().toLowerCase();
    const inCategory = selectedCategory === 'All' || String(template.category || '') === selectedCategory;
    if (!inCategory) return false;
    if (!q) return true;
    return [template.title, template.description || '', template.content, template.category || '']
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const renderItem = ({ item }: { item: AgreementTemplate }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Ionicons name="document-text" size={20} color={COLORS.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          {item.category && <Text style={styles.cardCat}>{item.category}</Text>}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.cardContent} numberOfLines={3}>{item.content}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.headerBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Agreement Templates</Text>
          <Text style={styles.headerSubtitle}>Create and manage reusable templates for client agreements</Text>
        </View>
        <TouchableOpacity onPress={openCreate} style={styles.newTemplateBtn}>
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={styles.newTemplateText}>New Template</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search templates..."
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryRow}
      >
        {categories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? <Loading /> : (
        <FlatList
          data={filteredTemplates}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="📝" title="No Templates" message="No templates found for this filter" />}
        />
      )}

      <BottomSheet visible={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Edit Template' : 'New Template'}>
        <TextInput style={styles.input} placeholder="Template Title" value={title} onChangeText={setTitle} placeholderTextColor={COLORS.textMuted} />
        <TextInput style={styles.input} placeholder="Description (optional)" value={description} onChangeText={setDescription} placeholderTextColor={COLORS.textMuted} />
        <TextInput style={styles.input} placeholder="Category (optional)" value={category} onChangeText={setCategory} placeholderTextColor={COLORS.textMuted} />
        <TextInput
          style={[styles.input, { height: 150, textAlignVertical: 'top' }]}
          placeholder="Template content..."
          value={content}
          onChangeText={setContent}
          multiline
          placeholderTextColor={COLORS.textMuted}
        />
        <Button title={editingId ? 'Update Template' : 'Create Template'} onPress={handleSave} loading={saving} size="lg" />
      </BottomSheet>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.primary,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.white },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 2,
  },
  newTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  newTemplateText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  searchWrap: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  categoryScroll: {
    maxHeight: 52,
  },
  categoryRow: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    alignItems: 'center',
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    height: 40,
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    alignSelf: 'center',
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: FONT_SIZE.sm,
  },
  categoryChipTextActive: {
    color: COLORS.white,
  },
  list: { padding: SPACING.xl, paddingTop: SPACING.sm, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  cardIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  cardCat: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: { padding: SPACING.xs },
  cardContent: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  input: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md,
  },
});
