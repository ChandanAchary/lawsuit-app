import {  useThemeStore , useColors } from '../stores/themeStore';
import React, { useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants';
import {
  buildRazorpayCheckoutHTML,
  RazorpayOrderOptions,
  RazorpayPaymentResult,
} from '../utils/razorpay';

// Schemes the WebView itself can navigate. Anything else is a deep-link
// into a native app (UPI/PSP, Razorpay's own intent links, mailto, tel,
// etc.) and must be handed off to Linking.openURL — otherwise Android
// throws net::ERR_UNKNOWN_URL_SCHEME and the checkout dies.
const WEBVIEW_INLINE_SCHEMES = [
  'http://',
  'https://',
  'about:',
  'data:',
  'blob:',
  'file:',
];

const isWebviewNavigable = (url: string): boolean => {
  const lower = (url || '').toLowerCase();
  return WEBVIEW_INLINE_SCHEMES.some((s) => lower.startsWith(s));
};

interface RazorpayCheckoutProps {
  visible: boolean;
  orderOptions: RazorpayOrderOptions;
  onSuccess: (result: RazorpayPaymentResult) => void;
  onCancel: () => void;
  onError?: (error: { code?: string; description?: string; reason?: string }) => void;
}

export const RazorpayCheckout: React.FC<RazorpayCheckoutProps> = ({
  visible,
  orderOptions,
  onSuccess,
  onCancel,
  onError,
}) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const webViewRef = useRef<WebView>(null);

  const html = buildRazorpayCheckoutHTML(orderOptions);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      switch (message.event) {
        case 'success':
          onSuccess(message.data);
          break;
        case 'cancelled':
          onCancel();
          break;
        case 'error':
          onError?.(message.data) ?? onCancel();
          break;
      }
    } catch {
      // Ignore non-JSON messages
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Secure Payment</Text>
          <View style={styles.lockRow}>
            <Ionicons name="lock-closed" size={14} color={COLORS.success} />
            <Text style={styles.lockText}>Razorpay</Text>
          </View>
        </View>
        <WebView
          ref={webViewRef}
          // baseUrl gives the inline HTML a proper https origin so external
          // script loads (checkout.razorpay.com) don't hit cross-origin
          // restrictions on Android.
          source={{ html, baseUrl: 'https://razorpay-checkout.nyayax.local' }}
          // '*' is required for inline HTML — the doc loads with no real
          // origin, and the strict 'https://*' filter intermittently
          // blocks the dynamic <script> tag we inject for checkout.js.
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          // Some Razorpay payment methods (UPI deep links, bank pages)
          // open via target="_blank" — keep them in the same WebView
          // instead of swallowing them.
          setSupportMultipleWindows={false}
          // Android: keep cookies + third-party cookies for the checkout
          // session to persist across redirects.
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          // Critical for UPI / PSP deep links. Android's WebView cannot
          // resolve `upi://`, `phonepe://`, `tez://`, `paytmmp://`,
          // `intent://`, etc. — letting it try blows up with
          // ERR_UNKNOWN_URL_SCHEME (the "Payment Failed" dialog the user
          // saw). For those schemes, hand the URL to the OS via
          // Linking.openURL so the right native app opens, and tell the
          // WebView itself NOT to navigate.
          onShouldStartLoadWithRequest={(request) => {
            const url = request?.url || '';
            if (isWebviewNavigable(url)) return true;
            Linking.openURL(url).catch(() => {
              onError?.({
                description:
                  'Could not open the payment app. If you don\'t have a UPI app installed, choose another method (card, netbanking, wallet).',
              });
            });
            return false;
          }}
          // Surface load errors as a checkout error so the parent shows
          // a useful Alert instead of just leaving the WebView blank.
          // We translate the cryptic ERR_UNKNOWN_URL_SCHEME into a clear
          // hint about UPI apps in case onShouldStartLoadWithRequest
          // didn't catch a sub-frame navigation.
          onError={(syntheticEvent) => {
            const { description, code } = syntheticEvent?.nativeEvent || {};
            const raw = String(description || '');
            const friendly = /ERR_UNKNOWN_URL_SCHEME/i.test(raw)
              ? 'Could not open the payment app. If you don\'t have a UPI app installed, choose another method (card, netbanking, wallet).'
              : (raw || 'WebView failed to load');
            onError?.({ code: String(code ?? ''), description: friendly });
          }}
          onHttpError={(syntheticEvent) => {
            const { description, statusCode } = syntheticEvent?.nativeEvent || {};
            onError?.({ code: String(statusCode ?? ''), description: description || `HTTP ${statusCode}` });
          }}
          onMessage={handleMessage}
          style={styles.webview}
          startInLoadingState
          mixedContentMode="compatibility"
          scalesPageToFit={Platform.OS === 'android'}
        />
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
});
