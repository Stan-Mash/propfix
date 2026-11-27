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
import LandlordDashboardV2 from '../screens/landlord/LandlordDashboardV2';
import { useAppSettings } from '../context/AppSettingsContext';
import ManagerDashboard from '../screens/manager/ManagerDashboard';
import CaretakerDashboard from '../screens/caretaker/CaretakerDashboard';
import MaintenanceScreen from '../screens/shared/MaintenanceScreen';
import TicketDetailScreen from '../screens/shared/TicketDetailScreen';
import LogIssueScreen from '../screens/shared/LogIssueScreen';
import BillGeneratorScreen from '../screens/landlord/BillGeneratorScreen';
import StatementScreen from '../screens/landlord/StatementScreen';
import ContractorDashboard from '../screens/contractor/ContractorDashboard';
import PortfolioScreen from '../screens/shared/PortfolioScreen';
import UnitRosterScreen from '../screens/shared/UnitRosterScreen';
import MoveOutInspectionScreen from '../screens/shared/MoveOutInspectionScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import QuotationScreen from '../screens/shared/QuotationScreen';
import QuotationCreateScreen from '../screens/shared/QuotationCreateScreen';
import QuotationDetailScreen from '../screens/shared/QuotationDetailScreen';
import StaffManagementScreen from '../screens/landlord/StaffManagementScreen';
import AddPropertyWizard from '../screens/landlord/AddPropertyWizard';
import LandlordAllComplaints from '../screens/landlord/LandlordAllComplaints';
import LandlordComplaintDetail from '../screens/landlord/LandlordComplaintDetail';
import ManagerAllComplaints from '../screens/manager/ManagerAllComplaints';
import ManagerComplaintDetail from '../screens/manager/ManagerComplaintDetail';
import ContractorComplaintDetail from '../screens/contractor/ContractorComplaintDetail';
import ComplaintDetail from '../screens/shared/ComplaintDetail';
import FileComplaintScreen from '../screens/caretaker/FileComplaintScreen';
import MyComplaintsScreen from '../screens/caretaker/MyComplaintsScreen';
import EditComplaintScreen from '../screens/caretaker/EditComplaintScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab bar: flat top border, no overflow ripple bleed on Android
const TAB_STYLE = {
  backgroundColor: colors.surface,
  borderTopColor: colors.border,
  borderTopWidth: 1,
  height: 60,
  paddingBottom: 8,
  paddingTop: 6,
  elevation: 0, // prevent ripple bleed
};
const LABEL_STYLE = { fontSize: 10, fontWeight: '700' };

function tabIcon(name, focused, activeColor) {
  return <MaterialIcons name={name} size={22} color={focused ? activeColor : colors.textMuted} />;
}

function LandlordTabs() {
  const c = colors.primaryMid;
  const { settings } = useAppSettings();
  const DashComp = settings.designVersion === 'v2' ? LandlordDashboardV2 : LandlordDashboard;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: TAB_STYLE, tabBarActiveTintColor: c, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: LABEL_STYLE }}>
      <Tab.Screen name="Dashboard" component={DashComp} options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => tabIcon('home', focused, c) }} />
      <Tab.Screen name="Maintenance" component={MaintenanceScreen} options={{ tabBarLabel: 'Repairs', tabBarIcon: ({ focused }) => tabIcon('handyman', focused, c) }} />
      <Tab.Screen name="Bills" component={StatementScreen} options={{ tabBarLabel: 'Statements', tabBarIcon: ({ focused }) => tabIcon('description', focused, c) }} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ tabBarLabel: 'Properties', tabBarIcon: ({ focused }) => tabIcon('apartment', focused, c) }} />
    </Tab.Navigator>
  );
}

