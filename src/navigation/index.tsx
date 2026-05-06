import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ComponentType } from 'react';
import { Platform } from 'react-native';
import { FONT_SIZE } from '../constants';
import { UserRole } from '../types';
import { useAuthStore } from '../stores/authStore';
import { useColors, useThemeStore } from '../stores/themeStore';

// Auth screens
import { LandingScreen } from '../screens/auth/LandingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { OtpVerifyScreen } from '../screens/auth/OtpVerifyScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { AdminLoginScreen } from '../screens/auth/AdminLoginScreen';
import { CourtAdminRegisterScreen } from '../screens/auth/CourtAdminRegisterScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';

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
import { LawyerClientDetailScreen } from '../screens/lawyer/LawyerClientDetailScreen';
import { LawyerVerificationRequestScreen } from '../screens/lawyer/LawyerVerificationRequestScreen';

// Admin screens
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { CourtManagementScreen } from '../screens/admin/CourtManagementScreen';
import { CourtAdminManagementScreen } from '../screens/admin/CourtAdminManagementScreen';
import { AdminTeamScreen } from '../screens/admin/AdminTeamScreen';
import { AdminPayoutsScreen } from '../screens/admin/AdminPayoutsScreen';
import { AdminProfileScreen } from '../screens/admin/AdminProfileScreen';
import { EditAdminProfileScreen } from '../screens/admin/EditAdminProfileScreen';
import { SuperAdminCourtAdminApprovalsScreen } from '../screens/admin/SuperAdminCourtAdminApprovalsScreen';
// SuperAdminUserControlScreen and SuperAdminKycOverrideScreen were retired
// in Phase 3 — their actions now live on AdminUserDetailScreen so the
// People tab is a single drill-down flow instead of three parallel screens.
import { SuperAdminPlatformConfigScreen } from '../screens/admin/SuperAdminPlatformConfigScreen';
import { SuperAdminAuditLogScreen } from '../screens/admin/SuperAdminAuditLogScreen';
import { SuperAdminEntitySalaryScreen } from '../screens/admin/SuperAdminEntitySalaryScreen';
import { SuperAdminEntitySalaryCycleScreen } from '../screens/admin/SuperAdminEntitySalaryCycleScreen';
import { SuperAdminCourtAdminOpsScreen } from '../screens/admin/SuperAdminCourtAdminOpsScreen';
import { AdminUserDetailScreen } from '../screens/admin/AdminUserDetailScreen';
import { AdminReportsScreen } from '../screens/admin/AdminReportsScreen';
import { AdminLegalUpdatesScreen } from '../screens/admin/AdminLegalUpdatesScreen';
import { AdminAnnouncementsScreen } from '../screens/admin/AdminAnnouncementsScreen';
import { AdminOperationsScreen } from '../screens/admin/AdminOperationsScreen';

// Court Admin screens
import { CourtAdminDashboardScreen } from '../screens/courtAdmin/CourtAdminDashboardScreen';
import { LawyerVerificationScreen } from '../screens/courtAdmin/LawyerVerificationScreen';
import { CourtAdminProfileScreen } from '../screens/courtAdmin/CourtAdminProfileScreen';
import { EditCourtAdminProfileScreen } from '../screens/courtAdmin/EditCourtAdminProfileScreen';
import { OrgVerificationScreen } from '../screens/courtAdmin/OrgVerificationScreen';

// Organization screens
import { OrgDashboardScreen } from '../screens/organization/OrgDashboardScreen';
import { OrgProfileScreen } from '../screens/organization/OrgProfileScreen';
import { OrgLawyersScreen } from '../screens/organization/OrgLawyersScreen';
import { OrgRequestsScreen } from '../screens/organization/OrgRequestsScreen';
import { EditOrgProfileScreen } from '../screens/organization/EditOrgProfileScreen';
import { OrgVerificationRequestScreen } from '../screens/organization/OrgVerificationRequestScreen';

// Client Organization screens
import { OrgListScreen } from '../screens/client/OrgListScreen';
import { OrgDetailScreen } from '../screens/client/OrgDetailScreen';
import { OrgBookingScreen } from '../screens/client/OrgBookingScreen';
import { ClientOrgRequestsScreen } from '../screens/client/ClientOrgRequestsScreen';

