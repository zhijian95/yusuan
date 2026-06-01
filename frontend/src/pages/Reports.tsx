import { useEffect, useState, useCallback } from "react";
import { Card, Table, Typography, InputNumber, Space, Statistic, Row, Col, Tag, Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import api from "../api/client";
import { exportToExcel } from "../utils/exportUtils";

const { Title } = Typography;

interface SummaryItem {
  category_id: number;
  category_code: string;
  category_name: string;
  budget_amount: number;
  actual_amount: number;
  variance: number;
  execution_rate: number;
}

interface SummaryData {
  year: number;
  month: number | null;
  items: SummaryItem[];
  total_budget: number;
  total_actual: number;
  total_variance: number;
}

export default function Reports() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  const loadData = useCallback(() => {
    setLoading(true);
    api.get(`/budget/summary?year=${year}`).then((res) => {
      setData(res.data);
      setLoading(false);
    });
  }, [year]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = () => {
    if (!data || data.items.length === 0) return;
    const exportColumns = [
      { key: "category_code", title: "科目编码" },
      { key: "category_name", title: "科目名称" },
      { key: "budget_amount", title: "预算金额" },
      { key: "actual_amount", title: "实际支出" },
      { key: "variance", title: "差异" },
      { key: "execution_rate", title: "执行率(%)" },
    ];
    exportToExcel(
      data.items as unknown as Record<string, unknown>[],
      exportColumns,
      `预算执行报表_${year}年`,
      `${year}年预算执行`
    );
  };

  const columns = [
    { title: "科目编码", dataIndex: "category_code", key: "category_code", width: 120 },
    { title: "科目名称", dataIndex: "category_name", key: "category_name" },
    {
      title: "预算金额",
      dataIndex: "budget_amount",
      key: "budget_amount",
      width: 140,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: "实际支出",
      dataIndex: "actual_amount",
      key: "actual_amount",
      width: 140,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: "差异",
      dataIndex: "variance",
      key: "variance",
      width: 140,
      render: (v: number) => (
        <span style={{ color: v < 0 ? "#cf1322" : v > 0 ? "#3f8600" : "inherit" }}>
          {v >= 0 ? "+" : ""}¥{v.toLocaleString()}
        </span>
      ),
    },
    {
      title: "执行率",
      dataIndex: "execution_rate",
      key: "execution_rate",
      width: 120,
      render: (v: number) => (
        <Tag color={v > 100 ? "red" : v > 80 ? "orange" : "green"}>{v}%</Tag>
      ),
    },
  ];

  const chartData = data?.items
    .filter((i) => i.budget_amount > 0 || i.actual_amount > 0)
    .slice(0, 15)
    .map((i) => ({
      name: i.category_name,
      预算: i.budget_amount,
      实际: i.actual_amount,
    })) || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>预算执行报表</Title>
        <Space>
          <span>年度: </span>
          <InputNumber value={year} onChange={(v) => setYear(v || new Date().getFullYear())} min={2020} max={2030} />
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!data || data.items.length === 0}>
            导出Excel
          </Button>
        </Space>
      </div>

      {data && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card><Statistic title="预算总额" value={data.total_budget.toLocaleString()} precision={2} prefix="¥" /></Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card><Statistic title="实际支出" value={data.total_actual.toLocaleString()} precision={2} prefix="¥" /></Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="差异"
                  value={data.total_variance.toLocaleString()}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: data.total_variance < 0 ? "#cf1322" : "#3f8600" }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="科目预算执行对比" style={{ marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="预算" fill="#8884d8" />
                <Bar dataKey="实际" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="明细数据">
            <Table dataSource={data.items} columns={columns} rowKey="category_id" loading={loading} size="middle" />
          </Card>
        </>
      )}
    </div>
  );
}
