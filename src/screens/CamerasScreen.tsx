import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useHome } from '../context/HomeContext';
import { useOrientation } from '../hooks/useOrientation';
import { DEMO_VIDEOS } from '../services/demoVideos';
import { Device } from '../types';
import { colors, radius, spacing } from '../theme';

function LiveTile({ device, width }: { device: Device; width: number }) {
  const player = useVideoPlayer(DEMO_VIDEOS[device.id] ?? device.streamUrl ?? null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={{ width }}>
      <View style={styles.videoWrap}>
        <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} fullscreenOptions={{ enable: true }} />
        <View style={styles.live}>
          <View style={styles.dot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>
      <Text style={styles.name}>{device.name}</Text>
    </View>
  );
}

function OfflineTile({ device, width }: { device: Device; width: number }) {
  return (
    <View style={{ width }}>
      <View style={[styles.videoWrap, styles.offline]}>
        <MaterialCommunityIcons name="video-off" size={32} color={colors.textDim} />
        <Text style={styles.offlineText}>Camera offline. Check its power and Wi-Fi.</Text>
      </View>
      <Text style={styles.name}>{device.name}</Text>
    </View>
  );
}

export default function CamerasScreen() {
  const focused = useIsFocused(); // only play streams while this tab is visible
  const { devices } = useHome();
  const { canViewCameras } = useAuth();
  const { width, isLandscape } = useOrientation();

  const cameras = devices.filter((d) => d.type === 'camera');
  const cols = isLandscape ? 2 : 1;
  const tileW = (width - spacing.lg * 2 - spacing.md * (cols - 1)) / cols;

  return (
    <Screen title="Cameras" subtitle={`${cameras.filter((c) => c.online).length} of ${cameras.length} online`}>
      {!canViewCameras ? (
        <View style={styles.blocked}>
          <MaterialCommunityIcons name="lock-outline" size={36} color={colors.textDim} />
          <Text style={styles.blockedText}>Guests can’t view camera feeds. Ask an admin to change your role.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {cameras.length === 0 ? <Text style={styles.blockedText}>No cameras yet. Add one from the Devices tab.</Text> : null}
          {cameras.map((c) =>
            c.online && (DEMO_VIDEOS[c.id] || c.streamUrl) ? (
              focused ? <LiveTile key={c.id} device={c} width={tileW} /> : <View key={c.id} style={{ width: tileW }} />
            ) : (
              <OfflineTile key={c.id} device={c} width={tileW} />
            ),
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, padding: spacing.lg },
  videoWrap: { aspectRatio: 16 / 9, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.primary },
  video: { width: '100%', height: '100%' },
  live: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warn },
  liveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  name: { marginTop: 6, fontSize: 14, fontWeight: '700', color: colors.text },
  offline: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  offlineText: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  blockedText: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
});
