import { SoftTag } from './WorkOrderTags';

export default function StatusTag({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <SoftTag tone={{ background: '#DCFCE7', color: '#15803D' }}>Aktif</SoftTag>
  ) : (
    <SoftTag tone={{ background: '#EEF0F5', color: '#6B7280' }}>Pasif</SoftTag>
  );
}