// Shared screens
import { ChatScreen } from '../screens/shared/ChatScreen';
import { ChatListScreen } from '../screens/shared/ChatListScreen';
import { NotificationsScreen } from '../components/NotificationsScreen';
import { ReferralScreen } from '../screens/shared/ReferralScreen';
import { BankAccountsScreen } from '../screens/shared/BankAccountsScreen';
import { MySalaryScreen } from '../screens/shared/MySalaryScreen';
import { AboutScreen } from '../screens/shared/AboutScreen';
import { HelpCenterScreen } from '../screens/shared/HelpCenterScreen';
import { PrivacyTermsScreen } from '../screens/shared/PrivacyTermsScreen';
import { AvailabilityScreen } from '../screens/lawyer/AvailabilityScreen';
import { VideoCallScreen } from '../screens/shared/VideoCallScreen';
import { SecurityScreen } from '../screens/shared/SecurityScreen';
import { AppointmentDetailScreen } from '../screens/shared/AppointmentDetailScreen';
import { TeleLawScreen } from '../screens/shared/TeleLawScreen';
import { PaymentHistoryScreen } from '../screens/shared/PaymentHistoryScreen';
import { CourtAdminLoginScreen } from '../screens/auth/CourtAdminLoginScreen';
import { MediationInviteAcceptScreen } from '../screens/auth/MediationInviteAcceptScreen';
import { MediationsListScreen } from '../screens/shared/MediationsListScreen';
import { NewMediationInviteScreen } from '../screens/shared/NewMediationInviteScreen';
import { MediationDetailScreen } from '../screens/shared/MediationDetailScreen';
import { MediationMediatorsScreen } from '../screens/shared/MediationMediatorsScreen';
import { MediationRoomScreen } from '../screens/shared/MediationRoomScreen';
import { MediatorSettingsScreen } from '../screens/lawyer/MediatorSettingsScreen';
import { CallHistoryScreen } from '../screens/shared/CallHistoryScreen';
import { DocumentAiScreen } from '../screens/shared/DocumentAiScreen';
import { LegalUpdatesScreen } from '../screens/shared/LegalUpdatesScreen';
import { ReportIssueScreen } from '../screens/shared/ReportIssueScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const getFloatingTabBarStyle = (isDark: boolean) => ({
  position: 'absolute' as const,
  left: 14,
  right: 14,
  bottom: 10 ,
  height: 72,
  borderTopWidth: 0,
  borderWidth: 0.8,
  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)',
  backgroundColor: isDark ? 'rgba(23,25,32,0.92)' : 'rgba(255,255,255,0.92)',
  borderRadius: 34,
  paddingHorizontal: 8,
  paddingBottom: 10 ,
  paddingTop: 8,
  elevation: 10,
  shadowColor: '#000',
  shadowOpacity: isDark ? 0.22 : 0.12,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
  overflow: 'hidden' as const,
});

// ─── Auth Stack ─────────────────────────────────────────
export const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <Stack.Screen name="Landing" component={LandingScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
    <Stack.Screen name="CourtAdminLogin" component={CourtAdminLoginScreen} />
    <Stack.Screen name="CourtAdminRegister" component={CourtAdminRegisterScreen} />
    <Stack.Screen name="MediationInviteAccept" component={MediationInviteAcceptScreen} />
  </Stack.Navigator>
);

