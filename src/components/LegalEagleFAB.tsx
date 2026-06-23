import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Animated,
  Keyboard,
  Pressable,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { useColors } from '../stores/themeStore';
import { useLegalEagleStore } from '../stores/legalEagleStore';
import { FONT_SIZE } from '../constants';

/**
 * Floating Legal Eagle AI assistant. A bottom-right FAB that expands into a
 * chat sheet, sharing its conversation history with the full-screen
 * AiChatScreen via the shared `legalEagleStore`. Mounted once at the app root
 * so it overlays every authenticated screen (parity with the web widget).
 */
export const LegalEagleFAB: React.FC<{ visible?: boolean }> = ({ visible = true }) => {
  const user = useAuthStore((s) => s.user);
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { messages, loading, open, setOpen, hydrate, send, clear } = useLegalEagleStore();
  const [input, setInput] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Vertical space the floating bottom tab bar occupies (height 72 + bottom 10
  // + the device's bottom inset). The popup floats above this so the nav bar
  // stays visible below it.
  const tabBarSpace = 90 + insets.bottom;
  // A RN Modal renders in its own window where `insets.top` can read 0, so fall
  // back to the Android status-bar height — keeps the popup header below the
  // notch/status bar instead of colliding with the clock + battery icons.
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  );

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Animate the FAB in/out as the active screen changes (visible only on the
  // main tab screens). useNativeDriver keeps opacity + scale on the UI thread.
  const appear = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(appear, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, appear]);

  useEffect(() => {
    void hydrate(user?.id || null);
  }, [user?.id, hydrate]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
      return () => clearTimeout(t);
    }
  }, [messages, open]);

  if (!user?.id) return null;

  const onSend = () => {
    const t = input;
    if (!t.trim() || loading) return;
    setInput('');
    void send(t);
  };

  return (
    <>
      {!open && (
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[
            styles.fab,
            // Lift above the floating tab bar (bottom 10 + inset + 72 tall) so
            // it never overlaps the system nav bar, on any device.
            { backgroundColor: C.primary, bottom: 108 + insets.bottom },
            {
              opacity: appear,
              transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.fabTouch}
            onPress={() => setOpen(true)}
            activeOpacity={0.85}
            accessibilityLabel="Open Legal Eagle AI"
          >
            <Ionicons name="sparkles" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      <Modal
        visible={open}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          {/* The popup sits over a dark dim backdrop, so use light status-bar
              icons (clock/battery) regardless of theme — readable on the dim. */}
          <StatusBar barStyle="light-content" />
          {/* Dim backdrop — tapping outside the panel closes the popup. It stops
              above the bottom tab bar (collapses to full-screen while typing) so
              the nav bar stays visible and un-dimmed below the floating sheet. */}
          <Pressable
            style={[styles.backdrop, { bottom: keyboardVisible ? 0 : tabBarSpace }]}
            onPress={() => setOpen(false)}
          />
          <KeyboardAvoidingView
            // 'padding' on both platforms so the input lifts above the keyboard
            // inside the Modal (Android Modals don't get the window's resize).
            behavior="padding"
            style={styles.kav}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.panel,
                {
                  backgroundColor: C.background,
                  // Clear the status bar/notch + leave a tappable dim strip up top.
                  marginTop: topInset + 36,
                  // Float above the tab bar (closed) / sit flush above the
                  // keyboard (open, tab bar hidden anyway).
                  marginBottom: keyboardVisible ? 0 : tabBarSpace,
                },
              ]}
            >
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: C.border }]}>
                <View style={styles.headerLeft}>
                  <View style={[styles.headerIcon, { backgroundColor: C.primary }]}>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                  </View>
                  <View>
                    <Text style={[styles.headerTitle, { color: C.text }]}>Legal Eagle AI</Text>
                    <Text style={[styles.headerSub, { color: C.textSecondary }]}>Your legal assistant</Text>
                  </View>
                </View>
                <View style={styles.headerActions}>
                  {messages.length > 0 && (
                    <TouchableOpacity onPress={() => void clear()} style={styles.headerBtn} accessibilityLabel="Clear chat">
                      <Ionicons name="trash-outline" size={18} color={C.textSecondary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setOpen(false)} style={styles.headerBtn} accessibilityLabel="Close">
                    <Ionicons name="close" size={22} color={C.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Messages */}
              <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={{ padding: 14, paddingBottom: 18 }}
                keyboardShouldPersistTaps="handled"
              >
                {messages.length === 0 && (
                  <View style={styles.empty}>
                    <Ionicons name="sparkles" size={34} color={C.primary} />
                    <Text style={[styles.emptyText, { color: C.textSecondary }]}>
                      Ask me anything about Indian law, your case, documents, or your next steps.
                    </Text>
                  </View>
                )}
                {messages.map((m) => (
                  <View
                    key={m.id}
                    style={[styles.bubbleRow, m.role === 'user' ? styles.rowRight : styles.rowLeft]}
                  >
                    <View
                      style={[
                        styles.bubble,
                        m.role === 'user'
                          ? { backgroundColor: C.primary, borderTopRightRadius: 4 }
                          : { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderTopLeftRadius: 4 },
                      ]}
                    >
                      {m.role === 'user' ? (
                        <Text style={{ color: '#fff', fontSize: FONT_SIZE.sm, lineHeight: 20 }}>{m.content}</Text>
                      ) : (
                        <Markdown
                          style={{
                            body: { color: C.text, fontSize: FONT_SIZE.sm, lineHeight: 20 },
                            code_inline: { backgroundColor: C.surfaceAlt, color: C.text },
                            fence: { backgroundColor: C.surfaceAlt, color: C.text },
                            link: { color: C.primary },
                            heading1: { color: C.text, fontSize: FONT_SIZE.lg, fontWeight: '700' },
                            heading2: { color: C.text, fontSize: FONT_SIZE.md, fontWeight: '700' },
                          }}
                        >
                          {m.content}
                        </Markdown>
                      )}
                    </View>
                  </View>
                ))}
                {loading && (
                  <View style={[styles.bubbleRow, styles.rowLeft]}>
                    <View style={[styles.bubble, { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1 }]}>
                      <ActivityIndicator size="small" color={C.primary} />
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Input */}
              <View style={[styles.inputRow, { borderTopColor: C.border, backgroundColor: C.surface }]}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask Legal Eagle…"
                  placeholderTextColor={C.textSecondary}
                  style={[styles.input, { color: C.text, backgroundColor: C.background }]}
                  multiline
                  onSubmitEditing={onSend}
                />
                <TouchableOpacity
                  onPress={onSend}
                  disabled={!input.trim() || loading}
                  style={[styles.sendBtn, { backgroundColor: C.primary }, (!input.trim() || loading) && { opacity: 0.5 }]}
                  accessibilityLabel="Send"
                >
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    // Sit clearly above the floating bottom tab bar (height 72 + bottom 10).
    bottom: 96,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 50,
  },
  fabTouch: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // `bottom` is set inline (collapses to 0 while the keyboard is up).
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  kav: {
    // Fill the overlay so the 85%-tall panel has a parent height to shrink
    // against when 'padding' is added on keyboard open (keeps the input visible).
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    // flex:1 (instead of a fixed %) so the sheet fills the space between the
    // top dim strip and the tab-bar gap, and shrinks cleanly when the keyboard
    // pads the KAV — no clipped header.
    flex: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: FONT_SIZE.xs,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
    padding: 8,
  },
  messages: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  bubbleRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '84%',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: FONT_SIZE.sm,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
