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
    dev: "2006755947-ToZa51HW",
    prod: "2006755947-ToZa51HW",
  },
};

function getCurrentEnvironment() {
  return globalThis.location.hostname === "localhost" ? "dev" : "prod";
}

export function getBaseUrl() {
  return BASE_URLS[getCurrentEnvironment()];
}

export function getLiffId(feature = "default") {
  return LIFF_IDS[feature][getCurrentEnvironment()];
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
  return {
    ...DEFAULT_APP_CONFIG,
    ...user,
    endpoints: {
      ...DEFAULT_APP_CONFIG.endpoints,
      ...user.endpoints,
    },
  };
}

// ตั้งค่า globalThis.APP_CONFIG ถ้ายังไม่ได้ตั้งค่า หรือเพื่อให้แน่ใจว่า
// โครงสร้างและช่องทาง (endpoints) ถูกผสานอย่างถูกต้อง
globalThis.APP_CONFIG = getMergedAppConfig(globalThis.APP_CONFIG || {});
