import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TicketsProvider } from '../context/TicketsContext';
import { AppSettingsProvider } from '../context/AppSettingsContext';
import { PortfolioProvider } from '../context/PortfolioContext';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import CompleteProfileScreen from '../screens/auth/CompleteProfileScreen';
import PendingApprovalScreen from '../screens/auth/PendingApprovalScreen';
import LandlordDashboard from '../screens/landlord/LandlordDashboard';
import ManagerDashboard from '../screens/manager/ManagerDashboard';
import CaretakerDashboard from '../screens/caretaker/CaretakerDashboard';
import MaintenanceScreen from '../screens/shared/MaintenanceScreen';
import TicketDetailScreen from '../screens/shared/TicketDetailScreen';
import LogIssueScreen from '../screens/shared/LogIssueScreen';
import BillGeneratorScreen from '../screens/landlord/BillGeneratorScreen';
import PortfolioScreen from '../screens/shared/PortfolioScreen';
import UnitRosterScreen from '../screens/shared/UnitRosterScreen';
import MoveOutInspectionScreen from '../screens/shared/MoveOutInspectionScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import QuotationScreen from '../screens/shared/QuotationScreen';
import QuotationCreateScreen from '../screens/shared/QuotationCreateScreen';
import QuotationDetailScreen from '../screens/shared/QuotationDetailScreen';
import StaffManagementScreen from '../screens/landlord/StaffManagementScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_STYLE = { backgroundColor: colors.surface, borderTopColor: colors.borderStrong, borderTopWidth: 1.5, height: 58, paddingBottom: 8, paddingTop: 6 };
const LABEL_STYLE = { fontSize: 10, fontWeight: '600' };

function tabIcon(name, focused, activeColor) {
  return <MaterialIcons name={name} size={22} color={focused ? activeColor : colors.textMuted} />;
}

function LandlordTabs() {
  const c = colors.primaryMid;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: TAB_STYLE, tabBarActiveTintColor: c, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: LABEL_STYLE }}>
      <Tab.Screen name="Dashboard" component={LandlordDashboard} options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ focused }) => tabIcon('dashboard', focused, c) }} />
      <Tab.Screen name="Maintenance" component={MaintenanceScreen} options={{ tabBarLabel: 'Repairs', tabBarIcon: ({ focused }) => tabIcon('handyman', focused, c) }} />
      <Tab.Screen name="Bills" component={BillGeneratorScreen} options={{ tabBarLabel: 'Bills', tabBarIcon: ({ focused }) => tabIcon('receipt-long', focused, c) }} />
      <Tab.Screen name="Quotations" component={QuotationScreen} options={{ tabBarLabel: 'Quotes', tabBarIcon: ({ focused }) => tabIcon('request-quote', focused, c) }} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ tabBarLabel: 'Portfolio', tabBarIcon: ({ focused }) => tabIcon('apartment', focused, c) }} />
    </Tab.Navigator>
  );
}

function ManagerTabs() {
  const c = colors.purpleMid;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: TAB_STYLE, tabBarActiveTintColor: c, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: LABEL_STYLE }}>
      <Tab.Screen name="Dashboard" component={ManagerDashboard} options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ focused }) => tabIcon('dashboard', focused, c) }} />
      <Tab.Screen name="Maintenance" component={MaintenanceScreen} options={{ tabBarLabel: 'Repairs', tabBarIcon: ({ focused }) => tabIcon('handyman', focused, c) }} />
      <Tab.Screen name="Bills" component={BillGeneratorScreen} options={{ tabBarLabel: 'Bills', tabBarIcon: ({ focused }) => tabIcon('receipt-long', focused, c) }} />
      <Tab.Screen name="Quotations" component={QuotationScreen} options={{ tabBarLabel: 'Quotes', tabBarIcon: ({ focused }) => tabIcon('request-quote', focused, c) }} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ tabBarLabel: 'Portfolio', tabBarIcon: ({ focused }) => tabIcon('apartment', focused, c) }} />
    </Tab.Navigator>
  );
}

function CaretakerTabs() {
  const c = colors.successMid;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: TAB_STYLE, tabBarActiveTintColor: c, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: LABEL_STYLE }}>
      <Tab.Screen name="Dashboard" component={CaretakerDashboard} options={{ tabBarLabel: 'My Site', tabBarIcon: ({ focused }) => tabIcon('dashboard', focused, c) }} />
      <Tab.Screen name="Maintenance" component={MaintenanceScreen} options={{ tabBarLabel: 'Repairs', tabBarIcon: ({ focused }) => tabIcon('handyman', focused, c) }} />
      <Tab.Screen name="Bills" component={BillGeneratorScreen} options={{ tabBarLabel: 'Meters', tabBarIcon: ({ focused }) => tabIcon('water-drop', focused, c) }} />
      <Tab.Screen name="Quotations" component={QuotationScreen} options={{ tabBarLabel: 'Quotes', tabBarIcon: ({ focused }) => tabIcon('request-quote', focused, c) }} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ tabBarLabel: 'Properties', tabBarIcon: ({ focused }) => tabIcon('apartment', focused, c) }} />
    </Tab.Navigator>
  );
}

function RoleRouter({ navigation }) {
  const { userProfile } = useAuth();
  React.useEffect(() => {
    const dest = { landlord: 'LandlordTabs', manager: 'ManagerTabs', caretaker: 'CaretakerTabs' }[userProfile?.role] || 'LandlordTabs';
    navigation.replace(dest);
  }, []);
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}

export default function AppNavigator() {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primaryMid} />
      </View>
    );
  }

  return (
    <AppSettingsProvider>
    <PortfolioProvider>
    <TicketsProvider>
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Not signed in
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : !userProfile ? (
          // Signed in (e.g. via Google) but no Firestore profile yet
          <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
        ) : userProfile.active === false ? (
          // Signed in, profile exists, but account not yet approved
          <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
        ) : (
          // Fully active account — route by role
          <>
            <Stack.Screen name="RoleRouter" component={RoleRouter} />
            <Stack.Screen name="LandlordTabs" component={LandlordTabs} />
            <Stack.Screen name="ManagerTabs" component={ManagerTabs} />
            <Stack.Screen name="CaretakerTabs" component={CaretakerTabs} />
            <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
            <Stack.Screen name="LogIssue" component={LogIssueScreen} />
            <Stack.Screen name="UnitRoster" component={UnitRosterScreen} />
            <Stack.Screen name="MoveOutInspection" component={MoveOutInspectionScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="QuotationCreate" component={QuotationCreateScreen} />
            <Stack.Screen name="QuotationDetail" component={QuotationDetailScreen} />
            <Stack.Screen name="StaffManagement" component={StaffManagementScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </TicketsProvider>
    </PortfolioProvider>
    </AppSettingsProvider>
  );
}
