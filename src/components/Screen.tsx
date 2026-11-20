import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { useOrientation } from '../hooks/useOrientation';
import VoiceSearchBar from './VoiceSearchBar';

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Show the search / voice bar under the title. */
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (text: string) => void;
}

export default function Screen({ title, subtitle, children, showSearch = true, searchValue, onSearchChange }: Props) {
  const { isLandscape } = useOrientation();
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={[styles.header, isLandscape && styles.headerLandscape]}>
        <View style={styles.titles}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showSearch ? (
          <View style={isLandscape ? styles.searchLandscape : undefined}>
            <VoiceSearchBar value={searchValue} onChangeText={onSearchChange} />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
  headerLandscape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titles: { flexShrink: 1 },
  title: { fontSize: 26, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 13, color: colors.textDim, marginTop: 2 },
  searchLandscape: { width: 380 },
  body: { flex: 1 },
});
