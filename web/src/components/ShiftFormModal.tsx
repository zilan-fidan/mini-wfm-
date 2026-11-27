import { DeleteOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Form, Input, Modal, Popconfirm, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { extractErrorDetails, extractErrorMessage } from '../api/http';
import { createShift, deleteShift, updateShift } from '../api/shifts.api';
import type { Shift } from '../types/shift';
import { toIso } from '../utils/date';
import ErrorDetails from './ErrorDetails';
import WorkforceUserSelect from './WorkforceUserSelect';

type FormValues = {
  workforceUserId: number;
  range: [Dayjs, Dayjs];
  note?: string;
};

type Props = {
  open: boolean;
  shift: Shift | null; // null = yeni vardiya
  defaultStart?: Dayjs; // takvimde boş güne tıklanınca
  onClose: () => void;
};

export default function ShiftFormModal({ open, shift, defaultStart, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<{ message: string; details: unknown[] } | null>(null);
  const isEdit = shift !== null;

  // Kapanırken hata/önizleme temizlenir; tekrar açıldığında temiz başlar
  const close = () => {
    setError(null);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    if (shift) {
      form.setFieldsValue({
        workforceUserId: shift.workforceUserId,
        range: [dayjs(shift.startAt), dayjs(shift.endAt)],
        note: shift.note ?? '',
      });
    } else {
      form.resetFields();
      const start = (defaultStart ?? dayjs().add(1, 'day')).hour(8).minute(0).second(0);
      form.setFieldsValue({ range: [start, start.add(8, 'hour')] });
    }
  }, [open, shift, defaultStart, form]);

  const onError = (err: unknown) =>
    setError({ message: extractErrorMessage(err), details: extractErrorDetails(err) });

  const done = (text: string) => {
    message.success(text);
    queryClient.invalidateQueries({ queryKey: ['shifts'] });
    queryClient.invalidateQueries({ queryKey: ['timesheet'] });
    close();
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        workforceUserId: values.workforceUserId,
        startAt: toIso(values.range[0]),
        endAt: toIso(values.range[1]),
        note: values.note?.trim() || null,
      };
      return isEdit ? updateShift(shift.id, payload) : createShift(payload);
    },
    onSuccess: () => done(isEdit ? 'Vardiya güncellendi' : 'Vardiya oluşturuldu'),
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteShift(shift!.id),
    onSuccess: () => done('Vardiya silindi'),
    onError,
  });

  return (
    <Modal
      open={open}
      title={isEdit ? 'Vardiyayı Düzenle' : 'Yeni Vardiya'}
      onCancel={close}
      destroyOnHidden
      footer={[
        isEdit && (
          <Popconfirm
            key="delete"
            title="Vardiyayı silmek istediğinize emin misiniz?"
            okText="Evet, Sil"
            cancelText="Vazgeç"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutate()}
          >
            <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending} style={{ float: 'left' }}>
              Sil
            </Button>
          </Popconfirm>
        ),
        <Button key="cancel" onClick={close}>
          İptal
        </Button>,
        <Button key="ok" type="primary" loading={saveMutation.isPending} onClick={() => form.submit()}>
          Kaydet
        </Button>,
      ]}
    >
      {error && <ErrorDetails title={error.message} details={error.details} />}

      <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)} onValuesChange={() => setError(null)}>
        <Form.Item label="Personel" name="workforceUserId" rules={[{ required: true, message: 'Personel seçin' }]}>
          <WorkforceUserSelect
            onlyActive
            initialOption={
              shift
                ? { value: shift.workforceUserId, label: `${shift.workforceUser.firstname} ${shift.workforceUser.lastname}` }
                : undefined
            }
          />
        </Form.Item>

        <Form.Item
          label="Başlangıç – Bitiş"
          name="range"
          extra="Vardiya 1–12 saat sürmeli ve geçmişte başlamamalı."
          rules={[{ required: true, message: 'Vardiya saatlerini seçin' }]}
        >
          <DatePicker.RangePicker
            showTime={{ format: 'HH:mm', minuteStep: 15 }}
            format="DD.MM.YYYY HH:mm"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label="Not" name="note" rules={[{ max: 500, message: 'Not en fazla 500 karakter olabilir' }]}>
          <Input.TextArea rows={2} placeholder="Örn. Sabah vardiyası" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
