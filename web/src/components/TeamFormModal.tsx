import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Form, Input, Modal, message } from 'antd';
import { useEffect } from 'react';
import { createTeam, updateTeam } from '../api/teams.api';
import type { Team } from '../types/team';

type TeamFormValues = {
  name: string;
  description?: string;
};

type Props = {
  open: boolean;
  team: Team | null; // null = yeni ekip, dolu = düzenleme
  onClose: () => void;
  onCreated?: () => void; // oluşturma başarılı olunca (sayfa 1'e dönmek için)
};

export default function TeamFormModal({ open, team, onClose, onCreated }: Props) {
  const [form] = Form.useForm<TeamFormValues>();
  const queryClient = useQueryClient();

  const isEdit = team !== null;

  useEffect(() => {
    if (!open) return;

    if (team) {
      form.setFieldsValue({
        name: team.name,
        description: team.description ?? '',
      });
    } else {
      form.resetFields();
    }
  }, [open, team, form]);

  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      message.success('Ekip oluşturuldu');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      form.resetFields();
      onCreated?.();
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: TeamFormValues) =>
      updateTeam(team!.id, {
        name: values.name,
        description: values.description ?? '',
      }),
    onSuccess: () => {
      message.success('Ekip güncellendi');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      onClose();
    },
  });

  const handleFinish = (values: TeamFormValues) => {
    if (isEdit) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate({
        name: values.name,
        description: values.description,
      });
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? 'Ekibi Düzenle' : 'Yeni Ekip'}
      okText="Kaydet"
      cancelText="İptal"
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label="Ekip Adı"
          name="name"
          rules={[
            { required: true, message: 'Ekip adı zorunludur' },
            { whitespace: true, message: 'Ekip adı boşluktan oluşamaz' },
            { max: 200, message: 'Ekip adı en fazla 200 karakter olabilir' },
          ]}
        >
          <Input maxLength={200} showCount />
        </Form.Item>

        <Form.Item label="Açıklama" name="description">
          <Input.TextArea rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  );
}