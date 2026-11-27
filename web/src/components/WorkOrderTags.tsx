import { WarningOutlined } from '@ant-design/icons';
import type { CSSProperties, ReactNode } from 'react';
import type { WorkOrderPriority, WorkOrderStatus } from '../types/work-order';
import { PRIORITY_LABELS, STATUS_LABELS } from '../utils/work-order';

type Tone = { background: string; color: string };

// Görseldeki yumuşak etiketler: açık zemin + koyu metin (renk tek başına anlam taşımaz, metin her zaman var)
const STATUS_TONES: Record<WorkOrderStatus, Tone> = {
  OPEN: { background: '#E0E7FF', color: '#3730A3' },
  ASSIGNED: {
    background: 'var(--assigned-status-background, #ECEBFA)',
    color: 'var(--assigned-status-color, #5B52D6)',
  },
  IN_PROGRESS: { background: '#E1F0FB', color: '#1F5F8B' },
  COMPLETED: { background: '#DCFCE7', color: '#15803D' },
  CANCELLED: { background: '#EEF0F5', color: '#6B7280' },
};

const PRIORITY_TONES: Record<WorkOrderPriority, Tone> = {
  LOW: { background: '#EEF0F5', color: '#6B7280' },
  MEDIUM: { background: '#E6E8F5', color: '#3B4883' },
  HIGH: { background: '#FEF3C7', color: '#B45309' },
  URGENT: { background: '#FDE8E8', color: '#C03B3B' },
};

export function SoftTag({ tone, children, style, className }: {
  tone: Tone;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span className={className ? `soft-tag ${className}` : 'soft-tag'} style={{ ...tone, ...style }}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  return <SoftTag tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</SoftTag>;
}

export function PriorityBadge({ priority }: { priority: WorkOrderPriority }) {
  return (
    <SoftTag tone={PRIORITY_TONES[priority]} className="work-order-priority">
      {PRIORITY_LABELS[priority]}
    </SoftTag>
  );
}

export function OverdueBadge() {
  return (
    <SoftTag tone={{ background: '#FEF3C7', color: '#B45309' }}>
      <WarningOutlined /> Gecikti
    </SoftTag>
  );
}
