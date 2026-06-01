import { useEffect, useState, useCallback } from "react";
import {
  Card, Button, Modal, Form, Input, Select, Space, Popconfirm, Typography, Tag,
  Tree, Spin, message, Segmented, Tooltip, Empty
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, FolderOutlined,
  FileTextOutlined, ReloadOutlined, PlusSquareOutlined, ApartmentOutlined
} from "@ant-design/icons";
import type { DataNode } from "antd/es/tree";
import api from "../api/client";
import { useAuth } from "../contexts/AuthContext";

const { Title } = Typography;

interface Category {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  level: number;
  description: string;
  sort_order: number;
  is_active: boolean;
  category_type: string;
  control_type: string;
  is_leaf: boolean;
  tags: string | null;
  children: Category[];
}

const typeIcons: Record<string, React.ReactNode> = {
  revenue: <span style={{ color: "#3f8600" }}>💰</span>,
  expense: <span style={{ color: "#cf1322" }}>📋</span>,
  transfer: <span style={{ color: "#1677ff" }}>🔄</span>,
};

const typeColors: Record<string, string> = {
  revenue: "green",
  expense: "red",
  transfer: "blue",
};

const typeLabels: Record<string, string> = {
  revenue: "收入类",
  expense: "支出类",
  transfer: "结转类",
};

const controlLabels: Record<string, string> = {
  department: "部门可控",
  company: "公司统筹",
};

