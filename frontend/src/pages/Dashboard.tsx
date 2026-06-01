import { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Typography, Spin } from "antd";
import {
  ApartmentOutlined,
  AccountBookOutlined,
  DollarOutlined,
  PercentageOutlined,
} from "@ant-design/icons";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import api from "../api/client";

const { Title } = Typography;
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#a4de6c", "#d0ed57"];

interface Stats {
  total_categories: number;
  total_budget_amount: number;
  total_expense_amount: number;
  overall_execution_rate: number;
  monthly_trend: { month: number; budget: number; actual: number; rate: number }[];
  top_expense_categories: { category_id: number; name: string; amount: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/reports/dashboard?year=${new Date().getFullYear()}`).then((res) => {
      setStats(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spin size="large" style={{ display: "block", margin: "100px auto" }} />;
  if (!stats) return null;

  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const trendData = stats.monthly_trend.map((item) => ({
    ...item,
    name: monthNames[item.month - 1] || `${item.month}月`,
  }));

  const pieData = stats.top_expense_categories.map((item) => ({
    name: item.name,
    value: item.amount,
  }));

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>仪表盘</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="预算科目数" value={stats.total_categories} prefix={<ApartmentOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="年度预算总额" value={stats.total_budget_amount.toLocaleString()} prefix={<AccountBookOutlined />} precision={2} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="年度实际支出" value={stats.total_expense_amount.toLocaleString()} prefix={<DollarOutlined />} precision={2} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="执行率"
              value={stats.overall_execution_rate}
              suffix="%"
              prefix={<PercentageOutlined />}
              valueStyle={{ color: stats.overall_execution_rate > 100 ? "#cf1322" : "#3f8600" }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={14}>
          <Card title="月度预算 vs 实际支出">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="budget" name="预算" fill="#8884d8" />
                <Bar dataKey="actual" name="实际" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="支出分类占比">
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={({ name, percent = 0 }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
