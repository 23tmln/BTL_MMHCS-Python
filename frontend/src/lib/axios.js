import axios from "axios";

// In development, use relative paths so Vite's proxy handles the forwarding.
// This avoids mixed content issues (HTTPS frontend → HTTP backend).
// In production, API is served from the same origin.
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
