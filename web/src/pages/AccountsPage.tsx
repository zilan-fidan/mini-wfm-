import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Flex, Form, Input, Modal, Select, Table, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import { createAccount, listAccounts } from '../api/accounts.api';
import { ROLE_COLORS, ROLE_LABELS, useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusTag from '../components/StatusTag';
import type { CreateAccountPayload } from '../types/account';
import type { Role } from '../types/auth';
import { formatDateTime } from '../utils/date';

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

const ROLE_HINTS: Record<Role, string> = {
  ADMIN: 'Her şeyi yönetir: hesaplar, ekipler, personeller dahil.',
  PLANNER: 'Vardiya ve iş emirlerini planlar; ekip/personel kayıtlarını görüntüler.',
  VIEWER: 'Yalnızca görüntüler; hiçbir kaydı değiştiremez.',
};

export default function AccountsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<CreateAccountPayload>();
  const [open, setOpen] = useState(false);
  const role = Form.useWatch('role', form);

  const { data, isFetching } = useQuery({ queryKey: ['accounts'], queryFn: listAccounts });

  const mutation = useMutation({
    mutationFn: createAccount,
    onSuccess: (account) => {
      message.success(`${account.username} hesabı oluşturuldu`);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setOpen(false);
    },
  });

  return (
    <>
      <PageHeader
        title="Hesaplar"
        subtitle="Uygulamaya giriş yapabilen kullanıcılar"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setOpen(true);
            }}
          >
            Yeni Hesap
          </Button>
        }
      />

      <Card className="page-card">
        <Table
          rowKey="id"
          loading={isFetching}
          dataSource={data}
          pagination={false}
          scroll={{ x: 640 }}
          columns={[
            {
              title: 'Kullanıcı adı',
              dataIndex: 'username',
              sorter: (a, b) => a.username.localeCompare(b.username, 'tr'),
              render: (username: string) => (
                <Flex align="center" gap={10}>
                  <Avatar size="small" style={{ background: '#ECEBFA', color: 'var(--lilac-accent)', fontWeight: 700 }}>
                    {username.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography.Text strong>{username}</Typography.Text>
                  {username === user?.username && <Tag bordered={false}>Siz</Tag>}
                </Flex>
              ),
            },
            {
              title: 'Rol',
              dataIndex: 'role',
              width: 160,
              filters: ROLE_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
              onFilter: (value, r) => r.role === value,
              render: (r: Role) => (
                <Tag color={ROLE_COLORS[r]} bordered={false}>
                  {ROLE_LABELS[r]}
                </Tag>
              ),
            },
            { title: 'Durum', dataIndex: 'isActive', width: 110, render: (v: boolean) => <StatusTag isActive={v} /> },
            { title: 'Oluşturulma', dataIndex: 'createdAt', width: 170, render: formatDateTime },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title="Yeni Hesap"
        okText="Oluştur"
        cancelText="İptal"
        confirmLoading={mutation.isPending}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ role: 'VIEWER' }}
          onFinish={(v) => mutation.mutate({ ...v, username: v.username.trim() })}
        >
          <Form.Item
            label="Kullanıcı adı"
            name="username"
            rules={[
              { required: true, whitespace: true, message: 'Kullanıcı adı zorunludur' },
              { max: 50, message: 'En fazla 50 karakter' },
            ]}
          >
            <Input maxLength={50} autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="Şifre"
            name="password"
            rules={[
              { required: true, message: 'Şifre zorunludur' },
              { min: 8, message: 'Şifre en az 8 karakter olmalıdır' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item label="Rol" name="role" rules={[{ required: true }]} extra={role && ROLE_HINTS[role as Role]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
