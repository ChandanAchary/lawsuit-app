import {  useThemeStore , useColors } from '../stores/themeStore';
import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING } from '../constants';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  maxHeight = SCREEN_HEIGHT * 0.75,
}) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const sanitizeChildren = (node: React.ReactNode): React.ReactNode => {
    if (node == null || typeof node === 'boolean') return null;
    if (typeof node === 'string') {
      if (!node.trim()) return null;
      return <Text style={styles.inlineText}>{node}</Text>;
    }
    if (typeof node === 'number') return <Text style={styles.inlineText}>{String(node)}</Text>;
    if (Array.isArray(node)) {
      return node.map((child, idx) => (
        <React.Fragment key={idx}>{sanitizeChildren(child)}</React.Fragment>
      ));
    }
    return node;
  };

  const safeChildren = sanitizeChildren(children);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
          <View />
        </TouchableOpacity>
        <View style={[styles.sheet, { maxHeight }]}>
          <View style={styles.handle} />
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {safeChildren}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const AppModal: React.FC<AppModalProps> = ({ visible, onClose, title, children }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const sanitizeChildren = (node: React.ReactNode): React.ReactNode => {
    if (node == null || typeof node === 'boolean') return null;
    if (typeof node === 'string') {
      if (!node.trim()) return null;
      return <Text style={styles.inlineText}>{node}</Text>;
    }
    if (typeof node === 'number') return <Text style={styles.inlineText}>{String(node)}</Text>;
    if (Array.isArray(node)) {
      return node.map((child, idx) => (
        <React.Fragment key={idx}>{sanitizeChildren(child)}</React.Fragment>
      ));
    }
    return node;
  };

  const safeChildren = sanitizeChildren(children);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {title && (
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{title}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {safeChildren}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  inlineText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  scrollContent: {
    paddingBottom: SPACING.lg,
  },
});
