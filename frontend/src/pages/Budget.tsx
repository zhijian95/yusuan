import { useEffect, useState, useCallback } from "react";
import { Card, Table, Button, Modal, Form, InputNumber, Select, Input, Space, Popconfirm, Typography, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined } from "@ant-design/icons";
import api from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { exportToExcel } from "../utils/exportUtils";

const { Title } = Typography;

interface BudgetItem {
  id: number;
  category_id: number;
  category_name: string;
  category_code: string;
  year: number;
  month: number | null;
  budget_amount: number;
  notes: string;
  created_by: number;
  creator_name: string;
  created_at: string;
}

interface Category {
  id: number;
  code: string;
  name: string;
}

export default function Budget() {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [form] = Form.useForm();
  const [year, setYear] = useState(new Date().getFullYear());
  const { isAdmin } = useAuth();
  const canEdit = isAdmin;

  const loadData = useCallback(() => {
    setLoading(true);
    api.get(`/budget?year=${year}`).then((res) => {
      setItems(res.data);
      setLoading(false);
    });
  }, [year]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    api.get("/categories/all").then((res) => {
      setCategories(res.data);
    });
  }, []);

  const handleExport = () => {
    if (items.length === 0) return;
    const exportColumns = [
      { key: "category_code", title: "科目编码" },
      { key: "category_name", title: "科目名称" },
      { key: "month", title: "月份", render: (v: number | null) => (v ? `${v}月` : "全年") },
      { key: "budget_amount", title: "预算金额" },
      { key: "notes", title: "备注" },
      { key: "creator_name", title: "录入人" },
    ];
    exportToExcel(
      items as unknown as Record<string, unknown>[],
      exportColumns,
      `预算编制_${year}年`,
      `${year}年预算`
    );
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/budget/${editing.id}`, values);
        message.success("更新成功");
      } else {
        await api.post("/budget", { ...values, year });
        message.success("创建成功");
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      loadData();
    } catch { /* handled */ }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/budget/${id}`);
    message.success("删除成功");
    loadData();
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: BudgetItem) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const columns = [
    { title: "科目编码", dataIndex: "category_code", key: "category_code", width: 100 },
    { title: "科目名称", dataIndex: "category_name", key: "category_name" },
    { title: "月份", dataIndex: "month", key: "month", width: 80, render: (v: number | null) => v ? `${v}月` : "全年" },
    {
      title: "预算金额",
      dataIndex: "budget_amount",
      key: "budget_amount",
      width: 150,
      render: (v: number) => <span style={{ fontWeight: 600 }}>¥{v.toLocaleString()}</span>,
    },
    { title: "备注", dataIndex: "notes", key: "notes", ellipsis: true },
    { title: "录入人", dataIndex: "creator_name", key: "creator_name", width: 100 },
    ...(canEdit
      ? [
          {
            title: "操作",
            key: "action",
            width: 150,
            render: (_: unknown, record: BudgetItem) => (
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
        <Title level={4} style={{ margin: 0 }}>预算编制</Title>
        <Space>
          <span>年度: </span>
          <InputNumber value={year} onChange={(v) => setYear(v || new Date().getFullYear())} min={2020} max={2030} />
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={items.length === 0}>
            导出Excel
          </Button>
          {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增预算</Button>}
        </Space>
      </div>
      <Card>
        <Table dataSource={items} columns={columns} rowKey="id" loading={loading} size="middle" />
      </Card>

      <Modal
        title={editing ? "编辑预算" : "新增预算"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="category_id" label="预算科目" rules={[{ required: true }]}>
            <Select placeholder="选择科目" options={categoryOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="month" label="月份（留空为全年预算）">
            <Select allowClear placeholder="选择月份" options={Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}月`, value: i + 1 }))} />
          </Form.Item>
          <Form.Item name="budget_amount" label="预算金额" rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} min={0} precision={2} placeholder="请输入金额" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
