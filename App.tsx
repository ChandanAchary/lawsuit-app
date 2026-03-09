import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import { NavigationContainer, LinkingOptions, DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from './src/stores/authStore';
import { useThemeStore, DARK_COLORS } from './src/stores/themeStore';
import { COLORS } from './src/constants';
import { useNotificationStore } from './src/stores/notificationStore';
import { AuthStack, MainStack } from './src/navigation';

// Suppress Expo OTA update errors permanently — we don't use OTA updates
LogBox.ignoreLogs(['Failed to download remote update']);
if (typeof ErrorUtils !== 'undefined') {
  const origHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    if (error?.message?.includes?.('Failed to download remote update')) return;
    origHandler(error, isFatal);
  });
}

const linking: LinkingOptions<any> = {
  prefixes: ['lawsuit://', 'https://lawsuit-app.com'],
  config: {
    screens: {
      Register: {
        path: 'register',
        parse: { referralCode: (ref: string) => ref },
      },
    },
  },
};

export default function App() {
  const { isAuthenticated, restoreSession } = useAuthStore();
  const { initSocketListeners, fetchUnreadCount } = useNotificationStore();
  const [isReady, setIsReady] = useState(false);
  const initTheme = useThemeStore(state => state.init);
  const isDark = useThemeStore(state => state.isDark);

  const navTheme: Theme = isDark
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

  useEffect(() => {
    const init = async () => {
      await Promise.all([restoreSession(), initTheme()]);
      setIsReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      initSocketListeners();
      fetchUnreadCount();
    }
  }, [isAuthenticated]);

  if (!isReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer linking={linking} theme={navTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {isAuthenticated ? <MainStack /> : <AuthStack />}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
