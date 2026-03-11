import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Image, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, SPACING, SHADOWS, BORDER_RADIUS } from '../../constants';
import { ChatTab } from '../../components/ChatTab';
import { chatApi } from '../../services/api';
import { socketService } from '../../services/socket';
import { ChatParticipant } from '../../types';
import { useAuthStore } from '../../stores/authStore';

export const ChatScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { chatId: initialChatId, otherUserId, caseId, name, otherUser } = route.params || {};
  const [chatId, setChatId] = useState<string | null>(initialChatId || null);
  const [loading, setLoading] = useState(!initialChatId);
  const [error, setError] = useState('');
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const currentUser = useAuthStore((s: any) => s.user);

  // Determine the other participant's display info
  const other: ChatParticipant | null = otherUser || null;
  const displayName = other?.name || name || 'Chat';
  const displayAvatar = other?.avatarUrl || other?.avatar || null;
  const otherId = other?.id || otherUserId;

  // Incoming call state
  const [incomingCall, setIncomingCall] = useState<{ callerName: string; callType: string; roomId: string } | null>(null);

  const generateRoomId = () => `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const initiateCall = (callType: 'audio' | 'video') => {
    if (!otherId) return Alert.alert('Error', 'Cannot determine call recipient');
    const roomId = generateRoomId();
    socketService.emit('call:initiate', { to: otherId, callType, roomId, chatId });
    navigation.navigate('VideoCall', { roomId, callType, otherUser: other, isOutgoing: true, chatId });
  };

  useEffect(() => {
    const init = async () => {
      try {
        let resolvedChatId = chatId;
        if (!resolvedChatId && otherUserId) {
          const { data } = await chatApi.createChat(otherUserId, caseId);
          resolvedChatId = data.chat?.id || data.id;
          setChatId(resolvedChatId);
        }
        if (resolvedChatId) {
          // Load participants
          const { data } = await chatApi.getParticipants(resolvedChatId);
          const list: ChatParticipant[] = data.participants || data || [];
          setParticipants(list);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load chat');
      } finally {
        setLoading(false);
      }
    };
    init();

    // Online presence
    const unsubOnline = socketService.on('user:online', (data: unknown) => {
      const { userId } = data as { userId: string };
      if (userId === otherId) setIsOnline(true);
    });
    const unsubOffline = socketService.on('user:offline', (data: unknown) => {
      const { userId } = data as { userId: string };
      if (userId === otherId) setIsOnline(false);
    });

    // Incoming call
    const unsubIncomingCall = socketService.on('call:incoming', (data: unknown) => {
      const call = data as { from: string; callerName: string; callType: string; roomId: string };
      setIncomingCall({ callerName: call.callerName, callType: call.callType, roomId: call.roomId });
    });

    return () => { unsubOnline(); unsubOffline(); unsubIncomingCall(); };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.avatarWrapper}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPH]}>
              <Ionicons name="person" size={18} color={COLORS.textMuted} />
            </View>
          )}
          {isOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.nameBlock}>
          <Text style={styles.title} numberOfLines={1}>{displayName}</Text>
          {isOnline && <Text style={styles.onlineLabel}>Online</Text>}
        </View>
        <View style={styles.callButtons}>
          <TouchableOpacity style={styles.callBtn} onPress={() => initiateCall('video')}>
            <Ionicons name="videocam-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.callBtn} onPress={() => initiateCall('audio')}>
            <Ionicons name="call-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Incoming Call Modal */}
      <Modal visible={!!incomingCall} transparent animationType="slide">
        <View style={styles.callModalOverlay}>
          <View style={styles.callModal}>
            <Ionicons name={incomingCall?.callType === 'video' ? 'videocam' : 'call'} size={48} color={COLORS.primary} />
            <Text style={styles.callModalTitle}>Incoming {incomingCall?.callType === 'video' ? 'Video' : 'Audio'} Call</Text>
            <Text style={styles.callModalSubtitle}>{incomingCall?.callerName || 'Unknown'}</Text>
            <View style={styles.callModalActions}>
              <TouchableOpacity
                style={[styles.callModalBtn, { backgroundColor: COLORS.error }]}
                onPress={() => {
                  if (incomingCall && otherId) socketService.emit('call:reject', { to: otherId, roomId: incomingCall.roomId, chatId });
                  setIncomingCall(null);
                }}
              >
                <Ionicons name="close" size={28} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.callModalBtn, { backgroundColor: COLORS.success }]}
                onPress={() => {
                  if (incomingCall && otherId) {
                    socketService.emit('call:accept', { to: otherId, roomId: incomingCall.roomId });
                    const callInfo = incomingCall;
                    setIncomingCall(null);
                    navigation.navigate('VideoCall', { roomId: callInfo.roomId, callType: callInfo.callType, otherUser: other, isOutgoing: false, chatId });
                  }
                }}
              >
                <Ionicons name="checkmark" size={28} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>
      ) : chatId ? (
        <ChatTab chatId={chatId} participants={participants} />
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
  avatarWrapper: { position: 'relative' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.success, borderWidth: 2, borderColor: COLORS.white,
  },
  nameBlock: { flex: 1 },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  onlineLabel: { fontSize: FONT_SIZE.xs, color: COLORS.success, fontWeight: '600' },
  callButtons: { flexDirection: 'row', gap: SPACING.sm },
  callBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  callModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  callModal: {
    width: '80%', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xxl,
    alignItems: 'center', gap: SPACING.md,
  },
  callModalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  callModalSubtitle: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  callModalActions: { flexDirection: 'row', gap: SPACING.xxl, marginTop: SPACING.lg },
  callModalBtn: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  errorText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center' },
});
