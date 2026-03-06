import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { ChatTab } from '../../components/ChatTab';
import { chatApi } from '../../services/api';

export const ChatScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { chatId: initialChatId, otherUserId, caseId, name } = route.params || {};
  const [chatId, setChatId] = useState<string | null>(initialChatId || null);
  const [loading, setLoading] = useState(!initialChatId);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!chatId && otherUserId) {
      chatApi.createChat(otherUserId, caseId)
        .then(({ data }) => {
          setChatId(data.chat?.id || data.id);
        })
        .catch((err: any) => {
          setError(err.response?.data?.error || 'Failed to load chat');
        })
        .finally(() => setLoading(false));
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{name || 'Chat'}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>
      ) : chatId ? (
        <ChatTab chatId={chatId} />
      ) : (
        <View style={styles.center}><Text style={styles.errorText}>Unable to start chat</Text></View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingTop: SPACING.huge, paddingBottom: SPACING.md, paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  errorText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center' },
});
