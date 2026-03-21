/**
 * Push Notification utilities.
 *
 * Flow:
 *  1. Request permission via requestPermissionsAsync()
 *  2. Obtain the native device push token (FCM on Android, APNs on iOS)
 *  3. Register the token with the backend at POST /users/fcm-token
 *  4. On logout: remove the token via DELETE /users/fcm-token
 *
 * The backend's fcm.service.ts uses Firebase Cloud Messaging (FCM) directly,
 * so we register the *native device* token, not an Expo push token.
 */

import { Platform } from 'react-native';
import { usersApi } from '../services/api';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: any;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    // Configure how notifications are presented while the app is foregrounded
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,   // Kept for back-compat (SDK <0.28)
        shouldShowBanner: true,  // SDK >=0.29
        shouldShowList: true,    // SDK >=0.29
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    console.warn('[Push] expo-notifications module is unavailable in this runtime.');
  }
}

async function resolvePushToken(): Promise<string | null> {
  if (!Notifications) return null;

  if (isExpoGo) {
    console.warn('[Push] Native push token is unavailable in Expo Go. Use a development build or release build.');
    return null;
  }

  // Preferred path for this backend: native device token (FCM/APNs)
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData?.data as string | undefined;
    if (token) return token;
  } catch (err) {
    console.warn('[Push] Native token unavailable:', err);
    console.warn('[Push] Native push token is required for this backend (FCM/APNs).');
    return null;
  }

  return null;
}

/**
 * Request push-notification permission, acquire the device token, and
 * register it with the backend.  Safe to call multiple times; errors are
 * swallowed so they never crash the auth flow.
 */

export async function registerPushToken(): Promise<void> {
  if (!Notifications) return;

  try {
    // 1. Request (or check existing) permission
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[Push] Notification permission not granted');
      return;
    }

    // 2. Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0B4D64',
        sound: 'default',
      });
    }

    // 3. Resolve a usable push token
    const token = await resolvePushToken();
    if (!token) {
      console.warn('[Push] No push token available for this device/runtime.');
      return;
    }

    // 4. Register with backend
    await usersApi.registerFcmToken(token);
    console.log('[Push] Token registered');
  } catch (err) {
    // Non-critical – log but don't surface to the user
    console.warn('[Push] Token registration failed:', err);
  }
}

/**
 * Remove the push token from the backend on logout.
 */
export async function unregisterPushToken(): Promise<void> {
  if (!Notifications) return;

  try {
    const token = await resolvePushToken();
    if (token) {
      await usersApi.removeFcmToken(token);
      console.log('[Push] Token unregistered');
    }
  } catch {
    // Ignore errors on logout
  }
}
