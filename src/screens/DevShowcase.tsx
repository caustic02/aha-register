/**
 * DEV ONLY — Component showcase for visual verification.
 * Remove this file and the route in AppShell.tsx after verification.
 */
import { Camera, PackageOpen, Plus, Settings } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  ChipGroup,
  ConfidenceBar,
  Divider,
  EmptyState,
  IconButton,
  ListItem,
  MetadataRow,
  SectionHeader,
  TextInput,
} from '../components/ui';
import { colors } from '../theme';

export function DevShowcase() {
  const [titleValue, setTitleValue] = useState('');
  const [invNumValue, setInvNumValue] = useState('SM-2024-0847');
  const [artistValue, setArtistValue] = useState('');
  const [descValue, setDescValue] = useState('');

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {/* ── Button ─────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Button</Text>
      <Button label="Capture object" variant="primary" size="lg" onPress={() => {}} />
      <View style={styles.gap12} />
      <Button label="Save draft" variant="secondary" size="md" onPress={() => {}} />
      <View style={styles.gap12} />
      <Button label="Cancel" variant="ghost" size="sm" onPress={() => {}} />
      <View style={styles.gap12} />
      <Button label="Uploading..." variant="primary" loading={true} onPress={() => {}} />
      <View style={styles.gap12} />
      <Button label="Disabled" variant="primary" disabled={true} onPress={() => {}} />

      {/* ── TextInput ──────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>TextInput</Text>
      <TextInput
        label="Object title"
        value={titleValue}
        onChangeText={setTitleValue}
        placeholder="e.g., Bronze figurine, 3rd century"
      />
      <View style={styles.gap12} />
      <TextInput
        label="Inventory number"
        value={invNumValue}
        onChangeText={setInvNumValue}
        helperText="Assigned by institution"
      />
      <View style={styles.gap12} />
      <TextInput
        label="Artist"
        value={artistValue}
        onChangeText={setArtistValue}
        error="Required field"
      />
      <View style={styles.gap12} />
      <TextInput
        label="Description"
        value={descValue}
        onChangeText={setDescValue}
        placeholder="Condition notes..."
        multiline={true}
      />

      {/* ── Card ───────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Card</Text>
      <Card variant="flat">
        <Text>Flat card with border</Text>
      </Card>
      <View style={styles.gap12} />
      <Card variant="elevated">
        <Text>Elevated card with shadow</Text>
      </Card>

      {/* ── SectionHeader ──────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>SectionHeader</Text>
      <SectionHeader title="Collection details" />
      <SectionHeader title="Media files" action="See all" onAction={() => {}} />

      {/* ── Badge ──────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Badge</Text>
      <View style={styles.badgeRow}>
        <Badge label="Synced" variant="success" />
        <Badge label="Pending" variant="warning" />
        <Badge label="Error" variant="error" />
        <Badge label="3 items" variant="info" />
        <Badge label="AI filled" variant="ai" />
        <Badge label="Draft" variant="neutral" />
      </View>

      {/* ── Divider ────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Divider</Text>
      <Divider />
      <View style={styles.gap8} />
      <Divider inset={64} />

      {/* ── MetadataRow ────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>MetadataRow</Text>
      <MetadataRow label="Title" value="Bronze figurine, seated woman" />
      <Divider />
      <MetadataRow label="Date" value="3rd century CE" aiGenerated={true} />
      <Divider />
      <MetadataRow
        label="Medium"
        value="Bronze, patinated"
        aiGenerated={true}
        confidence={87}
      />
      <Divider />
      <MetadataRow label="Provenance" value={undefined} variant="stacked" />
      <Divider />
      <MetadataRow
        label="Long description example"
        value="This is a longer text that demonstrates the stacked variant where the value appears below the label for better readability of multi-line content."
        variant="stacked"
      />

      {/* ── ChipGroup ──────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>ChipGroup</Text>
      <ChipGroup
        options={[
          { label: 'General', value: 'general' },
          { label: 'Department', value: 'dept' },
          { label: 'Exhibition', value: 'exhibition' },
          { label: 'Research', value: 'research' },
          { label: 'Conservation', value: 'conservation' },
        ]}
        selected="general"
        onSelect={() => {}}
      />

      {/* ── IconButton ─────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>IconButton</Text>
      <View style={styles.iconButtonRow}>
        <IconButton
          icon={<Camera size={24} color={colors.text} />}
          accessibilityLabel="Take photo"
          variant="default"
          onPress={() => {}}
        />
        <IconButton
          icon={<Plus size={24} color={colors.textInverse} />}
          accessibilityLabel="Add item"
          variant="filled"
          onPress={() => {}}
        />
        <IconButton
          icon={<Settings size={24} color={colors.primary} />}
          accessibilityLabel="Settings"
          variant="tinted"
          onPress={() => {}}
        />
      </View>

      {/* ── ConfidenceBar ──────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>ConfidenceBar</Text>
      <ConfidenceBar confidence={92} label="Title" />
      <View style={styles.gap12} />
      <ConfidenceBar confidence={67} label="Medium" />
      <View style={styles.gap12} />
      <ConfidenceBar confidence={31} label="Date" />

      {/* ── EmptyState ─────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>EmptyState</Text>
      <View style={styles.emptyStateContainer}>
        <EmptyState
          icon={<PackageOpen size={32} color={colors.primary} />}
          title="No objects yet"
          message="Capture your first object to start building your collection."
          actionLabel="Start capture"
          onAction={() => {}}
        />
      </View>

      {/* ── ListItem ───────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>ListItem</Text>
      <ListItem
        title="Bronze figurine"
        subtitle="SM-2024-0847 · Synced"
        onPress={() => {}}
      />
      <Divider inset={0} />
      <ListItem
        title="Oil painting, landscape"
        subtitle="SM-2024-0848 · Pending sync"
        badge={{ label: 'AI', variant: 'ai' as const }}
        onPress={() => {}}
      />
      <Divider inset={0} />
      <ListItem
        title="Ceramic vessel fragments"
        subtitle="SM-2024-0849 · Draft"
        onPress={() => {}}
      />

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  sectionLabel: {
    fontWeight: 'bold',
    fontSize: 20,
    marginTop: 32,
    marginBottom: 12,
    color: colors.text,
  },
  gap12: {
    height: 12,
  },
  gap8: {
    height: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconButtonRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  emptyStateContainer: {
    height: 300,
  },
  bottomPad: {
    height: 40,
  },
});
