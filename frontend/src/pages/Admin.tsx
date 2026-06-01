import { useEffect, useState, useCallback } from "react";
import { Card, Table, Button, Modal, Form, Input, Select, Space, Popconfirm, Tabs, Typography, Tag, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import api from "../api/client";

const { Title } = Typography;

interface User {
  id: number;
  username: string;
  real_name: string;
  department: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface AuditLog {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  resource: string;
  resource_id: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form] = Form.useForm();

  const loadUsers = useCallback(() => {
    setLoading(true);
    api.get("/admin/users").then((res) => {
      setUsers(res.data);
      setLoading(false);
    });
  }, []);

  const loadLogs = useCallback(() => {
    api.get("/admin/logs?limit=100").then((res) => {
      setLogs(res.data);
    });
  }, []);

  useEffect(() => { loadUsers(); loadLogs(); }, [loadUsers, loadLogs]);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/admin/users/${editing.id}`, values);
        message.success("更新成功");
      } else {
        await api.post("/admin/users", values);
        message.success("创建成功");
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      loadUsers();
    } catch { /* handled */ }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/admin/users/${id}`);
    message.success("删除成功");
    loadUsers();
  };

  const userColumns = [
    { title: "用户名", dataIndex: "username", key: "username" },
    { title: "姓名", dataIndex: "real_name", key: "real_name" },
    { title: "部门", dataIndex: "department", key: "department" },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      render: (v: string) => {
        const colors: Record<string, string> = { admin: "red", budget_manager: "blue", viewer: "green" };
        return <Tag color={colors[v] || "default"}>{v}</Tag>;
      },
    },
    {
      title: "状态",
      dataIndex: "is_active",
      key: "is_active",
      render: (v: boolean) => (v ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>),
    },
    { title: "创建时间", dataIndex: "created_at", key: "created_at", render: (v: string) => v?.split("T")[0] },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_: unknown, record: User) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => { setEditing(record); form.setFieldsValue({ role: record.role, real_name: record.real_name, department: record.department, is_active: record.is_active }); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColumns = [
    { title: "时间", dataIndex: "created_at", key: "created_at", width: 160, render: (v: string) => new Date(v).toLocaleString() },
    { title: "用户", dataIndex: "username", key: "username", width: 100 },
    { title: "操作", dataIndex: "action", key: "action", width: 80 },
    { title: "资源", dataIndex: "resource", key: "resource", width: 120 },
    { title: "资源ID", dataIndex: "resource_id", key: "resource_id", width: 80 },
    { title: "IP", dataIndex: "ip_address", key: "ip_address", width: 120 },
    { title: "详情", dataIndex: "details", key: "details", ellipsis: true },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>系统管理</Title>
      <Tabs
        defaultActiveKey="users"
        items={[
          {
            key: "users",
            label: "用户管理",
            children: (
              <Card
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ role: "viewer" }); setModalOpen(true); }}>新增用户</Button>}
              >
                <Table dataSource={users} columns={userColumns} rowKey="id" loading={loading} size="middle" />
              </Card>
            ),
          },
          {
            key: "logs",
            label: "操作日志",
            children: (
              <Card>
                <Table dataSource={logs} columns={logColumns} rowKey="id" size="middle" />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "编辑用户" : "新增用户"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {!editing && (
            <>
              <Form.Item name="username" label="用户名" rules={[{ required: true, min: 3 }]}>
                <Input placeholder="请输入用户名" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
                <Input.Password placeholder="请输入密码（至少6位）" />
              </Form.Item>
            </>
          )}
          <Form.Item name="real_name" label="姓名">
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="如: 财务部" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "管理员 (admin)", value: "admin" },
                { label: "预算管理员 (budget_manager)", value: "budget_manager" },
                { label: "查看者 (viewer)", value: "viewer" },
              ]}
            />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label="状态">
              <Select
                options={[
                  { label: "启用", value: true },
                  { label: "禁用", value: false },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
