import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from './src/stores/authStore';
import { useNotificationStore } from './src/stores/notificationStore';
import { AuthStack, MainStack } from './src/navigation';
import { COLORS } from './src/constants';

export default function App() {
  const { isAuthenticated, restoreSession } = useAuthStore();
  const { initSocketListeners, fetchUnreadCount } = useNotificationStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      await restoreSession();
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
      <NavigationContainer>
        <StatusBar style={isAuthenticated ? 'dark' : 'light'} />
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
