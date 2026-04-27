import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING } from '../../constants';
import { Button } from '../../components/Button';

const { width, height } = Dimensions.get('window');

export const LandingScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim3 = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // For staggered features
  const featuresAnim = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    // Pulse animations for circles
    const createPulse = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1.1,
            duration: 2000,
            useNativeDriver: true,
            delay,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
    };

    createPulse(pulseAnim1, 0).start();
    createPulse(pulseAnim2, 500).start();
    createPulse(pulseAnim3, 1000).start();

    // Floating animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Staggered fade and slide for features
    Animated.stagger(200,
      featuresAnim.map(anim =>
        Animated.spring(anim, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        })
      )
    ).start();

  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.primary, COLORS.midnight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Decorative circles */}
        <Animated.View style={[styles.decorCircle, styles.circle1, { transform: [{ scale: pulseAnim1 }] }]} />
        <Animated.View style={[styles.decorCircle, styles.circle2, { transform: [{ scale: pulseAnim2 }] }]} />
        <Animated.View style={[styles.decorCircle, styles.circle3, { transform: [{ scale: pulseAnim3 }] }]} />

        <View style={styles.content}>
          <View style={styles.logoSection}>
            <Animated.View style={[styles.logoContainer, { transform: [{ translateY: floatAnim }] }]}>
              <View style={styles.logoBg}>
                <Text style={styles.logoIcon}>⚖️</Text>
              </View>
            </Animated.View>
            <Text style={styles.appName}>NyayaX</Text>
            <Text style={styles.tagline}>Your Legal Companion</Text>
          </View>

          <View style={styles.features}>
            {[
              { icon: '🔍', title: 'Find Lawyers', desc: 'Search top-rated legal experts near you' },
              { icon: '📅', title: 'Book Instantly', desc: 'Schedule consultations in seconds' },
              { icon: '💬', title: 'Chat & Consult', desc: 'Connect via chat or video call' },
              { icon: '📁', title: 'Track Cases', desc: 'Manage all your legal matters' },
            ].map((f, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.featureRow,
                  {
                    opacity: featuresAnim[i],
                    transform: [{
                      translateY: featuresAnim[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0]
                      })
                    }]
                  }
                ]}
              >
                <View style={styles.featureIcon}>
                  <Text style={styles.featureEmoji}>{f.icon}</Text>
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </Animated.View>
            ))}
          </View>

          <View style={styles.buttons}>
            <Button
              title="Get Started"
              onPress={() => navigation.navigate('Register')}
              variant="secondary"
              size="lg"
              style={styles.getStartedBtn}
              textStyle={styles.getStartedText}
            />
            <Button
              title="I already have an account"
              onPress={() => navigation.navigate('Login')}
              variant="ghost"
              size="lg"
              textStyle={styles.loginBtnText}
            />
            <Button
              title="Court Admin Login"
              onPress={() => navigation.navigate('CourtAdminLogin')}
              variant="ghost"
              size="sm"
              textStyle={styles.loginBtnText}
            />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  circle1: { width: 300, height: 300, top: -80, right: -80 },
  circle2: { width: 200, height: 200, top: height * 0.3, left: -60 },
  circle3: { width: 150, height: 150, bottom: 80, right: -40 },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xxl,
    paddingTop: height * 0.1,
    paddingBottom: SPACING.xxxl,
  },
  logoSection: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: SPACING.lg,
  },
  logoBg: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.xxl,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    fontSize: 40,
  },
  appName: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FONT_SIZE.lg,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.xs,
    letterSpacing: 1,
  },
  features: {
    gap: SPACING.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: {
    fontSize: 22,
  },
  featureText: {
    marginLeft: SPACING.lg,
    flex: 1,
  },
  featureTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  featureDesc: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  buttons: {
    gap: SPACING.md,
  },
  getStartedBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: BORDER_RADIUS.xl,
    height: 56,
  },
  getStartedText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.text,
  },
  loginBtnText: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
});
