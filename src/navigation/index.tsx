import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ComponentType } from 'react';
import { Platform, View, Pressable, Text, Keyboard } from 'react-native';
import { FONT_SIZE } from '../constants';
import { UserRole } from '../types';
import { useAuthStore } from '../stores/authStore';
import { useColors, useThemeStore } from '../stores/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { AdminPlatformScreen } from '../screens/admin/AdminPlatformScreen';
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
import { AdminPerformanceLogScreen } from '../screens/admin/AdminPerformanceLogScreen';
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
import { OrgLawyerSalaryScreen } from '../screens/organization/OrgLawyerSalaryScreen';
import { OrgRequestsScreen } from '../screens/organization/OrgRequestsScreen';
import { OrgRequestDetailScreen } from '../screens/organization/OrgRequestDetailScreen';
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
import { CalendarScreen } from '../screens/shared/CalendarScreen';
import { DocumentPreviewScreen } from '../screens/shared/DocumentPreviewScreen';
import { LegalUpdatesScreen } from '../screens/shared/LegalUpdatesScreen';
import { ReportIssueScreen } from '../screens/shared/ReportIssueScreen';
import { EkycStatusScreen } from '../screens/client/EkycStatusScreen';
import { EkycAadhaarScreen } from '../screens/client/EkycAadhaarScreen';
import { SignDocumentScreen } from '../screens/shared/SignDocumentScreen';

const Stack = createNativeStackNavigator();
// MaterialTopTabs is backed by react-native-pager-view, giving native, UI-thread
// driven horizontal swiping at 60fps. We position it at the bottom and supply a
// custom floating tab bar so the look matches the previous bottom-tab design.
const TopTab = createMaterialTopTabNavigator();

