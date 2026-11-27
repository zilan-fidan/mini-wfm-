import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker, Form, Input, Modal, Select, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { createWorkOrder, updateWorkOrder } from '../api/work-orders.api';
import type { WorkOrderDetail, WorkOrderPriority } from '../types/work-order';
import { toIso } from '../utils/date';
import { PRIORITY_OPTIONS } from '../utils/work-order';
import TeamSelect from './TeamSelect';

type FormValues = {
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  teamId?: number;
  dueAt: Dayjs;
};

type Props = {
  open: boolean;
  workOrder: WorkOrderDetail | null; // null = yeni
  onClose: () => void;
};

export default function WorkOrderFormModal({ open, workOrder, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isEdit = workOrder !== null;

  useEffect(() => {
    if (!open) return;
    if (workOrder) {
      form.setFieldsValue({
        title: workOrder.title,
        description: workOrder.description ?? '',
        priority: workOrder.priority,
        dueAt: dayjs(workOrder.dueAt),
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ priority: 'MEDIUM', dueAt: dayjs().add(3, 'day').hour(17).minute(0).second(0) });
    }
  }, [open, workOrder, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? updateWorkOrder(workOrder.id, {
            version: workOrder.version, // başkası değiştirdiyse backend 409 döner
            title: values.title.trim(),
            description: values.description?.trim() ?? '',
            priority: values.priority,
            dueAt: toIso(values.dueAt),
          })
        : createWorkOrder({
            title: values.title.trim(),
            description: values.description?.trim() || undefined,
            priority: values.priority,
            teamId: values.teamId,
            dueAt: toIso(values.dueAt),
          }),
    onSuccess: (saved) => {
      message.success(isEdit ? 'İş emri güncellendi' : `${saved.code} oluşturuldu`);
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      onClose();
      if (!isEdit) navigate(`/work-orders/${saved.id}`);
    },
  });

  return (
    <Modal
      open={open}
      title={isEdit ? `${workOrder.code} · Düzenle` : 'Yeni İş Emri'}
      okText="Kaydet"
      cancelText="İptal"
      confirmLoading={mutation.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        <Form.Item
          label="Başlık"
          name="title"
          rules={[
            { required: true, whitespace: true, message: 'Başlık zorunludur' },
            { max: 200, message: 'Başlık en fazla 200 karakter olabilir' },
          ]}
        >
          <Input maxLength={200} showCount />
        </Form.Item>
        <Form.Item label="Açıklama" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item label="Öncelik" name="priority" rules={[{ required: true }]}>
          <Select options={PRIORITY_OPTIONS} />
        </Form.Item>
        {!isEdit && (
          <Form.Item label="Ekip" name="teamId" extra="Seçilirse iş emri doğrudan bu ekibe atanır.">
            <TeamSelect onlyActive placeholder="Şimdilik atama yapma" />
          </Form.Item>
        )}
        <Form.Item label="Son tarih" name="dueAt" rules={[{ required: true, message: 'Son tarih seçin' }]}>
          <DatePicker showTime={{ format: 'HH:mm', minuteStep: 15 }} format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
