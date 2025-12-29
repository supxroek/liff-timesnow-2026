import { DEFAULT_APP_CONFIG } from "../../../config/app.config.js";

// ช่วยแปลงค่าตัวแปรเป็น boolean
function parseBool(value, fallback) {
  if (value == null || value === "") return fallback;
  if (value === true || value === false) return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}
// ช่วยลบเครื่องหมายทับท้าย (trailing slashes) ออกจาก URL
function normalizeBaseUrl(url) {
  if (!url) return "";
  return url.replace(/\/+$/, "");
}
// ช่วยดึงค่าพารามิเตอร์จาก URL query string
function getQueryParam(name) {
  const params = new URLSearchParams(globalThis.location.search);
  return params.get(name);
}

// ==============================================================================
// ฟังก์ชันสำหรับดึงการตั้งค่ารันไทม์ (Runtime Configuration)
export function getRuntimeConfig() {
  const fromGlobal = globalThis.APP_CONFIG || {};

  // ดึงค่าต่างๆ โดยให้คิวรีพารามิเตอร์มีความสำคัญสูงสุด
  const liffId =
    getQueryParam("liffId") ?? fromGlobal.liffId ?? DEFAULT_APP_CONFIG.liffId;
  const apiBaseUrl = normalizeBaseUrl(
    getQueryParam("apiBaseUrl") ??
      fromGlobal.apiBaseUrl ??
      DEFAULT_APP_CONFIG.apiBaseUrl
  );

  // แปลงค่าตัวแปรเป็น boolean สำหรับเช็คว่าต้องล็อกอินอัตโนมัติหรือไม่
  const requireLogin = parseBool(
    getQueryParam("requireLogin") ?? fromGlobal.requireLogin,
    DEFAULT_APP_CONFIG.requireLogin
  );
  // แปลงค่าตัวแปรเป็น boolean สำหรับเช็คโหมดดีบักหรือไม่
  const debug = parseBool(
    getQueryParam("debug") ?? fromGlobal.debug,
    DEFAULT_APP_CONFIG.debug
  );

  // รวม endpoints
  const endpoints = {
    ...DEFAULT_APP_CONFIG.endpoints,
    ...(fromGlobal.endpoints || undefined),
  };
  // ตรวจสอบการตั้งค่าและรวบรวมคำเตือน
  const warnings = [];
  if (!liffId)
    warnings.push(
      "ขาด LIFF ID: ตั้งค่า window.APP_CONFIG.liffId หรือใส่ ?liffId="
    );
  if (!apiBaseUrl)
    warnings.push(
      "ขาด API Base URL: ตั้งค่า window.APP_CONFIG.apiBaseUrl หรือใส่ ?apiBaseUrl="
    );

  // ส่งกลับการตั้งค่าและคำเตือน
  return {
    config: { liffId, apiBaseUrl, endpoints, requireLogin, debug },
    warnings,
  };
}

// ==============================================================================
// ฟังก์ชันสำหรับสร้าง URL ของ API
export function buildApiUrl(apiBaseUrl, path) {
  const base = normalizeBaseUrl(apiBaseUrl);
  const p = path || "";
  if (!base) return p;
  if (!p) return base;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
}
