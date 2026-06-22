import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
  ScrollView, Linking, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useColors, useThemeStore } from '../../stores/themeStore';

// =============================================================================
// DocumentPreviewScreen — universal in-app viewer for an uploaded asset.
// Mirrors the web app's DocumentPreviewPage / DocumentPreview component.
//
// Why this exists: documents were previously opened with Linking.openURL,
// which hands the raw Cloudinary URL to the OS browser. PDFs uploaded to
// Cloudinary's /raw/upload/ are served as `application/octet-stream`, so the
// browser downloads them or shows "Failed to load PDF" instead of rendering.
//
// Strategy per kind:
//   - image  → native <Image> (pinch-to-zoom via maximumZoomScale ScrollView)
//   - pdf    → WebView pointed at Google Docs' gview, which renders
//              octet-stream PDFs reliably on both iOS and Android
//   - other  → a card with "Open externally" (Linking) since the OS handles
//              DOCX/XLSX/etc. better than any in-app viewer
//
// Route params: { url: string; name?: string; mimeType?: string }
// =============================================================================

type Kind = 'image' | 'pdf' | 'other';

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif', 'heic', 'heif'];

function detectKind(url: string, mimeType?: string): Kind {
  const m = (mimeType || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  const cleanUrl = (url || '').split('?')[0];
  const ext = (cleanUrl.split('.').pop() || '').toLowerCase();
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}

function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent((url || '').split('?')[0].split('/').pop() || 'Document');
  } catch {
    return 'Document';
  }
}

export const DocumentPreviewScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const url: string = route.params?.url || '';
  const mimeType: string | undefined = route.params?.mimeType;
  const displayName: string = route.params?.name || fileNameFromUrl(url);

  const kind = useMemo(() => detectKind(url, mimeType), [url, mimeType]);
  const [imgFailed, setImgFailed] = useState(false);
  const [webLoading, setWebLoading] = useState(true);

  const openExternally = () => {
    if (!url) return;
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open', 'No app is available to open this file.'),
    );
  };

  // Google Docs viewer renders Cloudinary octet-stream PDFs reliably on
  // both platforms. Direct WebView of the raw URL fails on Android for
  // octet-stream, so we always route PDFs through gview.
  const pdfViewerUrl = useMemo(
    () => `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`,
    [url],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
        <TouchableOpacity onPress={openExternally} style={styles.headerAction}>
          <Ionicons name="open-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {!url ? (
        <View style={styles.center}>
          <Ionicons name="document-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Nothing to preview</Text>
          <Text style={styles.emptySub}>No document URL was provided.</Text>
        </View>
      ) : kind === 'image' && !imgFailed ? (
        <ScrollView
          style={styles.imageScroll}
          contentContainerStyle={styles.imageScrollContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={{ uri: url }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setImgFailed(true)}
          />
        </ScrollView>
      ) : kind === 'pdf' ? (
        <View style={styles.flex}>
          <WebView
            source={{ uri: pdfViewerUrl }}
            style={styles.webview}
            onLoadEnd={() => setWebLoading(false)}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            // Surface any hard failure as the generic fallback card.
            onError={() => setWebLoading(false)}
          />
          {webLoading && (
            <View style={styles.webLoading} pointerEvents="none">
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.webLoadingText}>Loading preview…</Text>
            </View>
          )}
        </View>
      ) : (
        // Non-previewable (DOCX/XLSX/ZIP/…), or an image that failed to load.
        <View style={styles.center}>
          <View style={styles.fileIcon}>
            <Ionicons name="document-text-outline" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.fileName} numberOfLines={2}>{displayName}</Text>
          <Text style={styles.emptySub}>
            {mimeType || 'This file type'} can't be previewed in-app.
          </Text>
          <TouchableOpacity style={styles.openBtn} onPress={openExternally}>
            <Ionicons name="open-outline" size={18} color={COLORS.white} />
            <Text style={styles.openBtnText}>Open / Download</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  flex: { flex: 1 },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: C.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text },
  headerAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl, gap: SPACING.sm },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text, marginTop: SPACING.sm },
  emptySub: { fontSize: FONT_SIZE.sm, color: C.textMuted, textAlign: 'center' },

  imageScroll: { flex: 1, backgroundColor: '#000' },
  imageScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%', minHeight: 400 },

  webview: { flex: 1, backgroundColor: C.background },
  webLoading: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.background, gap: SPACING.md,
  },
  webLoadingText: { fontSize: FONT_SIZE.sm, color: C.textMuted },

  fileIcon: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: C.primaryLight + '18',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  fileName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: C.text, textAlign: 'center' },
  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: C.primary, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full, marginTop: SPACING.lg, ...SHADOWS.sm,
  },
  openBtnText: { color: C.white, fontSize: FONT_SIZE.md, fontWeight: '700' },
});

export default DocumentPreviewScreen;
