// การตั้งค่าส่วนกลางของแอปพลิเคชัน
// ตัวอย่างการเขียนทับค่าเริ่มต้นผ่านตัวแปร globalThis.APP_CONFIG
// หรือตัวแปรใน URL query parameters เช่น:
// - ?liffId=YOUR_LIFF_ID
// - ?apiBaseUrl=https://api.example.com
// - ?debug=1
// - ?requireLogin=0

export const DEFAULT_APP_CONFIG = {
  liffId: "2006755947-k5nn7jUA",
  apiBaseUrl: "http://localhost:5000/api",
  endpoints: {
    register: "/liff/register",
    forgetTime: "/liff/forget-time",
  },
  requireLogin: true,
  debug: false,
};

// รวมค่าเริ่มต้นกับค่าที่กำหนดใน globalThis.APP_CONFIG
globalThis.APP_CONFIG = {
  ...globalThis.APP_CONFIG,
  ...DEFAULT_APP_CONFIG,
  endpoints: {
    ...DEFAULT_APP_CONFIG.endpoints,
    ...globalThis.APP_CONFIG?.endpoints,
  },
};
