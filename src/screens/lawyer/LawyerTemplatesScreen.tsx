import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useTemplateStore } from '../../stores/templateStore';
import { AgreementTemplate } from '../../types';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/Modals';
import { Loading, EmptyState } from '../../components/Common';

export const LawyerTemplatesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { templates, loading, fetchTemplates, createTemplate, updateTemplate, deleteTemplate } = useTemplateStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
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
      Alert.alert('Error', err.response?.data?.error || err.response?.data?.message || 'Save failed');
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
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Agreement Templates</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={templates}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="📝" title="No Templates" message="Create agreement templates for your clients" />}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  list: { padding: SPACING.xl, paddingBottom: 100 },
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
