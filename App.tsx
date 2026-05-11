import './src/utils/debugTextError';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  LogBox,
  Modal,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NavigationContainer, LinkingOptions, DefaultTheme, DarkTheme, Theme, createNavigationContainerRef } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from './src/stores/authStore';
import { useThemeStore, DARK_COLORS } from './src/stores/themeStore';
import { COLORS } from './src/constants';
import { useNotificationStore } from './src/stores/notificationStore';
import { useActiveCallStore } from './src/stores/activeCallStore';
import { AuthStack, MainStack } from './src/navigation';
import { requestAllPermissions } from './src/utils/permissions';
import { socketService } from './src/services/socket';
import { initRuntimeApiConfig } from './src/services/runtimeApiConfig';
import {
  addNotificationResponseListener,
  configureLocalNotificationChannel,
  handleInitialNotificationNavigation,
  presentIncomingCallNotification,
} from './src/utils/localNotifications';

// Suppress known non-critical warnings
LogBox.ignoreLogs([
  'Failed to download remote update',
  'Text strings must be rendered within a <Text> component',
]);
if (typeof ErrorUtils !== 'undefined') {
  const origHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    if (error?.message?.includes?.('Failed to download remote update')) return;
    origHandler(error, isFatal);
  });
}

const linking: LinkingOptions<any> = {
  prefixes: ['nyayax://', 'lawsuit://', 'https://nyayax.com'],
  config: {
    screens: {
      Register: {
        path: 'register',
        parse: { referralCode: (ref: string) => ref },
      },
    },
  },
};

const navigationRef = createNavigationContainerRef<any>();

// Mirrors the server payload for `call:incoming`. The mobile app used to
// use a homegrown shape ({ from, roomId, callerName }) that the server has
// never emitted — calls always silently dropped. We now follow the same
// callId / roomUrl / token contract that lawsuit-frontend uses.
type IncomingCallCaller = {
  id: string;
  name: string;
  avatar?: string;
  role?: 'CLIENT' | 'LAWYER';
};

type IncomingCall = {
  callId: string;
  callType: 'chat' | 'appointment';
  referenceId: string;
  mediaType: 'audio' | 'video';
  caller: IncomingCallCaller;
  roomUrl: string;
  token: string;
};

