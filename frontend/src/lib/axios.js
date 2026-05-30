import axios from "axios";

/**
 * axios.js
 * Cấu hình thiết lập mặc định cho instance của thư viện Axios để gọi API.
 * 
 * - Môi trường Dev (cục bộ): Sử dụng proxy của Vite để tránh lỗi CORS và lấy cùng port.
 * - Môi trường Prod: API được phục vụ từ cùng Origin (tên miền).
 */
const getApiBaseUrl = () => {
  // Always use relative path — Vite proxy (dev) or same-origin server (prod) will handle it
  return "";
};

const API_BASE_URL = getApiBaseUrl();

export const axiosInstance = axios.create({
  baseURL: `/api`,
  withCredentials: true,
});

// Utility function to convert relative image URLs to absolute backend URLs
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  if (imagePath.startsWith("data:")) {
    return imagePath;
  }
  // Relative path — will work via Vite proxy in dev, same-origin in prod
  return imagePath;
};
