import React, { useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants';
import {
  buildRazorpayCheckoutHTML,
  RazorpayOrderOptions,
  RazorpayPaymentResult,
} from '../utils/razorpay';

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
          source={{ html }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
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

const styles = StyleSheet.create({
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
