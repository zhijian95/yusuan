import axios from "axios";
import { message } from "antd";

const api = axios.create({
  baseURL: "http://localhost:8001/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    } else {
      const msg = error.response?.data?.detail || error.message || "请求失败";
      message.error(msg);
    }
    return Promise.reject(error);
  }
);

export default api;
