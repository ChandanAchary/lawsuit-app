import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE } from '../constants';
import { UserRole } from '../types';
import { useAuthStore } from '../stores/authStore';

// Auth screens
import { LandingScreen } from '../screens/auth/LandingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { OtpVerifyScreen } from '../screens/auth/OtpVerifyScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { AdminLoginScreen } from '../screens/auth/AdminLoginScreen';

// Client screens
import { HomeScreen } from '../screens/client/HomeScreen';
import { SearchScreen } from '../screens/client/SearchScreen';
import { LawyerDetailScreen } from '../screens/client/LawyerDetailScreen';
import { AppointmentsScreen } from '../screens/client/AppointmentsScreen';
import { WalletScreen } from '../screens/client/WalletScreen';
import { CasesScreen } from '../screens/client/CasesScreen';
import { CaseDetailScreen } from '../screens/client/CaseDetailScreen';
import { ProfileScreen } from '../screens/client/ProfileScreen';
import { EditProfileScreen } from '../screens/client/EditProfileScreen';
import { AiChatScreen } from '../screens/client/AiChatScreen';
import { LexRatesScreen } from '../screens/client/LexRatesScreen';

// Lawyer screens
import { LawyerDashboardScreen } from '../screens/lawyer/LawyerDashboardScreen';
import { LawyerAppointmentsScreen } from '../screens/lawyer/LawyerAppointmentsScreen';
import { LawyerCasesScreen } from '../screens/lawyer/LawyerCasesScreen';
import { LawyerCaseDetailScreen } from '../screens/lawyer/LawyerCaseDetailScreen';
import { LawyerProfileScreen } from '../screens/lawyer/LawyerProfileScreen';
import { EditLawyerProfileScreen } from '../screens/lawyer/EditLawyerProfileScreen';
import { LawyerTemplatesScreen } from '../screens/lawyer/LawyerTemplatesScreen';
import { ProSubscriptionScreen } from '../screens/lawyer/ProSubscriptionScreen';

// Admin screens
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';

// Shared screens
import { ChatScreen } from '../screens/shared/ChatScreen';
import { ChatListScreen } from '../screens/shared/ChatListScreen';
import { NotificationsScreen } from '../components/NotificationsScreen';
import { ReferralScreen } from '../screens/shared/ReferralScreen';
import { BankAccountsScreen } from '../screens/shared/BankAccountsScreen';
import { AboutScreen } from '../screens/shared/AboutScreen';
import { HelpCenterScreen } from '../screens/shared/HelpCenterScreen';
import { PrivacyTermsScreen } from '../screens/shared/PrivacyTermsScreen';
import { AvailabilityScreen } from '../screens/lawyer/AvailabilityScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Auth Stack ─────────────────────────────────────────
export const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <Stack.Screen name="Landing" component={LandingScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
  </Stack.Navigator>
);

// ─── Client Tab Navigator ───────────────────────────────
const ClientTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarLabelStyle: { fontSize: FONT_SIZE.xs - 1, fontWeight: '600' },
      tabBarStyle: {
        backgroundColor: COLORS.white,
        borderTopWidth: 0,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        height: 64,
        paddingBottom: 8,
        paddingTop: 6,
      },
      tabBarIcon: ({ focused, color }) => {
        const icons: Record<string, string> = {
          Home: focused ? 'home' : 'home-outline',
          Search: focused ? 'search' : 'search-outline',
          Appointments: focused ? 'calendar' : 'calendar-outline',
          Cases: focused ? 'briefcase' : 'briefcase-outline',
          Profile: focused ? 'person' : 'person-outline',
        };
        return <Ionicons name={icons[route.name] as any} size={22} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Search" component={SearchScreen} />
    <Tab.Screen name="Appointments" component={AppointmentsScreen} />
    <Tab.Screen name="Cases" component={CasesScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// ─── Lawyer Tab Navigator ───────────────────────────────
const LawyerTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarLabelStyle: { fontSize: FONT_SIZE.xs - 1, fontWeight: '600' },
      tabBarStyle: {
        backgroundColor: COLORS.white,
        borderTopWidth: 0,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        height: 64,
        paddingBottom: 8,
        paddingTop: 6,
      },
      tabBarIcon: ({ focused, color }) => {
        const icons: Record<string, string> = {
          Dashboard: focused ? 'grid' : 'grid-outline',
          LawyerAppointments: focused ? 'calendar' : 'calendar-outline',
          LawyerCases: focused ? 'briefcase' : 'briefcase-outline',
          LawyerChats: focused ? 'chatbubbles' : 'chatbubbles-outline',
          LawyerProfile: focused ? 'person' : 'person-outline',
        };
        return <Ionicons name={icons[route.name] as any} size={22} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Dashboard" component={LawyerDashboardScreen} />
    <Tab.Screen name="LawyerAppointments" component={LawyerAppointmentsScreen} options={{ title: 'Appointments' }} />
    <Tab.Screen name="LawyerCases" component={LawyerCasesScreen} options={{ title: 'Cases' }} />
    <Tab.Screen name="LawyerChats" component={ChatListScreen} options={{ title: 'Chats' }} />
    <Tab.Screen name="LawyerProfile" component={LawyerProfileScreen} options={{ title: 'Profile' }} />
  </Tab.Navigator>
);

// ─── Admin Tab Navigator ────────────────────────────────
const AdminTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarLabelStyle: { fontSize: FONT_SIZE.xs - 1, fontWeight: '600' },
      tabBarStyle: {
        backgroundColor: COLORS.white,
        borderTopWidth: 0,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        height: 64,
        paddingBottom: 8,
        paddingTop: 6,
      },
      tabBarIcon: ({ focused, color }) => {
        const icons: Record<string, string> = {
          AdminDashboard: focused ? 'shield-checkmark' : 'shield-checkmark-outline',
          AdminUsers: focused ? 'people' : 'people-outline',
        };
        return <Ionicons name={icons[route.name] as any} size={22} color={color} />;
      },
    })}
  >
    <Tab.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Dashboard' }} />
    <Tab.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Users' }} />
  </Tab.Navigator>
);

// ─── Role-based Main Navigator ──────────────────────────
const getRoleTabs = (role: UserRole) => {
  switch (role) {
    case UserRole.LAWYER: return LawyerTabs;
    case UserRole.ADMIN: return AdminTabs;
    default: return ClientTabs;
  }
};

export const MainStack = () => {
  const role = useAuthStore((s) => s.user?.role) || UserRole.CLIENT;
  const RoleTabs = getRoleTabs(role);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MainTabs" component={RoleTabs} />
      {/* Shared screens accessible to all roles */}
      <Stack.Screen name="LawyerDetail" component={LawyerDetailScreen} />
      <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
      <Stack.Screen name="LawyerCaseDetail" component={LawyerCaseDetailScreen} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="AiChat" component={AiChatScreen} />
      <Stack.Screen name="LexRates" component={LexRatesScreen} />
      <Stack.Screen name="ReferralProgram" component={ReferralScreen} />
      <Stack.Screen name="BankAccounts" component={BankAccountsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="EditLawyerProfile" component={EditLawyerProfileScreen} />
      <Stack.Screen name="LawyerTemplates" component={LawyerTemplatesScreen} />
      <Stack.Screen name="ProSubscription" component={ProSubscriptionScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <Stack.Screen name="PrivacyTerms" component={PrivacyTermsScreen} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} />
    </Stack.Navigator>
  );
};
