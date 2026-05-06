import * as ImagePicker from 'expo-image-picker';
import { storageApi } from '../services/api';
import { requestMediaLibraryPermission } from './permissions';

// =============================================================================
// uploadImage — pick an image from the device library and upload it directly
// to Cloudinary using a server-signed payload. Returns the secure_url string
// or null if the user cancelled / permission denied / upload failed.
//
// Centralises the pick → sign → POST loop that was copy-pasted in 5+
// screens. Each caller picks the folder bucket so the dashboard can group
// uploads by purpose later (profiles, court-admin-docs, etc.).
// =============================================================================

export type UploadResult = { secureUrl: string };

export async function pickAndUploadImage(folder: string, opts?: {
  aspect?: [number, number];
  quality?: number;
  allowsEditing?: boolean;
}): Promise<UploadResult | null> {
  const granted = await requestMediaLibraryPermission();
  if (!granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: opts?.allowsEditing ?? true,
    aspect: opts?.aspect ?? [1, 1],
    quality: opts?.quality ?? 0.75,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const { data: signData } = await storageApi.getCloudinarySignature(folder);
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    type: asset.mimeType || 'image/jpeg',
    name: asset.uri.split('/').pop() || 'upload.jpg',
  } as any);
  formData.append('timestamp', String(signData.timestamp));
  formData.append('signature', signData.signature);
  formData.append('api_key', signData.apiKey);
  formData.append('folder', signData.folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(signData.cloudName)}/image/upload`,
    { method: 'POST', body: formData },
  );
  const uploadData = await uploadRes.json();
  if (!uploadData?.secure_url) return null;

  return { secureUrl: uploadData.secure_url };
}
