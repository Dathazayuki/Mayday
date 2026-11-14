import type { MedicalRecordStatus } from '@drmayday/shared';
import { StyleSheet, Text } from 'react-native';
import { RECORD_STATUS_COLORS, RECORD_STATUS_LABELS } from '@/lib/record-status';

export function RecordStatusBadge({ status }: { status: MedicalRecordStatus }) {
  const { text, background } = RECORD_STATUS_COLORS[status];
  return (
    <Text style={[styles.badge, { color: text, backgroundColor: background }]}>
      {RECORD_STATUS_LABELS[status]}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
