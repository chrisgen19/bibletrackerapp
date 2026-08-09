import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  compact?: boolean;
}

/** The one place user-facing "nothing here" copy is rendered, so tone stays consistent. */
export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { paddingVertical: compact ? theme.spacing.xl : theme.spacing.huge }]}>
      {icon === undefined ? null : (
        <View
          style={[
            styles.iconWell,
            { backgroundColor: theme.colors.surfaceSubtle, marginBottom: theme.spacing.lg },
          ]}
        >
          <Icon name={icon} size={22} color={theme.colors.textTertiary} />
        </View>
      )}
      <Text variant="headline" align="center">
        {title}
      </Text>
      {description === undefined ? null : (
        <Text
          variant="callout"
          color="secondary"
          align="center"
          style={{ marginTop: theme.spacing.sm, maxWidth: 300 }}
        >
          {description}
        </Text>
      )}
      {action === undefined ? null : (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
          size="medium"
          style={{ marginTop: theme.spacing.xl, alignSelf: 'center', paddingHorizontal: theme.spacing.xxl }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  iconWell: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