// ─── Client Tab Navigator ───────────────────────────────
const ClientTabs = () => {
  const C = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  return (
    <Tab.Navigator
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: isDark ? 'rgba(210,217,230,0.88)' : C.textMuted,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarLabelStyle: { fontSize: FONT_SIZE.xs - 1, fontWeight: '700', marginTop: 0 },
        tabBarIconStyle: { marginBottom: -1 },
        tabBarItemStyle: { paddingHorizontal: 0, borderRadius: 22, marginHorizontal: 2 },
        tabBarStyle: getFloatingTabBarStyle(isDark),
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color }) => {
          const icons: Record<string, string> = {
            Home: focused ? 'home' : 'home-outline',
            Search: focused ? 'search' : 'search-outline',
            Appointments: focused ? 'calendar' : 'calendar-outline',
            Cases: focused ? 'briefcase' : 'briefcase-outline',
            Chats: focused ? 'chatbubbles' : 'chatbubbles-outline',
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
      <Tab.Screen name="Chats" component={ChatListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// ─── Lawyer Tab Navigator ───────────────────────────────
const LawyerTabs = () => {
  const C = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  return (
    <Tab.Navigator
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: isDark ? 'rgba(210,217,230,0.88)' : C.textMuted,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarLabelStyle: { fontSize: FONT_SIZE.xs - 1, fontWeight: '700', marginTop: 0 },
        tabBarIconStyle: { marginBottom: -1 },
        tabBarItemStyle: { paddingHorizontal: 0, borderRadius: 22, marginHorizontal: 2 },
        tabBarStyle: getFloatingTabBarStyle(isDark),
        tabBarHideOnKeyboard: true,
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
};

// ─── Admin Tab Navigator ────────────────────────────────
const AdminTabs = () => {
  const C = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  return (
    <Tab.Navigator
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: isDark ? 'rgba(210,217,230,0.88)' : C.textMuted,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarLabelStyle: { fontSize: FONT_SIZE.xs - 1, fontWeight: '700', marginTop: 0 },
        tabBarIconStyle: { marginBottom: -1 },
        tabBarItemStyle: { paddingHorizontal: 0, borderRadius: 22, marginHorizontal: 2 },
        tabBarStyle: getFloatingTabBarStyle(isDark),
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color }) => {
          const icons: Record<string, string> = {
            AdminDashboard: focused ? 'shield-checkmark' : 'shield-checkmark-outline',
            AdminUsers: focused ? 'people' : 'people-outline',
            AdminOperations: focused ? 'cash' : 'cash-outline',
            AdminProfile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] as any} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Users' }} />
      <Tab.Screen name="AdminOperations" component={AdminOperationsScreen} options={{ title: 'Operations' }} />
      <Tab.Screen name="AdminProfile" component={AdminProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

// ─── Court Admin Tab Navigator ──────────────────────────
const CourtAdminTabs = () => {
  const C = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  return (
    <Tab.Navigator
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: isDark ? 'rgba(210,217,230,0.88)' : C.textMuted,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarLabelStyle: { fontSize: FONT_SIZE.xs - 1, fontWeight: '700', marginTop: 0 },
        tabBarIconStyle: { marginBottom: -1 },
        tabBarItemStyle: { paddingHorizontal: 0, borderRadius: 22, marginHorizontal: 2 },
        tabBarStyle: getFloatingTabBarStyle(isDark),
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color }) => {
          const icons: Record<string, string> = {
            CourtAdminDashboard: focused ? 'shield-checkmark' : 'shield-checkmark-outline',
            LawyerVerification: focused ? 'checkmark-done-circle' : 'checkmark-done-circle-outline',
            OrgVerification: focused ? 'business' : 'business-outline',
            CourtAdminProfile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] as any} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="CourtAdminDashboard" component={CourtAdminDashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="LawyerVerification" component={LawyerVerificationScreen} options={{ title: 'Lawyers' }} />
      <Tab.Screen name="OrgVerification" component={OrgVerificationScreen} options={{ title: 'Orgs' }} />
      <Tab.Screen name="CourtAdminProfile" component={CourtAdminProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

// ─── Organization Tab Navigator ─────────────────────────
const OrgTabs = () => {
  const C = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  return (
    <Tab.Navigator
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: isDark ? 'rgba(210,217,230,0.88)' : C.textMuted,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarLabelStyle: { fontSize: FONT_SIZE.xs - 1, fontWeight: '700', marginTop: 0 },
        tabBarIconStyle: { marginBottom: -1 },
        tabBarItemStyle: { paddingHorizontal: 0, borderRadius: 22, marginHorizontal: 2 },
        tabBarStyle: getFloatingTabBarStyle(isDark),
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color }) => {
          const icons: Record<string, string> = {
            OrgDashboard: focused ? 'grid' : 'grid-outline',
            OrgRequests: focused ? 'calendar' : 'calendar-outline',
            OrgLawyers: focused ? 'people' : 'people-outline',
            OrgProfile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] as any} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="OrgDashboard" component={OrgDashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="OrgRequests" component={OrgRequestsScreen} options={{ title: 'Requests' }} />
      <Tab.Screen name="OrgLawyers" component={OrgLawyersScreen} options={{ title: 'Lawyers' }} />
      <Tab.Screen name="OrgProfile" component={OrgProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

// ─── Role-based Main Navigator ──────────────────────────
const getRoleTabs = (role: UserRole | string) => {
  switch (role) {
    case UserRole.LAWYER: return LawyerTabs;
    case UserRole.ADMIN: return AdminTabs;
    case UserRole.COURT_ADMIN: return CourtAdminTabs;
    case UserRole.ORGANIZATION: return OrgTabs;
    default: return ClientTabs;
  }
};

// Wrapper so ChangePasswordScreen can render in forced mode without nav props.
const ForcedChangePasswordScreen = () => <ChangePasswordScreen forced />;

export const MainStack = () => {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || UserRole.CLIENT;
  const RoleTabs = getRoleTabs(role);

  // Server-side mustChangePasswordGuard returns 403 on every endpoint until
  // an org-onboarded lawyer or super-admin-invited admin rotates their temp
  // password. Force the change-password screen as the only entry point.
  if (user?.mustChangePassword) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}>
        <Stack.Screen name="ForceChangePassword" component={ForcedChangePasswordScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MainTabs" component={RoleTabs} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
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
      <Stack.Screen name="MySalary" component={MySalaryScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="EditLawyerProfile" component={EditLawyerProfileScreen} />
      <Stack.Screen name="EditCourtAdminProfile" component={EditCourtAdminProfileScreen} />
      <Stack.Screen name="EditAdminProfile" component={EditAdminProfileScreen} />
      <Stack.Screen name="LawyerVerificationRequest" component={LawyerVerificationRequestScreen} />
      <Stack.Screen name="LawyerTemplates" component={LawyerTemplatesScreen} />
      <Stack.Screen name="ProSubscription" component={ProSubscriptionScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="LawyerClientDetail" component={LawyerClientDetailScreen as ComponentType<any>} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <Stack.Screen name="PrivacyTerms" component={PrivacyTermsScreen} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} />
      <Stack.Screen name="VideoCall" component={VideoCallScreen} />
      <Stack.Screen name="Security" component={SecurityScreen} />
      <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen as ComponentType<any>} />
      <Stack.Screen name="TeleLaw" component={TeleLawScreen} />
      {/* Payment History */}
      <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
      <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
      <Stack.Screen name="DocumentAi" component={DocumentAiScreen} />
      <Stack.Screen name="LegalUpdates" component={LegalUpdatesScreen} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
      {/* Admin-only screens */}
      <Stack.Screen name="CourtManagement" component={CourtManagementScreen} />
      <Stack.Screen name="CourtAdminManagement" component={CourtAdminManagementScreen} />
      <Stack.Screen name="AdminTeam" component={AdminTeamScreen} />
      <Stack.Screen name="AdminPayouts" component={AdminPayoutsScreen} />
      {/* Super-admin-only operational screens */}
      <Stack.Screen name="SuperAdminCourtAdminApprovals" component={SuperAdminCourtAdminApprovalsScreen} />
      <Stack.Screen name="SuperAdminCourtAdminOps" component={SuperAdminCourtAdminOpsScreen} />
      <Stack.Screen name="SuperAdminPlatformConfig" component={SuperAdminPlatformConfigScreen} />
      <Stack.Screen name="SuperAdminAuditLog" component={SuperAdminAuditLogScreen} />
      <Stack.Screen name="SuperAdminEntitySalary" component={SuperAdminEntitySalaryScreen as any} />
      <Stack.Screen name="SuperAdminEntitySalaryCycle" component={SuperAdminEntitySalaryCycleScreen} />
      <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen as any} />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
      <Stack.Screen name="AdminLegalUpdates" component={AdminLegalUpdatesScreen} />
      <Stack.Screen name="AdminAnnouncements" component={AdminAnnouncementsScreen} />
      {/* Court Admin screens (also accessible from stack) */}
      <Stack.Screen name="LawyerVerification" component={LawyerVerificationScreen} />
      <Stack.Screen name="OrgVerification" component={OrgVerificationScreen} />
      {/* Organization screens */}
      <Stack.Screen name="OrgDashboard" component={OrgDashboardScreen} />
      <Stack.Screen name="OrgRequests" component={OrgRequestsScreen} />
      <Stack.Screen name="OrgLawyers" component={OrgLawyersScreen} />
      <Stack.Screen name="OrgProfile" component={OrgProfileScreen} />
      <Stack.Screen name="EditOrgProfile" component={EditOrgProfileScreen} />
      <Stack.Screen name="OrgVerificationRequest" component={OrgVerificationRequestScreen} />
      {/* Client-side Organization screens */}
      <Stack.Screen name="OrgList" component={OrgListScreen} />
      <Stack.Screen name="OrgDetail" component={OrgDetailScreen as ComponentType<any>} />
      <Stack.Screen name="OrgBooking" component={OrgBookingScreen as ComponentType<any>} />
      <Stack.Screen name="ClientOrgRequests" component={ClientOrgRequestsScreen} />
      {/* Mediation screens */}
      <Stack.Screen name="Mediations" component={MediationsListScreen} />
      <Stack.Screen name="NewMediationInvite" component={NewMediationInviteScreen} />
      <Stack.Screen name="MediationDetail" component={MediationDetailScreen as ComponentType<any>} />
      <Stack.Screen name="MediationMediators" component={MediationMediatorsScreen as ComponentType<any>} />
      <Stack.Screen name="MediationRoom" component={MediationRoomScreen as ComponentType<any>} />
      <Stack.Screen name="MediatorSettings" component={MediatorSettingsScreen} />
      <Stack.Screen name="MediationInviteAccept" component={MediationInviteAcceptScreen as ComponentType<any>} />
    </Stack.Navigator>
  );
};
