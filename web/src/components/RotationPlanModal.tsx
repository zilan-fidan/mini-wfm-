import { DeleteOutlined, EyeOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Button, Col, DatePicker, Divider, Flex, Form, Input, InputNumber, Modal, Row, Space, Statistic, Table, Tabs, Tag, message,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { extractErrorDetails, extractErrorMessage } from '../api/http';
import { createRotationPlan } from '../api/shifts.api';
import type { RotationPlanPayload, RotationPlanResponse, RotationSlot } from '../types/shift';
import { formatHours, formatTime } from '../utils/date';
import ErrorDetails from './ErrorDetails';

type FormValues = {
  startDate: Dayjs;
  days: number;
  slots: RotationSlot[];
};

type Props = {
  open: boolean;
  teamId: number;
  teamName: string;
  onClose: () => void;
};

const TIME_START = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_END = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

const DEFAULT_SLOTS: RotationSlot[] = [
  { name: 'Sabah', startTime: '08:00', endTime: '16:00', required: 1 },
  { name: 'Akşam', startTime: '16:00', endTime: '24:00', required: 1 },
];

// Ekip üyelerini slotlara adil dağıtan rotasyon planı: önce önizleme, eksiksizse uygulama
export default function RotationPlanModal({ open, teamId, teamName, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<RotationPlanResponse | null>(null);
  const [error, setError] = useState<{ message: string; details: unknown[] } | null>(null);

  // Kapanırken hata/önizleme temizlenir; tekrar açıldığında temiz başlar
  const close = () => {
    setError(null);
    setPreview(null);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ startDate: dayjs().add(1, 'day'), days: 7, slots: DEFAULT_SLOTS });
  }, [open, form]);

  const toPayload = (values: FormValues, apply: boolean): RotationPlanPayload => ({
    startDate: values.startDate.format('YYYY-MM-DD'),
    days: values.days,
    slots: values.slots.map((s) => ({ ...s, name: s.name.trim() })),
    apply,
  });

  const mutation = useMutation({
    mutationFn: (payload: RotationPlanPayload) => createRotationPlan(teamId, payload),
    onSuccess: (result) => {
      setPreview(result);
      if (result.applied) {
        message.success(`Plan uygulandı: ${result.assignments.length} vardiya oluşturuldu`);
        queryClient.invalidateQueries({ queryKey: ['shifts'] });
        queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      }
    },
    onError: (err) => setError({ message: extractErrorMessage(err), details: extractErrorDetails(err) }),
  });

  const run = async (apply: boolean) => {
    const values = await form.validateFields();
    setError(null);
    mutation.mutate(toPayload(values, apply));
  };

  const complete = preview !== null && preview.unfilled.length === 0;

  return (
    <Modal
      open={open}
      width={920}
      title={`Rotasyon Planı · ${teamName}`}
      onCancel={close}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={close}>Kapat</Button>
          <Button icon={<EyeOutlined />} loading={mutation.isPending && !mutation.variables?.apply} onClick={() => run(false)}>
            Önizle
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            disabled={!complete || preview?.applied}
            loading={mutation.isPending && mutation.variables?.apply}
            onClick={() => run(true)}
          >
            Planı Uygula
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onValuesChange={() => preview && !preview.applied && setPreview(null)}>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item label="İlk gün" name="startDate" rules={[{ required: true, message: 'Başlangıç günü seçin' }]}>
              <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Gün sayısı" name="days" rules={[{ required: true, message: 'Gün sayısı girin' }]}>
              <InputNumber min={1} max={14} style={{ width: '100%' }} suffix="gün" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain style={{ marginTop: 0 }}>
          Günlük slotlar
        </Divider>
        <Form.List name="slots">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name }) => (
                <Row gutter={8} key={key} align="top">
                  <Col xs={24} sm={8}>
                    <Form.Item name={[name, 'name']} rules={[{ required: true, whitespace: true, message: 'Ad zorunlu' }]}>
                      <Input placeholder="Slot adı (Sabah)" maxLength={100} />
                    </Form.Item>
                  </Col>
                  <Col xs={8} sm={5}>
                    <Form.Item name={[name, 'startTime']} rules={[{ required: true, pattern: TIME_START, message: 'HH:mm' }]}>
                      <Input placeholder="08:00" maxLength={5} />
                    </Form.Item>
                  </Col>
                  <Col xs={8} sm={5}>
                    <Form.Item name={[name, 'endTime']} rules={[{ required: true, pattern: TIME_END, message: 'HH:mm' }]}>
                      <Input placeholder="16:00" maxLength={5} />
                    </Form.Item>
                  </Col>
                  <Col xs={6} sm={4}>
                    <Form.Item name={[name, 'required']} rules={[{ required: true, message: 'Kişi' }]}>
                      <InputNumber min={1} style={{ width: '100%' }} suffix="kişi" />
                    </Form.Item>
                  </Col>
                  <Col xs={2} sm={2}>
                    <Button type="text" danger icon={<DeleteOutlined />} disabled={fields.length === 1} onClick={() => remove(name)} />
                  </Col>
                </Row>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                disabled={fields.length >= 24}
                onClick={() => add({ name: '', startTime: '', endTime: '', required: 1 })}
              >
                Slot ekle
              </Button>
              <div style={{ color: '#8a92a6', fontSize: 12, marginTop: 8 }}>
                Bitiş başlangıca eşit veya küçükse vardiya ertesi güne taşar; 24:00 günün sonudur.
              </div>
            </>
          )}
        </Form.List>
      </Form>

      {error && (
        <div style={{ marginTop: 16 }}>
          <ErrorDetails title={error.message} details={error.details} />
        </div>
      )}

      {preview && (
        <>
          <Divider />
          {preview.applied ? (
            <Alert type="success" showIcon message="Plan kaydedildi" style={{ marginBottom: 16 }} />
          ) : complete ? (
            <Alert type="info" showIcon message="Plan eksiksiz. Kaydetmek için “Planı Uygula”ya basın." style={{ marginBottom: 16 }} />
          ) : (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`${preview.unfilled.length} slot doldurulamadı, plan bu haliyle uygulanamaz`}
              description="Slot sayısını veya gereken kişi sayısını azaltın ya da ekibe üye ekleyin."
            />
          )}

          <Flex gap={32} wrap style={{ marginBottom: 16 }}>
            <Statistic title="Atama" value={preview.assignments.length} />
            <Statistic title="Eksik slot" value={preview.unfilled.length} />
            <Statistic title="Adalet farkı" value={formatHours(preview.fairnessGapHours)} />
          </Flex>

          <Tabs
            items={[
              {
                key: 'assignments',
                label: 'Atamalar',
                children: (
                  <Table
                    size="small"
                    rowKey={(r) => `${r.date}-${r.slotName}-${r.workforceUserId}`}
                    dataSource={preview.assignments}
                    pagination={{ pageSize: 8 }}
                    columns={[
                      { title: 'Gün', dataIndex: 'date', render: (d: string) => dayjs(d).format('DD.MM ddd') },
                      { title: 'Slot', dataIndex: 'slotName' },
                      { title: 'Saat', render: (_, r) => `${formatTime(r.startAt)}–${formatTime(r.endAt)}` },
                      { title: 'Personel', render: (_, r) => `${r.firstname} ${r.lastname}` },
                    ]}
                  />
                ),
              },
              {
                key: 'workloads',
                label: 'İş yükü',
                children: (
                  <Table
                    size="small"
                    rowKey="workforceUserId"
                    dataSource={preview.workloads}
                    pagination={false}
                    columns={[
                      { title: 'Personel', render: (_, r) => `${r.firstname} ${r.lastname}` },
                      { title: 'Vardiya', dataIndex: 'shiftCount', align: 'right' },
                      { title: 'Toplam', dataIndex: 'totalHours', align: 'right', render: formatHours },
                    ]}
                  />
                ),
              },
              ...(preview.unfilled.length
                ? [
                    {
                      key: 'unfilled',
                      label: <span>Eksikler <Tag color="warning">{preview.unfilled.length}</Tag></span>,
                      children: (
                        <Table
                          size="small"
                          rowKey={(r) => `${r.date}-${r.slotName}`}
                          dataSource={preview.unfilled}
                          pagination={false}
                          columns={[
                            { title: 'Gün', dataIndex: 'date', render: (d: string) => dayjs(d).format('DD.MM ddd') },
                            { title: 'Slot', dataIndex: 'slotName' },
                            { title: 'Gereken', dataIndex: 'required', align: 'right' },
                            { title: 'Atanan', dataIndex: 'assigned', align: 'right' },
                            { title: 'Eksik', dataIndex: 'missing', align: 'right' },
                          ]}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}
    </Modal>
  );
}
