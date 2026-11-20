import './src/tasks/geofence'; // registers the background geofence task at startup
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { HomeProvider } from './src/context/HomeContext';
import ForegroundGeofence from './src/components/ForegroundGeofence';
import Navigation from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <HomeProvider>
          <StatusBar style="dark" />
          <ForegroundGeofence />
          <Navigation />
        </HomeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
