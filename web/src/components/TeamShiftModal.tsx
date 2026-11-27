import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker, Form, Input, Modal, Typography, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { extractErrorDetails, extractErrorMessage } from '../api/http';
import { createTeamShifts } from '../api/shifts.api';
import { toIso } from '../utils/date';
import ErrorDetails from './ErrorDetails';
import TeamSelect from './TeamSelect';

type FormValues = {
  teamId: number;
  range: [Dayjs, Dayjs];
  note?: string;
};

type Props = {
  open: boolean;
  teamId?: number; // ekip detayından açılınca sabit
  onClose: () => void;
};

// Ekibin tüm aktif üyelerine aynı vardiyayı tek işlemde atar (biri çakışırsa hiçbiri yazılmaz)
export default function TeamShiftModal({ open, teamId, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<{ message: string; details: unknown[] } | null>(null);

  // Kapanırken hata/önizleme temizlenir; tekrar açıldığında temiz başlar
  const close = () => {
    setError(null);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    const start = dayjs().add(1, 'day').hour(8).minute(0).second(0);
    form.setFieldsValue({ teamId, range: [start, start.add(8, 'hour')] });
  }, [open, teamId, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createTeamShifts(values.teamId, {
        startAt: toIso(values.range[0]),
        endAt: toIso(values.range[1]),
        note: values.note?.trim() || undefined,
      }),
    onSuccess: (shifts) => {
      message.success(`${shifts.length} personele vardiya atandı`);
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      close();
    },
    onError: (err) => setError({ message: extractErrorMessage(err), details: extractErrorDetails(err) }),
  });

  return (
    <Modal
      open={open}
      title="Ekibe Toplu Vardiya"
      okText="Ata"
      cancelText="İptal"
      confirmLoading={mutation.isPending}
      onCancel={close}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">
        Vardiya ekibin tüm <b>aktif</b> üyelerine atanır. Üyelerden birinin vardiyası çakışırsa hiçbiri kaydedilmez.
      </Typography.Paragraph>

      {error && <ErrorDetails title={error.message} details={error.details} />}

      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)} onValuesChange={() => setError(null)}>
        <Form.Item label="Ekip" name="teamId" rules={[{ required: true, message: 'Ekip seçin' }]} hidden={teamId !== undefined}>
          <TeamSelect onlyActive />
        </Form.Item>
        <Form.Item label="Başlangıç – Bitiş" name="range" rules={[{ required: true, message: 'Vardiya saatlerini seçin' }]}>
          <DatePicker.RangePicker showTime={{ format: 'HH:mm', minuteStep: 15 }} format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Not" name="note" rules={[{ max: 500 }]}>
          <Input.TextArea rows={2} placeholder="Örn. Ekip vardiyası" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
