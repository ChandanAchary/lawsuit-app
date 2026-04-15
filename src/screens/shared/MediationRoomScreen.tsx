// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useThemeStore, useColors } from '../../stores/themeStore';
import { mediationApi } from '../../services/api';
import { formatErrorMessage } from '../../utils/formatError';

export const MediationRoomScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const id: string = route.params?.id;
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await mediationApi.getRoom(id);
      const payload = data.data || data;
      setRoomUrl(payload.url || payload.roomUrl || payload.dailyRoomUrl || null);
      setToken(payload.token || null);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to get room access', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally { setLoading(false); }
  }, [id, navigation]);

  useEffect(() => { load(); }, [load]);

  const finalUrl = roomUrl ? (token ? `${roomUrl}${roomUrl.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}` : roomUrl) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mediation Room</Text>
      </View>
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Joining mediation room…</Text>
        </View>
      )}
      {!loading && finalUrl && (
        <WebView
          source={{ uri: finalUrl }}
          style={{ flex: 1, backgroundColor: '#000' }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['https://*']}
        />
      )}
      {!loading && !finalUrl && (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Room is not ready yet.</Text>
        </View>
      )}
    </View>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: '#000',
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, backgroundColor: '#000' },
  loadingText: { color: '#FFF', fontSize: FONT_SIZE.md },
});
