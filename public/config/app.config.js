// การตั้งค่าส่วนกลางของแอปพลิเคชัน
// ตัวอย่างการเขียนทับค่าเริ่มต้นผ่านตัวแปร globalThis.APP_CONFIG
// หรือตัวแปรใน URL query parameters เช่น:
// - ?liffId=YOUR_LIFF_ID
// - ?apiBaseUrl=https://api.example.com
// - ?debug=1
// - ?requireLogin=0

// Helper functions
const BASE_URLS = {
  dev: "http://localhost:5000/api",
  prod: "https://api.example.com",
};

const LIFF_IDS = {
  default: {
    dev: "2006755947-ToZa51HW",
    prod: "2006755947-ToZa51HW",
  },
  register: {
    dev: "2006755947-ToZa51HW",
    prod: "2006755947-ToZa51HW",
  },
  forgetTime: {
    dev: "2006755947-3C7TBS5B",
    prod: "2006755947-3C7TBS5B",
  },
};

function getCurrentEnvironment() {
  return globalThis.location.hostname === "localhost" ? "dev" : "prod";
}

export function getBaseUrl() {
  return BASE_URLS[getCurrentEnvironment()];
}

// ตรวจสอบฟีเจอร์ของหน้า จากเส้นทางของหน้า (เช่น '/register' -> 'register', '/forget-time' -> 'forgetTime')
function detectFeatureFromPath() {
  const path = globalThis.location?.pathname || "";
  // ลบ '/' ท้ายและแยกส่วนท้ายของเส้นทาง
  const seg = path.replace(/\/+$/, "").split("/").findLast(Boolean) || "";
  const normalized = seg.toLowerCase();
  if (normalized === "register") return "register";
  if (normalized === "forget-time") return "forgetTime";
  // คืนเริ่มต้นเป็น 'default' ถ้าไม่ตรงกับฟีเจอร์ใดๆ
  return "default";
}

// ดึง LIFF ID ตามฟีเจอร์และสภาพแวดล้อมปัจจุบัน
export function getLiffId(feature) {
  const usedFeature = feature || detectFeatureFromPath() || "default";
  const ids = LIFF_IDS[usedFeature] || LIFF_IDS.default;
  return ids[getCurrentEnvironment()];
}

export const DEFAULT_APP_CONFIG = {
  liffId: getLiffId(),
  apiBaseUrl: getBaseUrl(),
  endpoints: {
    company: "/company",
    register: "/register",
    forgetTime: "/forget-time",
  },
  requireLogin: true,
  debug: false,
};

// รวมค่าเริ่มต้นกับค่าที่กำหนดใน globalThis.APP_CONFIG
// คืนค่าวัตถุการตั้งค่าที่รวมแล้ว โดยให้ค่าที่ผู้ใช้กำหนด (globalThis.APP_CONFIG)
// มีลำดับความสำคัญสูงสุดเหนือค่าเริ่มต้น
export function getMergedAppConfig(overrides = {}) {
  const user = overrides || {};
  const merged = {
    ...DEFAULT_APP_CONFIG,
    ...user,
    endpoints: {
      ...DEFAULT_APP_CONFIG.endpoints,
      ...user.endpoints,
    },
  };

  // If liffId was not provided by the user overrides, compute appropriate liffId
  if (!user.liffId) {
    merged.liffId = getLiffId(user.feature || undefined);
  }

  return merged;
}

// ตั้งค่า globalThis.APP_CONFIG ถ้ายังไม่ได้ตั้งค่า หรือเพื่อให้แน่ใจว่า
// โครงสร้างและช่องทาง (endpoints) ถูกผสานอย่างถูกต้อง
// Initialize global config (allow user overrides via globalThis.APP_CONFIG)
globalThis.APP_CONFIG = getMergedAppConfig(globalThis.APP_CONFIG || {});