function ManagerTabs() {
  const c = colors.primaryMid;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: TAB_STYLE, tabBarActiveTintColor: c, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: LABEL_STYLE }}>
      <Tab.Screen name="Dashboard" component={ManagerDashboard} options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => tabIcon('home', focused, c) }} />
      <Tab.Screen name="Maintenance" component={MaintenanceScreen} options={{ tabBarLabel: 'Repairs', tabBarIcon: ({ focused }) => tabIcon('handyman', focused, c) }} />
      <Tab.Screen name="Bills" component={StatementScreen} options={{ tabBarLabel: 'Statements', tabBarIcon: ({ focused }) => tabIcon('description', focused, c) }} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ tabBarLabel: 'Properties', tabBarIcon: ({ focused }) => tabIcon('apartment', focused, c) }} />
    </Tab.Navigator>
  );
}

function ContractorTabs() {
  const c = colors.primaryMid;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: TAB_STYLE, tabBarActiveTintColor: c, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: LABEL_STYLE }}>
      <Tab.Screen name="Dashboard" component={ContractorDashboard} options={{ tabBarLabel: 'Jobs', tabBarIcon: ({ focused }) => tabIcon('build', focused, c) }} />
      <Tab.Screen name="Maintenance" component={MaintenanceScreen} options={{ tabBarLabel: 'All Repairs', tabBarIcon: ({ focused }) => tabIcon('handyman', focused, c) }} />
    </Tab.Navigator>
  );
}

function CaretakerTabs() {
  const c = colors.primaryMid;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: TAB_STYLE, tabBarActiveTintColor: c, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: LABEL_STYLE }}>
      <Tab.Screen name="Dashboard" component={CaretakerDashboard} options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => tabIcon('home', focused, c) }} />
      <Tab.Screen name="Maintenance" component={MaintenanceScreen} options={{ tabBarLabel: 'Repairs', tabBarIcon: ({ focused }) => tabIcon('handyman', focused, c) }} />
      <Tab.Screen name="Complaints" component={MyComplaintsScreen} options={{ tabBarLabel: 'Complaints', tabBarIcon: ({ focused }) => tabIcon('report-problem', focused, c) }} />
      <Tab.Screen name="Bills" component={BillGeneratorScreen} options={{ tabBarLabel: 'Meters', tabBarIcon: ({ focused }) => tabIcon('water-drop', focused, c) }} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ tabBarLabel: 'Properties', tabBarIcon: ({ focused }) => tabIcon('apartment', focused, c) }} />
    </Tab.Navigator>
  );
}

function RoleRouter({ navigation }) {
  const { userProfile } = useAuth();
  React.useEffect(() => {
    const dest = { landlord: 'LandlordTabs', manager: 'ManagerTabs', caretaker: 'CaretakerTabs', contractor: 'ContractorTabs' }[userProfile?.role] || 'LandlordTabs';
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
            <Stack.Screen name="ContractorTabs" component={ContractorTabs} />
            <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
            <Stack.Screen name="LogIssue" component={LogIssueScreen} />
            <Stack.Screen name="UnitRoster" component={UnitRosterScreen} />
            <Stack.Screen name="MoveOutInspection" component={MoveOutInspectionScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Quotations" component={QuotationScreen} />
            <Stack.Screen name="QuotationCreate" component={QuotationCreateScreen} />
            <Stack.Screen name="QuotationDetail" component={QuotationDetailScreen} />
            <Stack.Screen name="StaffManagement" component={StaffManagementScreen} />
            <Stack.Screen name="AddProperty" component={AddPropertyWizard} />
            <Stack.Screen name="LandlordAllComplaints" component={LandlordAllComplaints} />
            <Stack.Screen name="LandlordComplaintDetail" component={LandlordComplaintDetail} />
            <Stack.Screen name="ManagerAllComplaints" component={ManagerAllComplaints} />
            <Stack.Screen name="ManagerComplaintDetail" component={ManagerComplaintDetail} />
            <Stack.Screen name="ContractorComplaintDetail" component={ContractorComplaintDetail} />
            <Stack.Screen name="ComplaintDetail" component={ComplaintDetail} />
            <Stack.Screen name="FileComplaint" component={FileComplaintScreen} />
            <Stack.Screen name="MyComplaints" component={MyComplaintsScreen} />
            <Stack.Screen name="EditComplaint" component={EditComplaintScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </TicketsProvider>
    </PortfolioProvider>
    </AppSettingsProvider>
  );
}
