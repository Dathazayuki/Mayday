import { MEDICAL_RECORD_STATUS_LABELS, MEDICAL_RECORD_STATUSES } from '@drmayday/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MedicalRecordStatusTag } from './status';

const EXPECTED_TONES = {
  draft: 'neutral',
  pending: 'amber',
  in_progress: 'primary',
  completed: 'green',
  cancelled: 'red',
} as const;

describe('MedicalRecordStatusTag', () => {
  it.each(MEDICAL_RECORD_STATUSES)('trạng thái %s hiện đúng nhãn và tông', (status) => {
    render(<MedicalRecordStatusTag status={status} />);
    const badge = screen.getByText(MEDICAL_RECORD_STATUS_LABELS[status]);
    expect(badge).toHaveClass('dm-badge', `dm-badge--${EXPECTED_TONES[status]}`);
  });
});
