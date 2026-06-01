import React, { useState } from "react";
import { Layout as AntLayout, Menu, Avatar, Dropdown, Typography } from "antd";
import {
  DashboardOutlined,
  ApartmentOutlined,
  EditOutlined,
  DollarOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();

  const menuItems = [
    { key: "/", icon: <DashboardOutlined />, label: "仪表盘" },
    { key: "/categories", icon: <ApartmentOutlined />, label: "预算科目" },
    { key: "/budget", icon: <EditOutlined />, label: "预算编制" },
    { key: "/expenses", icon: <DollarOutlined />, label: "支出记录" },
    { key: "/reports", icon: <BarChartOutlined />, label: "报表分析" },
    ...(isAdmin ? [{ key: "/admin", icon: <SettingOutlined />, label: "系统管理" }] : []),
  ];

  const userMenu = {
    items: [
      { key: "info", label: `${user?.real_name || user?.username} (${user?.role})`, disabled: true },
      { type: "divider" as const },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "退出登录",
        onClick: () => {
          logout();
          navigate("/login");
        },
      },
    ],
  };

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text strong style={{ color: "#fff", fontSize: collapsed ? 14 : 18, whiteSpace: "nowrap" }}>
            {collapsed ? "预算" : "预算管理系统"}
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: "0 24px",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
            style: { fontSize: 18, cursor: "pointer" },
            onClick: () => setCollapsed(!collapsed),
          })}
          <Dropdown menu={userMenu} placement="bottomRight">
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar size={32} icon={<UserOutlined />} />
              <Text>{user?.real_name || user?.username}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, background: "#fff", borderRadius: 8, padding: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
