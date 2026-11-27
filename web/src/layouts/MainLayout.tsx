import {
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  ControlOutlined,
  FileTextOutlined,
  MoonOutlined,
  SafetyOutlined,
  SunOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Avatar, Button, Flex, Layout, Menu, Segmented, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { listWorkOrders } from '../api/work-orders.api';
import sidebarBrandImage from '../assets/mini-wfm-sidebar.png';
import { ROLE_LABELS, useAuth } from '../auth/AuthContext';
import './MainLayout.css';

const { Header, Sider, Content } = Layout;

type NavItem = { key: string; label: string; icon: ReactNode; adminOnly?: boolean };

const NAV_GROUPS: { label: string; icon: ReactNode; items: NavItem[] }[] = [
  {
    label: 'Operasyon',
    icon: <ControlOutlined />,
    items: [
      { key: '/work-orders', label: 'İş Emirleri', icon: <FileTextOutlined /> },
      { key: '/shifts', label: 'Vardiyalar', icon: <CalendarOutlined /> },
    ],
  },
  {
    label: 'Organizasyon',
    icon: <TeamOutlined />,
    items: [
      { key: '/teams', label: 'Ekipler', icon: <TeamOutlined /> },
      { key: '/workforce-users', label: 'Personeller', icon: <UserOutlined /> },
    ],
  },
  {
    label: 'Analiz',
    icon: <BarChartOutlined />,
    items: [
      { key: '/reports', label: 'Raporlar', icon: <BarChartOutlined /> },
      { key: '/notifications', label: 'Bildirimler', icon: <BellOutlined /> },
    ],
  },
  {
    label: 'Yönetim',
    icon: <UsergroupAddOutlined />,
    items: [{ key: '/accounts', label: 'Kullanıcılar', icon: <SafetyOutlined />, adminOnly: true }],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

type MainLayoutProps = {
  darkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
};

export default function MainLayout({ darkMode, onDarkModeChange }: MainLayoutProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [submenuTrigger, setSubmenuTrigger] = useState<'hover' | 'click'>('hover');
  const [openGroup, setOpenGroup] = useState<string>();

  // Menüde "İş Emirleri" yanında süren (açık/atanmış/devam eden) iş emri sayısı
  const { data: activeWorkOrders } = useQuery({
    queryKey: ['work-orders', 'kpi', 'active'],
    queryFn: () => listWorkOrders({ limit: 1, status: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] }),
    enabled: !!user,
  });
  const badges: Record<string, number | undefined> = { '/work-orders': activeWorkOrders?.total };

  const menuItems: MenuProps['items'] = NAV_GROUPS.map((group) => {
    const children = group.items
      .filter((item) => !item.adminOnly || user?.role === 'ADMIN')
      .map(({ key, label, icon }) => ({
        key,
        label: (
          <span className="app-sider-popup__link">
            <span className="app-sider-popup__icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
            {badges[key] ? (
              <span className="menu-badge" aria-label={`${badges[key]} süren iş emri`}>
                {badges[key]}
              </span>
            ) : null}
          </span>
        ),
      }));

    return {
      key: group.label,
      label: group.label,
      icon: group.icon,
      disabled: children.length === 0,
      children: [{
        type: 'group' as const,
        key: `${group.label}-links`,
        label: group.label,
        children,
      }],
      popupClassName: 'app-sider-popup',
    };
  });

  // /teams/5 adresinde de "Ekipler" seçili görünsün
  const selectedKey = ALL_ITEMS.find(
    (item) => pathname === item.key || pathname.startsWith(`${item.key}/`),
  )?.key;

  return (
    <Layout className="app-layout">
      <Sider
        collapsedWidth={92}
        collapsed
        trigger={null}
        className="app-sider"
        onPointerEnter={(event) => {
          setSubmenuTrigger(event.pointerType === 'mouse' ? 'hover' : 'click');
        }}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (!event.currentTarget.contains(nextTarget) && !nextTarget?.closest('.app-sider-popup')) {
            setOpenGroup(undefined);
          }
        }}
      >
        <Flex vertical align="center" className="app-sider__brand">
          <span className="app-sider__brand-mark">
            <img src={sidebarBrandImage} alt="Mini WFM" />
          </span>
        </Flex>
        <Menu
          mode="vertical"
          triggerSubMenuAction={submenuTrigger}
          subMenuCloseDelay={0.2}
          items={menuItems}
          openKeys={openGroup ? [openGroup] : []}
          onOpenChange={(keys) => setOpenGroup(keys[keys.length - 1])}
          selectedKeys={selectedKey ? [selectedKey] : []}
          onClick={({ key }) => {
            setOpenGroup(undefined);
            navigate(key);
          }}
        />
        <div className="app-sider__map" aria-hidden="true">
          <span className="app-sider__route" />
          <span className="app-sider__route-secondary" />
        </div>
      </Sider>

      <Layout>
        <Header className="app-header">
          <span className="app-header__waves app-header__waves--left" aria-hidden="true" />
          <span className="app-header__waves" aria-hidden="true" />
          {user && (
            <Flex align="center" className="app-header__actions">
              <Segmented<'light' | 'dark'>
                shape="round"
                role="radiogroup"
                aria-label="Renk modu"
                value={darkMode ? 'dark' : 'light'}
                onChange={(mode) => onDarkModeChange(mode === 'dark')}
                options={[
                  { value: 'light', icon: <SunOutlined aria-label="Aydınlık mod" />, title: 'Aydınlık mod' },
                  { value: 'dark', icon: <MoonOutlined aria-label="Karanlık mod" />, title: 'Karanlık mod' },
                ]}
              />
              <Button
                type="text"
                icon={<BellOutlined />}
                aria-label="Bildirimler"
                title="Bildirimler"
                onClick={() => navigate('/notifications')}
              />
              <Flex align="center" gap={12}>
                <Avatar size={44} className="app-header__avatar">
                  {user.username.charAt(0).toUpperCase()}
                </Avatar>
                <Flex vertical className="app-header__user">
                  <Typography.Text strong>{user.username}</Typography.Text>
                  <Typography.Text type="secondary">{ROLE_LABELS[user.role]}</Typography.Text>
                </Flex>
              </Flex>
              <Button type="text" onClick={logout} className="app-header__logout">
                Çıkış
              </Button>
            </Flex>
          )}
        </Header>

        <Content className="app-content" data-sidebar-menu-open={Boolean(openGroup)}>
          <div className="app-content__inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
