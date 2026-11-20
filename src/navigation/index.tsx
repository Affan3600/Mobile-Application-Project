import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import FloorPlanScreen from '../screens/FloorPlanScreen';
import CamerasScreen from '../screens/CamerasScreen';
import GeofenceScreen from '../screens/GeofenceScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScannerScreen from '../screens/ScannerScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const TAB_ICONS: Record<string, IconName> = {
  Devices: 'view-grid',
  'Floor Plan': 'floor-plan',
  Cameras: 'cctv',
  Geofence: 'map-marker-radius',
  Settings: 'cog',
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name={TAB_ICONS[route.name]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Devices" component={DashboardScreen} />
      <Tab.Screen name="Floor Plan" component={FloorPlanScreen} />
      <Tab.Screen name="Cameras" component={CamerasScreen} />
      <Tab.Screen name="Geofence" component={GeofenceScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary } }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={Tabs} />
            <Stack.Screen name="Scanner" component={ScannerScreen} options={{ presentation: 'modal' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
