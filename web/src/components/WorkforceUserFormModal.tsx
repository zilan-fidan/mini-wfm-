import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Form, Input, Modal } from 'antd';
import { useEffect } from 'react';
import {createWorkforceUser,updateWorkforceUser,} from '../api/workforce-users.api';
import type { WorkforceUser } from '../types/workforce-user';

type WorkforceUserFormValues = {
  firstname: string;
  lastname: string;
  registrationNumber: string;
  phone?: string;
};

type Props = {
  open: boolean;
  workforceUser: WorkforceUser | null; // null = yeni personel, dolu = düzenleme
  onClose: () => void;
  onCreated?: () => void; // oluşturma başarılı olunca (sayfa 1'e dönmek için)
};

export default function WorkforceUserFormModal({open,workforceUser,onClose,onCreated,}:Props) {
  const [form] = Form.useForm<WorkforceUserFormValues>();
  const queryClient = useQueryClient();
  const isEdit = workforceUser !== null;

  useEffect(() => {
    if (!open) return;

    if (workforceUser) {
      form.setFieldsValue({
        firstname: workforceUser.firstname,
        lastname: workforceUser.lastname,
        registrationNumber: workforceUser.registrationNumber,
        phone: workforceUser.phone ?? '',
      });
    } else {
      form.resetFields();
    }
  }, [open, workforceUser, form]);

  const createMutation = useMutation({
    mutationFn: createWorkforceUser,
    onSuccess: (created) => {
      Modal.success({
        title: 'Personel oluşturuldu',
        content: `${created.firstname} ${created.lastname} başarıyla kaydedildi.`,
        okText: 'Tamam',
      });
      queryClient.invalidateQueries({ queryKey: ['workforce-users'] });
      form.resetFields();
      onCreated?.();
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: WorkforceUserFormValues) =>
      updateWorkforceUser(workforceUser!.id, {
        firstname: values.firstname,
        lastname: values.lastname,
        registrationNumber: values.registrationNumber,
        phone: values.phone || null, // silindiyse null: '' backend'de desene takılır
      }),
    onSuccess: (updated) => {
      Modal.success({
        title: 'Personel güncellendi',
        content: `${updated.firstname} ${updated.lastname} bilgileri kaydedildi.`,
        okText: 'Tamam',
      });
      queryClient.invalidateQueries({ queryKey: ['workforce-users'] });
      onClose();
    },
  });

  const handleFinish = (values: WorkforceUserFormValues) => {
    if (isEdit) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate({
        firstname: values.firstname,
        lastname: values.lastname,
        registrationNumber: values.registrationNumber,
        phone: values.phone || undefined, // boşsa hiç gönderme
      });
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? 'Personeli Düzenle' : 'Yeni Personel'}
      okText="Kaydet"
      cancelText="İptal"
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label="Ad"
          name="firstname"
          rules={[
            { required: true, message: 'Ad zorunludur' },
            { whitespace: true, message: 'Ad boşluktan oluşamaz' },
            { max: 100, message: 'Ad en fazla 100 karakter olabilir' },
          ]}
        >
          <Input maxLength={100} />
        </Form.Item>

        <Form.Item
          label="Soyad"
          name="lastname"
          rules={[
            { required: true, message: 'Soyad zorunludur' },
            { whitespace: true, message: 'Soyad boşluktan oluşamaz' },
            { max: 100, message: 'Soyad en fazla 100 karakter olabilir' },
          ]}
        >
          <Input maxLength={100} />
        </Form.Item>

        <Form.Item
          label="Sicil No"
          name="registrationNumber"
          rules={[
            { required: true, message: 'Sicil no zorunludur' },
            { whitespace: true, message: 'Sicil no boşluktan oluşamaz' },
            { max: 20, message: 'Sicil no en fazla 20 karakter olabilir' },
          ]}
        >
          <Input maxLength={20} />
        </Form.Item>

        <Form.Item
          label="Telefon"
          name="phone"
          rules={[
            {
              pattern: /^5\d{9}$/,
              message: 'Telefon 5 ile başlayan 10 haneli olmalıdır',
            },
          ]}
        >
          <Input maxLength={10} placeholder="5XXXXXXXXX" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