const getFloatingTabBarStyle = (isDark: boolean, bottomInset = 0) => ({
  position: 'absolute' as const,
  left: 14,
  right: 14,
  // Lift above the device's bottom safe area (3-button nav / gesture / iOS home
  // indicator) so the floating bar never collides with the system nav.
  bottom: 10 + bottomInset,
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

// ─── Swipeable role tabs ────────────────────────────────
// One reusable factory drives every role's tab bar so swipe behaviour + the
// floating-pill look stay identical across Client / Lawyer / Admin / Court /
// Organization. Tap AND horizontal swipe both move between tabs, kept in sync
// by the shared navigation state.
type TabItem = {
  name: string;
  component: ComponentType<any>;
  label: string;
  icon: (focused: boolean) => string;
};

// Custom floating tab bar — reads the MaterialTopTab navigation state so it
// updates the moment a swipe settles, and emits the same `tabPress` event a
// normal tab bar would (so screens relying on it keep working).
const FloatingTabBar = ({
  state,
  navigation,
  items,
}: {
  state: any;
  navigation: any;
  items: TabItem[];
}) => {
  const C = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  const insets = useSafeAreaInsets();

  // Mirror the old bottom-tab `tabBarHideOnKeyboard` so the floating bar doesn't
  // sit on top of the keyboard while typing in a tab screen.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow';
    const hideEvt = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide';
    const show = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboardVisible) return null;

  return (
    <View
      style={[
        getFloatingTabBarStyle(isDark, insets.bottom),
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const item = items.find((t) => t.name === route.name);
        if (!item) return null;
        const focused = state.index === index;
        const color = focused ? C.primary : isDark ? 'rgba(210,217,230,0.88)' : C.textMuted;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={onPress}
            android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 22,
              marginHorizontal: 2,
              paddingVertical: 4,
            }}
          >
            <Ionicons name={item.icon(focused) as any} size={22} color={color} />
            <Text
              numberOfLines={1}
              style={{ color, fontSize: FONT_SIZE.xs - 1, fontWeight: '700', marginTop: 2 }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const makeSwipeableTabs = (items: TabItem[]) => {
  const SwipeableTabs = () => (
    <TopTab.Navigator
      tabBarPosition="bottom"
      tabBar={(props) => <FloatingTabBar {...(props as any)} items={items} />}
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        // Render the focused tab + its immediate neighbour so a swipe reveals a
        // ready screen (smooth) without eagerly mounting every tab on launch.
        lazy: true,
        lazyPreloadDistance: 1,
      }}
    >
      {items.map((it) => (
        <TopTab.Screen key={it.name} name={it.name} component={it.component} />
      ))}
    </TopTab.Navigator>
  );
  return SwipeableTabs;
};

// ─── Per-role tab configs ───────────────────────────────
const CLIENT_TABS: TabItem[] = [
  { name: 'Home', component: HomeScreen, label: 'Home', icon: (f) => (f ? 'home' : 'home-outline') },
  { name: 'Search', component: SearchScreen, label: 'Search', icon: (f) => (f ? 'search' : 'search-outline') },
  { name: 'Appointments', component: AppointmentsScreen, label: 'Appointments', icon: (f) => (f ? 'calendar' : 'calendar-outline') },
  { name: 'Cases', component: CasesScreen, label: 'Cases', icon: (f) => (f ? 'briefcase' : 'briefcase-outline') },
  { name: 'Chats', component: ChatListScreen, label: 'Chats', icon: (f) => (f ? 'chatbubbles' : 'chatbubbles-outline') },
  { name: 'Profile', component: ProfileScreen, label: 'Profile', icon: (f) => (f ? 'person' : 'person-outline') },
];

const LAWYER_TABS: TabItem[] = [
  { name: 'Dashboard', component: LawyerDashboardScreen, label: 'Dashboard', icon: (f) => (f ? 'grid' : 'grid-outline') },
  { name: 'LawyerAppointments', component: LawyerAppointmentsScreen, label: 'Appointments', icon: (f) => (f ? 'calendar' : 'calendar-outline') },
  { name: 'LawyerCases', component: LawyerCasesScreen, label: 'Cases', icon: (f) => (f ? 'briefcase' : 'briefcase-outline') },
  { name: 'LawyerChats', component: ChatListScreen, label: 'Chats', icon: (f) => (f ? 'chatbubbles' : 'chatbubbles-outline') },
  { name: 'LawyerProfile', component: LawyerProfileScreen, label: 'Profile', icon: (f) => (f ? 'person' : 'person-outline') },
];

const ADMIN_TABS: TabItem[] = [
  { name: 'AdminDashboard', component: AdminDashboardScreen, label: 'Dashboard', icon: (f) => (f ? 'shield-checkmark' : 'shield-checkmark-outline') },
  { name: 'AdminUsers', component: AdminUsersScreen, label: 'Users', icon: (f) => (f ? 'people' : 'people-outline') },
  { name: 'AdminOperations', component: AdminOperationsScreen, label: 'Operations', icon: (f) => (f ? 'cash' : 'cash-outline') },
  { name: 'AdminPlatform', component: AdminPlatformScreen, label: 'Platform', icon: (f) => (f ? 'grid' : 'grid-outline') },
];

const COURT_ADMIN_TABS: TabItem[] = [
  { name: 'CourtAdminDashboard', component: CourtAdminDashboardScreen, label: 'Dashboard', icon: (f) => (f ? 'shield-checkmark' : 'shield-checkmark-outline') },
  { name: 'LawyerVerification', component: LawyerVerificationScreen, label: 'Lawyers', icon: (f) => (f ? 'checkmark-done-circle' : 'checkmark-done-circle-outline') },
  { name: 'OrgVerification', component: OrgVerificationScreen, label: 'Orgs', icon: (f) => (f ? 'business' : 'business-outline') },
  { name: 'CourtAdminProfile', component: CourtAdminProfileScreen, label: 'Profile', icon: (f) => (f ? 'person' : 'person-outline') },
];

const ORG_TABS: TabItem[] = [
  { name: 'OrgDashboard', component: OrgDashboardScreen, label: 'Dashboard', icon: (f) => (f ? 'grid' : 'grid-outline') },
  { name: 'OrgRequests', component: OrgRequestsScreen, label: 'Requests', icon: (f) => (f ? 'calendar' : 'calendar-outline') },
  { name: 'OrgLawyers', component: OrgLawyersScreen, label: 'Lawyers', icon: (f) => (f ? 'people' : 'people-outline') },
  { name: 'OrgProfile', component: OrgProfileScreen, label: 'Profile', icon: (f) => (f ? 'person' : 'person-outline') },
];

const ClientTabs = makeSwipeableTabs(CLIENT_TABS);
const LawyerTabs = makeSwipeableTabs(LAWYER_TABS);
const AdminTabs = makeSwipeableTabs(ADMIN_TABS);
const CourtAdminTabs = makeSwipeableTabs(COURT_ADMIN_TABS);
const OrgTabs = makeSwipeableTabs(ORG_TABS);

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
      {/* AdminProfile dropped from the AdminTabs bottom bar — keep it as a
          Stack screen so the dashboard's top-right profile button can
          push to it. */}
      <Stack.Screen name="AdminProfile" component={AdminProfileScreen} />
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
      {/* Calendar — month view of appointments / org requests (all roles) */}
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      {/* Universal document viewer (image / pdf / other) */}
      <Stack.Screen name="DocumentPreview" component={DocumentPreviewScreen as ComponentType<any>} />
      {/* Payment History */}
      <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
      <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
      <Stack.Screen name="DocumentAi" component={DocumentAiScreen} />
      <Stack.Screen name="LegalUpdates" component={LegalUpdatesScreen} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
      {/* OTP-based document signing (reached from a SIGNATURE_REQUESTED
          notification or a "Sign" CTA with { signatureRequestId }). */}
      <Stack.Screen name="SignDocument" component={SignDocumentScreen} />
      {/* eKYC (Aadhaar identity verification — CLIENT only) */}
      <Stack.Screen name="EkycStatus" component={EkycStatusScreen} />
      <Stack.Screen name="EkycAadhaar" component={EkycAadhaarScreen} />
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
      <Stack.Screen name="AdminPerformanceLog" component={AdminPerformanceLogScreen as any} />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
      <Stack.Screen name="AdminLegalUpdates" component={AdminLegalUpdatesScreen} />
      <Stack.Screen name="AdminAnnouncements" component={AdminAnnouncementsScreen} />
      {/* Court Admin screens (also accessible from stack) */}
      <Stack.Screen name="LawyerVerification" component={LawyerVerificationScreen} />
      <Stack.Screen name="OrgVerification" component={OrgVerificationScreen} />
      {/* Organization screens */}
      <Stack.Screen name="OrgDashboard" component={OrgDashboardScreen} />
      <Stack.Screen name="OrgRequests" component={OrgRequestsScreen} />
      <Stack.Screen name="OrgRequestDetail" component={OrgRequestDetailScreen as any} />
      <Stack.Screen name="OrgLawyers" component={OrgLawyersScreen} />
      <Stack.Screen name="OrgLawyerSalary" component={OrgLawyerSalaryScreen as any} />
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
