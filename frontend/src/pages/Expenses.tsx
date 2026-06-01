import { useEffect, useState, useCallback } from "react";
import { Card, Table, Button, Modal, Form, InputNumber, Select, Input, DatePicker, Space, Popconfirm, Typography, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { exportToExcel } from "../utils/exportUtils";

const { Title } = Typography;

interface ExpenseItem {
  id: number;
  category_id: number;
  category_name: string;
  category_code: string;
  amount: number;
  expense_date: string;
  description: string;
  vendor: string;
  document_no: string;
  recorded_by: number;
  recorder_name: string;
  created_at: string;
}

interface Category {
  id: number;
  code: string;
  name: string;
}

export default function Expenses() {
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseItem | null>(null);
  const [form] = Form.useForm();
  const { isAdmin } = useAuth();
  const canEdit = isAdmin;

  const loadData = useCallback(() => {
    setLoading(true);
    api.get("/expenses?limit=200").then((res) => {
      setItems(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    api.get("/categories/all").then((res) => {
      setCategories(res.data);
    });
  }, []);

  const handleExport = () => {
    if (items.length === 0) return;
    const exportColumns = [
      { key: "expense_date", title: "日期" },
      { key: "category_code", title: "科目编码" },
      { key: "category_name", title: "科目名称" },
      { key: "amount", title: "金额" },
      { key: "vendor", title: "供应商" },
      { key: "description", title: "描述" },
      { key: "document_no", title: "凭证号" },
      { key: "recorder_name", title: "录入人" },
    ];
    exportToExcel(
      items as unknown as Record<string, unknown>[],
      exportColumns,
      `支出记录_${new Date().toISOString().slice(0, 10)}`,
      "支出记录"
    );
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const data = { ...values, expense_date: values.expense_date.format("YYYY-MM-DD") };
    try {
      if (editing) {
        await api.put(`/expenses/${editing.id}`, data);
        message.success("更新成功");
      } else {
        await api.post("/expenses", data);
        message.success("创建成功");
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      loadData();
    } catch { /* handled */ }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/expenses/${id}`);
    message.success("删除成功");
    loadData();
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ expense_date: dayjs() });
    setModalOpen(true);
  };

  const openEdit = (record: ExpenseItem) => {
    setEditing(record);
    form.setFieldsValue({ ...record, expense_date: dayjs(record.expense_date) });
    setModalOpen(true);
  };

  const columns = [
    { title: "日期", dataIndex: "expense_date", key: "expense_date", width: 100 },
    { title: "科目编码", dataIndex: "category_code", key: "category_code", width: 100 },
    { title: "科目名称", dataIndex: "category_name", key: "category_name" },
    {
      title: "金额",
      dataIndex: "amount",
      key: "amount",
      width: 130,
      render: (v: number) => <span style={{ fontWeight: 600 }}>¥{v.toLocaleString()}</span>,
    },
    { title: "供应商", dataIndex: "vendor", key: "vendor", width: 120 },
    { title: "描述", dataIndex: "description", key: "description", ellipsis: true },
    { title: "凭证号", dataIndex: "document_no", key: "document_no", width: 100 },
    { title: "录入人", dataIndex: "recorder_name", key: "recorder_name", width: 100 },
    ...(canEdit
      ? [
          {
            title: "操作",
            key: "action",
            width: 150,
            render: (_: unknown, record: ExpenseItem) => (
              <Space>
                <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
                <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
                  <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];

  const categoryOptions = categories.map((c) => ({
    label: `${c.code} - ${c.name}`,
    value: c.id,
  }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>支出记录</Title>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={items.length === 0}>
            导出Excel
          </Button>
          {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增支出</Button>}
        </Space>
      </div>
      <Card>
        <Table dataSource={items} columns={columns} rowKey="id" loading={loading} size="middle" />
      </Card>

      <Modal
        title={editing ? "编辑支出" : "新增支出"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="category_id" label="预算科目" rules={[{ required: true }]}>
            <Select placeholder="选择科目" options={categoryOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} min={0.01} precision={2} placeholder="请输入金额" />
          </Form.Item>
          <Form.Item name="expense_date" label="支出日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="vendor" label="供应商">
            <Input placeholder="如: XX科技有限公司" />
          </Form.Item>
          <Form.Item name="document_no" label="凭证号">
            <Input placeholder="如: INV-2024-001" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
