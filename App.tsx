import './src/utils/debugTextError';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, LogBox, Modal, Text, TouchableOpacity, Image } from 'react-native';
import { NavigationContainer, LinkingOptions, DefaultTheme, DarkTheme, Theme, createNavigationContainerRef } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from './src/stores/authStore';
import { useThemeStore, DARK_COLORS } from './src/stores/themeStore';
import { COLORS } from './src/constants';
import { useNotificationStore } from './src/stores/notificationStore';
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

type IncomingCall = {
  from: string;
  callerName: string;
  callType: 'audio' | 'video';
  roomId: string;
  chatId?: string;
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
        await Promise.all([initTheme(), initRuntimeApiConfig()]);
        await restoreSession();
        // Request all runtime permissions on first launch
        await requestAllPermissions().catch(() => {});
        await configureLocalNotificationChannel().catch(() => {});
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setIsReady(true);
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

      const unsubIncomingCall = socketService.on('call:incoming', (payload: unknown) => {
        const call = payload as IncomingCall;
        if (!call?.from || !call?.roomId) return;
        void presentIncomingCallNotification({
          callerName: call.callerName,
          callType: call.callType,
          roomId: call.roomId,
          chatId: call.chatId,
        });
        setIncomingCall(call);
      });

      const unsubCallEnded = socketService.on('call:ended', (payload: unknown) => {
        const call = payload as { roomId?: string };
        setIncomingCall((prev) => {
          if (!prev) return prev;
          if (call?.roomId && prev.roomId !== call.roomId) return prev;
          return null;
        });
      });

      return () => {
        cleanupNotifications();
        unsubIncomingCall();
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
    if (!incomingCall || !user?.id) return;
    socketService.emit('call:reject', {
      to: incomingCall.from,
      roomId: incomingCall.roomId,
      chatId: incomingCall.chatId,
    });
    setIncomingCall(null);
  };

  const acceptIncomingCall = () => {
    if (!incomingCall || !navigationRef.isReady()) return;

    socketService.emit('call:accept', {
      to: incomingCall.from,
      roomId: incomingCall.roomId,
    });

    const call = incomingCall;
    setIncomingCall(null);
    navigationRef.navigate('VideoCall', {
      roomId: call.roomId,
      callType: call.callType,
      otherUser: { id: call.from, name: call.callerName || 'Unknown' },
      isOutgoing: false,
      chatId: call.chatId,
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
      <NavigationContainer ref={navigationRef} linking={linking} theme={navTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {isAuthenticated ? <MainStack /> : <AuthStack />}
      </NavigationContainer>

      <Modal visible={!!incomingCall} transparent animationType="fade" onRequestClose={rejectIncomingCall}>
        <View style={styles.callOverlay}>
          <View style={[styles.callCard, { backgroundColor: isDark ? DARK_COLORS.surface : COLORS.white }] }>
            <Ionicons
              name={incomingCall?.callType === 'video' ? 'videocam' : 'call'}
              size={42}
              color={isDark ? DARK_COLORS.primary : COLORS.primary}
            />
            <Text style={[styles.callTitle, { color: isDark ? DARK_COLORS.text : COLORS.text }]}>Incoming {incomingCall?.callType === 'video' ? 'Video' : 'Audio'} Call</Text>
            <Text style={[styles.callSubtitle, { color: isDark ? DARK_COLORS.textSecondary : COLORS.textSecondary }]}>from {incomingCall?.callerName || 'Unknown'}</Text>

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
