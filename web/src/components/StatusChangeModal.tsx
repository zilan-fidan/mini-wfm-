import { BulbOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Empty, Flex, Form, Input, Modal, Skeleton, Tag, Tooltip, Typography, message } from 'antd';
import { useEffect } from 'react';
import { changeWorkOrderStatus, getTeamSuggestions } from '../api/work-orders.api';
import type { ScoreCriterion, WorkOrderDetail } from '../types/work-order';
import { STATUS_LABELS, type Transition } from '../utils/work-order';
import TeamSelect from './TeamSelect';
import './StatusChangeModal.css';

const CRITERION_LABELS: Record<ScoreCriterion, string> = {
  capacityHours: 'Kapasite (sa)',
  openWorkOrders: 'Açık iş',
  overdueWorkOrders: 'Geciken iş',
};

type Props = {
  workOrder: WorkOrderDetail;
  transition: Transition | null; // null = kapalı
  onClose: () => void;
};

type FormValues = { teamId?: number; reason?: string };

export default function StatusChangeModal({ workOrder, transition, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const queryClient = useQueryClient();
  const selectedTeamId = Form.useWatch('teamId', form);
  const open = transition !== null;
  const needsTeam = !!transition?.requiresTeam;

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  // Ekip ataması sırasında en uygun ekipler önerilir
  const { data: suggestions, isFetching: loadingSuggestions } = useQuery({
    queryKey: ['work-orders', 'suggestions', workOrder.id],
    queryFn: () => getTeamSuggestions(workOrder.id),
    enabled: open && needsTeam,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      changeWorkOrderStatus(workOrder.id, {
        version: workOrder.version,
        status: transition!.to,
        teamId: values.teamId,
        reason: values.reason?.trim() || undefined,
      }),
    onSuccess: (updated) => {
      message.success(`Durum: ${STATUS_LABELS[updated.status]}`);
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      title={transition ? `${transition.action} · ${workOrder.code}` : ''}
      okText="Onayla"
      cancelText="Vazgeç"
      okButtonProps={{ danger: transition?.to === 'CANCELLED' }}
      confirmLoading={mutation.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
      width={needsTeam ? 640 : 480}
      destroyOnHidden
    >
      {transition && (
        <Typography.Paragraph type="secondary">
          Durum <b>{STATUS_LABELS[workOrder.status]}</b> → <b>{STATUS_LABELS[transition.to]}</b> olarak değişecek.
        </Typography.Paragraph>
      )}

      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        {needsTeam && (
          <>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              <BulbOutlined style={{ color: '#F7B32B' }} /> Önerilen ekipler
            </Typography.Title>
            {loadingSuggestions ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : suggestions && suggestions.suggestions.length > 0 ? (
              <div className="suggestions">
                {suggestions.suggestions.map((s, i) => (
                  <button
                    type="button"
                    key={s.teamId}
                    className={`suggestion${selectedTeamId === s.teamId ? ' is-selected' : ''}`}
                    onClick={() => form.setFieldValue('teamId', s.teamId)}
                  >
                    <Flex justify="space-between" align="center">
                      <span className="suggestion__name">
                        {i === 0 && <Tag color="gold">En uygun</Tag>}
                        {s.teamName}
                      </span>
                      {selectedTeamId === s.teamId ? (
                        <CheckCircleFilled style={{ color: 'var(--lilac-accent)' }} />
                      ) : (
                        <span className="suggestion__score">{s.totalScore} puan</span>
                      )}
                    </Flex>
                    <Flex gap={12} wrap className="suggestion__breakdown">
                      {s.breakdown.map((b) => (
                        <Tooltip key={b.criterion} title={`Değer ${b.value} × ağırlık ${b.weight} = ${b.points} puan`}>
                          <span>
                            {CRITERION_LABELS[b.criterion]}: <b>{b.value}</b>
                          </span>
                        </Tooltip>
                      ))}
                    </Flex>
                  </button>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Uygun ekip önerisi yok" />
            )}
            {suggestions && suggestions.excluded.length > 0 && (
              <Alert
                type="info"
                showIcon
                style={{ margin: '12px 0' }}
                message={`${suggestions.excluded.length} ekip değerlendirme dışı`}
                description={
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {suggestions.excluded.slice(0, 5).map((e) => (
                      <li key={e.teamId}>
                        <b>{e.teamName}</b>: {e.reason}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
            <Form.Item label="Atanacak ekip" name="teamId" rules={[{ required: true, message: 'Ekip seçin' }]}>
              <TeamSelect onlyActive />
            </Form.Item>
          </>
        )}

        {transition?.requiresReason && (
          <Form.Item
            label="İptal nedeni"
            name="reason"
            rules={[
              { required: true, whitespace: true, message: 'Neden zorunludur' },
              { max: 500, message: 'En fazla 500 karakter' },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