export default function Categories() {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [meta, setMeta] = useState<{ category_types: { value: string; label: string }[]; control_types: { value: string; label: string }[]; max_level: number } | null>(null);
  const [form] = Form.useForm();
  const { isAdmin } = useAuth();
  const canEdit = isAdmin;

  const loadMeta = useCallback(() => {
    api.get("/categories/meta").then((res) => setMeta(res.data));
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    api.get("/categories/all").then((res) => {
      const cats: Category[] = res.data;
      setAllCategories(cats);
      const filtered = filterType === "all" ? cats : cats.filter((c) => c.category_type === filterType);
      const tree = buildTreeData(filtered);
      setTreeData(tree);
      setLoading(false);
    });
  }, [filterType]);

  useEffect(() => { loadData(); loadMeta(); }, [loadData, loadMeta]);

  const buildTreeData = (categories: Category[]): DataNode[] => {
    const roots = categories.filter((c) => !c.parent_id || c.level === 1);
    const map: Record<number, Category[]> = {};
    categories.forEach((c) => {
      if (c.parent_id) {
        if (!map[c.parent_id]) map[c.parent_id] = [];
        map[c.parent_id].push(c);
      }
    });
    const build = (nodes: Category[]): DataNode[] =>
      nodes
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((cat) => {
          const children = map[cat.id] || [];
          return {
            key: cat.id,
            title: renderTitle(cat),
            icon: cat.is_leaf || children.length === 0
              ? <FileTextOutlined />
              : <FolderOutlined style={{ color: "#faad14" }} />,
            children: children.length > 0 ? build(children) : undefined,
            isLeaf: cat.is_leaf && children.length === 0,
          };
        });
    return build(roots);
  };

  const renderTitle = (cat: Category) => (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", paddingRight: 16 }}
      onDoubleClick={() => canEdit && openEdit(cat)}
    >
      {typeIcons[cat.category_type] || typeIcons.expense}
      <span style={{ fontWeight: 500 }}>{cat.name}</span>
      <Tag color="default" style={{ fontFamily: "monospace", fontSize: 11 }}>{cat.code}</Tag>
      <Tag color={typeColors[cat.category_type]}>{typeLabels[cat.category_type] || cat.category_type}</Tag>
      {cat.control_type === "company" && <Tag color="purple">{controlLabels.company}</Tag>}
      {!cat.is_active && <Tag color="red">已禁用</Tag>}
      {cat.tags && <span style={{ color: "#888", fontSize: 11 }}>{cat.tags}</span>}
      {canEdit && (
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="在此科目下添加子科目">
            <Button
              type="link" size="small"
              icon={<PlusSquareOutlined />}
              onClick={() => openCreateWithParent(cat.id)}
              disabled={(cat.level || 0) >= (meta?.max_level || 6)}
            />
          </Tooltip>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(cat)} />
          <Popconfirm title="确定删除此科目及其子科目?" onConfirm={() => handleDelete(cat.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      )}
    </div>
  );

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, values);
        message.success("更新成功");
      } else {
        const payload = { ...values };
        if (selectedParentId) payload.parent_id = selectedParentId;
        await api.post("/categories", payload);
        message.success("创建成功");
      }
      setModalOpen(false);
      setEditing(null);
      setSelectedParentId(null);
      form.resetFields();
      loadData();
      loadMeta();
    } catch { /* handled */ }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/categories/${id}`);
    message.success("删除成功");
    loadData();
    loadMeta();
  };

  const openCreate = () => {
    setEditing(null);
    setSelectedParentId(null);
    form.resetFields();
    form.setFieldsValue({ category_type: "expense", control_type: "department" });
    setModalOpen(true);
  };

  const openCreateWithParent = (parentId: number) => {
    setEditing(null);
    setSelectedParentId(parentId);
    form.resetFields();
    api.get(`/categories/next-code?parent_id=${parentId}`).then((res) => {
      form.setFieldsValue({
        code: res.data.code,
        category_type: "expense",
        control_type: "department",
      });
    }).catch(() => {
      form.setFieldsValue({ category_type: "expense", control_type: "department" });
    });
    setModalOpen(true);
  };

  const openEdit = (record: Category) => {
    setEditing(record);
    setSelectedParentId(null);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  if (loading && treeData.length === 0) {
    return <Spin size="large" style={{ display: "block", margin: "100px auto" }} />;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>预算科目管理</Title>
          <Tag color="blue">{allCategories.length} 个科目</Tag>
        </Space>
        <Space>
          <Segmented
            options={[
              { label: "全部", value: "all" },
              { label: "💰 收入", value: "revenue" },
              { label: "📋 支出", value: "expense" },
              { label: "🔄 结转", value: "transfer" },
            ]}
            value={filterType}
            onChange={(v) => setFilterType(v as string)}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { loadData(); loadMeta(); }} />
          {canEdit && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增一级科目
            </Button>
          )}
        </Space>
      </div>

      <Card styles={{ body: { padding: 12 } }}>
        {treeData.length > 0 ? (
          <Tree
            showIcon
            blockNode
            defaultExpandAll
            treeData={treeData}
            style={{ fontSize: 14 }}
            titleRender={(node) => node.title as React.ReactNode}
          />
        ) : (
          <Empty description="暂无科目数据，请先创建一级科目" />
        )}
      </Card>

      <Modal
        title={editing ? "编辑科目" : selectedParentId ? "新增子科目" : "新增一级科目"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); setSelectedParentId(null); }}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code" label="科目编码"
            rules={[
              { required: true },
              { pattern: /^\d{4}(\.\d{2}){0,5}$/, message: "格式: XXXX 或 XXXX.XX.XX... 最多6级" },
            ]}
            help="格式: 一级4位数字，二级起每级2位数字用 . 分隔。选择父级科目后自动生成。"
          >
            <Input placeholder="如: 6001.01.01" />
          </Form.Item>
          <Form.Item name="name" label="科目名称" rules={[{ required: true }]}>
            <Input placeholder="如: 办公费" />
          </Form.Item>
          {!editing && (
            <>
              {selectedParentId && (
                <Form.Item label="父级科目">
                  <Input disabled value={allCategories.find((c) => c.id === selectedParentId)?.name || ""} />
                </Form.Item>
              )}
            </>
          )}
          <Form.Item name="category_type" label="科目类别" rules={[{ required: true }]}>
            <Select
              options={meta?.category_types.map((t) => ({ label: `${t.label} (${t.value})`, value: t.value })) || [
                { label: "收入类", value: "revenue" },
                { label: "支出类", value: "expense" },
                { label: "内部结转", value: "transfer" },
              ]}
            />
          </Form.Item>
          <Form.Item name="control_type" label="管控方式" rules={[{ required: true }]}>
            <Select
              options={meta?.control_types.map((t) => ({ label: t.label, value: t.value })) || [
                { label: "部门可控", value: "department" },
                { label: "公司统筹", value: "company" },
              ]}
            />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Input placeholder="如: 研发专用,Q4专项 (逗号分隔)" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
