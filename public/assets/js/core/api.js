import { buildApiUrl } from "./config.js";

// ฟังก์ชันสำหรับทำคำขอ API (API Request Function)

// ฟังก์ชันช่วยอ่าน JSON อย่างปลอดภัย
async function readJsonSafe(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ฟังก์ชันหลักสำหรับทำคำขอ API
export async function apiRequest({
  apiBaseUrl, // URL ของ API
  path, // เส้นทางของ API
  method, // วิธีการ HTTP (GET, POST, etc.)
  body, // เนื้อหาของคำขอ
  headers, // หัวข้อของคำขอ (ถ้ามี)
  accessToken, // โทเค็นการเข้าถึง (ถ้ามี)
}) {
  const url = buildApiUrl(apiBaseUrl, path);

  const requestHeaders = {
    "Content-Type": "application/json",
    ...(headers || undefined),
  };

  // เพิ่ม Authorization header ถ้ามี accessToken
  if (accessToken) requestHeaders.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(url, {
    method: method || "GET",
    headers: requestHeaders,
    body: body == null ? undefined : JSON.stringify(body),
  });

  const json = await readJsonSafe(res);

  // ตรวจสอบสถานะการตอบกลับ
  if (!res.ok) {
    const message =
      (json && (json.message || json.error || json.msg)) ||
      `Request failed (${res.status})`;
    return { ok: false, status: res.status, data: json, error: message };
  }

  // คำขอสำเร็จ
  return { ok: true, status: res.status, data: json };
}
