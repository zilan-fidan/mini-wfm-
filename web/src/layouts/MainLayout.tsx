import { Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/teams', label: 'Ekipler' },
  { key: '/workforce-users', label: 'Personeller' },
];

export default function MainLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // /teams/5 adresinde de "Ekipler" seçili görünsün
  const selectedKey = menuItems.find(
    (item) => pathname === item.key || pathname.startsWith(`${item.key}/`),
  )?.key;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          Mini WFM
        </Typography.Title>
      </Header>
      <Layout>
        <Sider width={220} theme="light">
          <Menu
            mode="inline"
            items={menuItems}
            selectedKeys={selectedKey ? [selectedKey] : []}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%' }}
          />
        </Sider>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}