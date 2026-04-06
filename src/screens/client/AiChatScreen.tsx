import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { modelChatApi } from '../../services/api';
import Markdown from 'react-native-markdown-display';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'What are my rights as a tenant?',
  'How to file a consumer complaint?',
  'Explain FIR process in India',
  'What is bail and how to apply?',
];

const AI_CHAT_HISTORY_KEY_PREFIX = 'ai_chat_history_v1';
const MAX_HISTORY_MESSAGES = 100;

export const AiChatScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const userId = useAuthStore((s: any) => s.user?.id ?? 'guest');
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);
  const markdownStyles = React.useMemo(() => getMarkdownStyles(COLORS), [isDark]);
  const historyKey = `${AI_CHAT_HISTORY_KEY_PREFIX}:${userId}`;
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let mounted = true;
    const loadHistory = async () => {
      try {
        const raw = await AsyncStorage.getItem(historyKey);
        if (!mounted) return;
        if (!raw) {
          setMessages([]);
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .slice(-MAX_HISTORY_MESSAGES);
          setMessages(sanitized);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      } finally {
        if (mounted) setHistoryReady(true);
      }
    };

    setHistoryReady(false);
    loadHistory();
    return () => {
      mounted = false;
    };
  }, [historyKey]);

  useEffect(() => {
    if (!historyReady) return;
    AsyncStorage.setItem(historyKey, JSON.stringify(messages.slice(-MAX_HISTORY_MESSAGES))).catch(() => {});
  }, [historyReady, historyKey, messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim() };
    const nextHistory = [...messagesRef.current, userMsg].slice(-MAX_HISTORY_MESSAGES);
    messagesRef.current = nextHistory;
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    try {
      const history = nextHistory.map((m) => ({ role: m.role, content: m.content }));
      const { data } = await modelChatApi.chatCompletion(history);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || data.reply || 'I could not generate a response.',
      };
      setMessages((prev) => {
        const updated = [...prev, assistantMsg].slice(-MAX_HISTORY_MESSAGES);
        messagesRef.current = updated;
        return updated;
      });
    } catch {
      setMessages((prev) => [
        ...prev.slice(-(MAX_HISTORY_MESSAGES - 1)),
        { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color={COLORS.white} />
          </View>
        )}
        <View style={[styles.bubbleContent, isUser ? styles.userContent : styles.aiContent]}>
          {isUser ? (
            <Text style={styles.userText}>{item.content}</Text>
          ) : (
            <Markdown style={markdownStyles}>{item.content}</Markdown>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.aiIcon}>
            <Ionicons name="sparkles" size={18} color={COLORS.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Legal Eagle AI</Text>
            <Text style={styles.headerSub}>Your AI Legal Assistant</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="sparkles" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>Ask Legal Eagle</Text>
            <Text style={styles.emptyDesc}>Get instant answers to your legal questions powered by AI</Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s, i) => (
                <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => sendMessage(s)}>
                  <Text style={styles.suggestionText}>{s}</Text>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatRef.current?.scrollToEnd()}
            keyboardDismissMode="none"
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              loading ? (
                <View style={[styles.bubble, styles.aiBubble]}>
                  <View style={styles.aiAvatar}>
                    <Ionicons name="sparkles" size={14} color={COLORS.white} />
                  </View>
                  <View style={[styles.bubbleContent, styles.aiContent]}>
                    <Text style={styles.aiTyping}>Thinking...</Text>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* Input */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(SPACING.md, insets.bottom) }] }>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask a legal question..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const getMarkdownStyles = (COLORS: any) => StyleSheet.create({
  body: { fontSize: FONT_SIZE.md, color: COLORS.text, lineHeight: 22 },
  heading1: { fontSize: FONT_SIZE.xl, fontWeight: '800' as any, marginBottom: 8, color: COLORS.text },
  heading2: { fontSize: FONT_SIZE.lg, fontWeight: '700' as any, marginBottom: 6, color: COLORS.text },
  heading3: { fontSize: FONT_SIZE.md, fontWeight: '700' as any, marginBottom: 6, color: COLORS.text },
  paragraph: { marginBottom: 8, color: COLORS.text },
  bullet_list: { color: COLORS.text },
  ordered_list: { color: COLORS.text },
  list_item: { marginBottom: 4, color: COLORS.text },
  text: { color: COLORS.text },
  code_inline: {
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.text,
    paddingHorizontal: 4,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fence: { backgroundColor: COLORS.surfaceAlt, color: COLORS.text, padding: 12, borderRadius: 8, marginVertical: 8 },
  strong: { fontWeight: '700' as any, color: COLORS.text },
}) as any;

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  chatBody: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingTop: SPACING.huge, paddingBottom: SPACING.md, paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  aiIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  headerSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl },
  emptyIcon: { marginBottom: SPACING.xl },
  emptyTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text, marginBottom: SPACING.sm },
  emptyDesc: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 280 },
  suggestions: { marginTop: SPACING.xxl, width: '100%' },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  suggestionText: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text, flex: 1 },
  messageList: { padding: SPACING.lg, paddingBottom: SPACING.sm, flexGrow: 1 },
  bubble: { flexDirection: 'row', marginBottom: SPACING.md, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end' },
  aiBubble: { alignSelf: 'flex-start' },
  aiAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm, marginTop: 4,
  },
  bubbleContent: { borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, maxWidth: '100%' },
  userContent: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  aiContent: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, ...SHADOWS.sm, flex: 1 },
  userText: { fontSize: FONT_SIZE.md, color: COLORS.white, lineHeight: 22 },
  aiTyping: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, paddingBottom: SPACING.xl,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  input: {
    flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