export default function App() {
  const { isAuthenticated, restoreSession, user } = useAuthStore();
  const { initSocketListeners, fetchUnreadCount } = useNotificationStore();
  const [isReady, setIsReady] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const initTheme = useThemeStore(state => state.init);
  const isDark = useThemeStore(state => state.isDark);
  const mode = useThemeStore(state => state.mode);

  // Compute theme based on current dark mode state
  const navTheme: Theme = React.useMemo(() => {
    const currentIsDark = isDark;
    return currentIsDark
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: DARK_COLORS.background,
            card: DARK_COLORS.surface,
            text: DARK_COLORS.text,
            border: DARK_COLORS.border,
            primary: DARK_COLORS.primary,
            notification: DARK_COLORS.primary,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: COLORS.background,
            card: COLORS.surface,
            text: COLORS.text,
            border: COLORS.border,
            primary: COLORS.primary,
            notification: COLORS.primary,
          },
        };
  }, [isDark]);

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.allSettled([initTheme(), initRuntimeApiConfig(), restoreSession()]);
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setIsReady(true);
        // Keep startup snappy: permissions and channel setup should not block first paint.
        void requestAllPermissions().catch(() => {});
        void configureLocalNotificationChannel().catch(() => {});
      }
    };
    init();
  }, [initTheme, restoreSession]);

  useEffect(() => {
    const navigateFromNotification = (target: { name: string; params?: Record<string, unknown> }) => {
      if (!navigationRef.isReady()) return;
      (navigationRef as any).navigate(target.name, target.params);
    };

    void handleInitialNotificationNavigation(navigateFromNotification);
    const unsubNotificationResponse = addNotificationResponseListener(navigateFromNotification);

    return () => {
      unsubNotificationResponse();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      socketService.connect().catch(() => {});
      const cleanupNotifications = initSocketListeners();
      fetchUnreadCount();

      // Incoming call ringing — keep modal up until the user picks Accept
      // / Decline, the caller cancels, or the call times out.
      const unsubIncomingCall = socketService.on('call:incoming', (payload: unknown) => {
        const call = payload as IncomingCall;
        if (!call?.callId || !call?.caller?.id || !call?.roomUrl || !call?.token) return;
        void presentIncomingCallNotification({
          callerName: call.caller?.name || 'Unknown',
          callType: call.mediaType === 'audio' ? 'audio' : 'video',
          // The local notification layer was built around the old
          // `roomId`/`chatId` payload — map the new server shape to the
          // fields it still understands so the heads-up notification keeps
          // working without forcing a rewrite of localNotifications.
          roomId: call.callId,
          chatId: call.callType === 'chat' ? call.referenceId : undefined,
        });
        setIncomingCall(call);
      });

      // Caller hung up before we answered, or remote side ended after we
      // answered. Either way, dismiss any open incoming-call modal AND
      // clear the global active-call store so the chat "Tap to return to
      // call" banner doesn't keep hanging around after the call is gone.
      const unsubCallCancelled = socketService.on('call:cancelled', (payload: unknown) => {
        const data = payload as { callId?: string };
        setIncomingCall((prev) => {
          if (!prev) return prev;
          if (data?.callId && prev.callId !== data.callId) return prev;
          return null;
        });
        const active = useActiveCallStore.getState().call;
        if (active && (!data?.callId || active.callId === data.callId)) {
          useActiveCallStore.getState().clear();
        }
      });

      const unsubCallEnded = socketService.on('call:ended', (payload: unknown) => {
        const data = payload as { callId?: string };
        setIncomingCall((prev) => {
          if (!prev) return prev;
          if (data?.callId && prev.callId !== data.callId) return prev;
          return null;
        });
        const active = useActiveCallStore.getState().call;
        if (active && (!data?.callId || active.callId === data.callId)) {
          useActiveCallStore.getState().clear();
        }
      });

      return () => {
        cleanupNotifications();
        unsubIncomingCall();
        unsubCallCancelled();
        unsubCallEnded();
      };
    }

    setIncomingCall(null);
    socketService.disconnect();
    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, initSocketListeners, fetchUnreadCount]);

  const rejectIncomingCall = () => {
    if (!incomingCall) return;
    socketService.declineCall(incomingCall.callId);
    setIncomingCall(null);
  };

  const acceptIncomingCall = () => {
    if (!incomingCall || !navigationRef.isReady()) return;

    socketService.acceptCall(incomingCall.callId);

    const call = incomingCall;
    setIncomingCall(null);

    // Seed the global active-call store right away so the chat resume
    // banner works even if the user immediately minimizes the call screen.
    // VideoCallScreen will re-seed on mount with the same data; both paths
    // are idempotent.
    useActiveCallStore.getState().setActive({
      callId: call.callId,
      roomUrl: call.roomUrl,
      token: call.token,
      mediaType: call.mediaType,
      otherUser: {
        id: call.caller.id,
        name: call.caller.name,
        avatarUrl: call.caller.avatar,
      },
      chatId: call.callType === 'chat' ? call.referenceId : undefined,
      appointmentId: call.callType === 'appointment' ? call.referenceId : undefined,
      isOutgoing: false,
      startedAt: Date.now(),
    });

    // Pass the server-issued Daily room + token straight through to the
    // VideoCall screen. The screen joins the Daily room with these and
    // does NOT re-emit `call:initiate` (it's an incoming call).
    navigationRef.navigate('VideoCall', {
      callId: call.callId,
      roomUrl: call.roomUrl,
      token: call.token,
      mediaType: call.mediaType,
      callType: call.mediaType, // legacy alias the screen used to read
      otherUser: {
        id: call.caller.id,
        name: call.caller.name || 'Unknown',
        avatarUrl: call.caller.avatar,
      },
      isOutgoing: false,
      chatId: call.callType === 'chat' ? call.referenceId : undefined,
    });
  };

  if (!isReady) {
    return (
      <View style={styles.splashScreen}> 
        <Image source={require('./assets/splash-icon.png')} style={styles.splashLogo} resizeMode="contain" />
        <Text style={styles.splashBrand}>NyayaX</Text>
        <ActivityIndicator size="small" color={COLORS.textSecondary} style={styles.splashLoader} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.appRoot}>
        <NavigationContainer ref={navigationRef} linking={linking} theme={navTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {isAuthenticated ? <MainStack /> : <AuthStack />}
        </NavigationContainer>
      </View>

      <Modal visible={!!incomingCall} transparent animationType="fade" onRequestClose={rejectIncomingCall}>
        <View style={styles.callOverlay}>
          <View style={[styles.callCard, { backgroundColor: isDark ? DARK_COLORS.surface : COLORS.white }] }>
            <Ionicons
              name={incomingCall?.mediaType === 'video' ? 'videocam' : 'call'}
              size={42}
              color={isDark ? DARK_COLORS.primary : COLORS.primary}
            />
            <Text style={[styles.callTitle, { color: isDark ? DARK_COLORS.text : COLORS.text }]}>Incoming {incomingCall?.mediaType === 'video' ? 'Video' : 'Audio'} Call</Text>
            <Text style={[styles.callSubtitle, { color: isDark ? DARK_COLORS.textSecondary : COLORS.textSecondary }]}>from {incomingCall?.caller?.name || 'Unknown'}</Text>

            <View style={styles.callActions}>
              <TouchableOpacity style={[styles.callActionBtn, { backgroundColor: COLORS.error }]} onPress={rejectIncomingCall}>
                <Ionicons name="close" size={28} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.callActionBtn, { backgroundColor: COLORS.success }]} onPress={acceptIncomingCall}>
                <Ionicons name="checkmark" size={28} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  splashScreen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 220,
    height: 220,
  },
  splashBrand: {
    marginTop: 18,
    fontSize: 42,
    fontWeight: '500',
    color: '#111111',
    letterSpacing: 0.5,
  },
  splashLoader: {
    marginTop: 20,
  },
  callOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  callCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  callTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 10,
  },
  callSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  callActions: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 26,
  },
  callActionBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
