/**
 * permissions.ts
 *
 * Requests all runtime permissions the app needs:
 *  - Push Notifications
 *  - Location (fine)
 *  - Camera
 *  - Microphone
 *
 * Call `requestAllPermissions()` once on first app launch.
 * Individual helpers can be re-called before using a specific feature.
 */

import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: any;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.warn("expo-notifications is not available in Expo Go.");
  }
}

// ─── Notification Permission ──────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0B4D64',
        sound: 'default',
      });
    }
    return status === 'granted';
  } catch (err) {
    console.warn('[Permissions] Notification permission failed:', err);
    return false;
  }
}

// ─── Location Permission ──────────────────────────────────────────────────────
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Location.getForegroundPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('[Permissions] Location permission failed:', err);
    return false;
  }
}

// ─── Camera Permission ────────────────────────────────────────────────────────
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status: existing } = await ImagePicker.getCameraPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('[Permissions] Camera permission failed:', err);
    return false;
  }
}

// ─── Microphone Permission ────────────────────────────────────────────────────
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const { status: existing } = await getRecordingPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await requestRecordingPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('[Permissions] Microphone permission failed:', err);
    return false;
  }
}

// ─── Request All Permissions ──────────────────────────────────────────────────
export async function requestAllPermissions(): Promise<void> {
  // Run sequentially so Android shows each dialog one at a time
  await requestNotificationPermission();
  await requestLocationPermission();
  await requestCameraPermission();
  await requestMicrophonePermission();
}

// ─── Get Current Location ─────────────────────────────────────────────────────
export interface UserLocation {
  latitude: number;
  longitude: number;
  city?: string;
  district?: string;
}

export async function getCurrentLocation(): Promise<UserLocation | null> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) return null;

    const { coords } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    // Reverse geocode to get city name
    const [place] = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      city: place?.city || place?.subregion || place?.region || undefined,
      district: place?.district || place?.subregion || undefined,
    };
  } catch (err) {
    console.warn('[Location] Failed to get current location:', err);
    return null;
  }
}

// ─── Distance Calculator (Haversine formula) ──────────────────────────────────
export function getDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
