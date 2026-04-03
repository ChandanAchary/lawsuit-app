/**
 * Push Notification utilities.
 *
 * Flow:
 *  1. Request permission via requestPermissionsAsync()
 *  2. Obtain a device push token (native FCM/APNs preferred, Expo token fallback)
 *  3. Register the token with the backend at POST /users/fcm-token
 *  4. On logout: remove the token via DELETE /users/fcm-token
 *
 * The backend supports both native FCM/APNs delivery and Expo push delivery.
 * This client prefers native device tokens and falls back to Expo tokens.
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

  // Preferred path: native device token (FCM/APNs) when available.
  // In Expo-managed setups without native Firebase wiring, this can fail,
  // so we fall back to Expo push token below.
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData?.data as string | undefined;
    if (token) return token;
  } catch (err) {
    console.warn('[Push] Native token unavailable:', err);
  }

  // Fallback path: Expo push token.
  // Works with EAS project credentials and lets the backend route via Expo Push API.
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('[Push] Expo projectId is missing; cannot resolve Expo push token.');
      return null;
    }

    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = expoToken?.data as string | undefined;
    if (token) return token;
  } catch (err) {
    if (isExpoGo) {
      console.warn('[Push] Expo Go does not support remote push notifications in this setup. Use a development build or production build.');
    }
    console.warn('[Push] Expo push token unavailable:', err);
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
