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

// ฟังก์ชันช่วยเตรียม headers
function prepareHeaders(headers, idToken) {
  const requestHeaders = {
    ...(headers || undefined),
  };

  if (idToken) requestHeaders.Authorization = `Bearer ${idToken}`;
  if (!requestHeaders.Accept) requestHeaders.Accept = "application/json";

  return requestHeaders;
}

// ฟังก์ชันช่วยเตรียม body และปรับ headers
function prepareBodyAndHeaders(body, requestHeaders) {
  const updatedHeaders = { ...requestHeaders };
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  if (isFormData) {
    delete updatedHeaders["Content-Type"];
  } else if (!updatedHeaders["Content-Type"]) {
    updatedHeaders["Content-Type"] = "application/json";
  }

  let requestBody;
  if (body == null) {
    requestBody = undefined;
  } else if (isFormData) {
    requestBody = body;
  } else {
    requestBody = JSON.stringify(body);
  }

  return { requestBody, requestHeaders: updatedHeaders };
}

// ฟังก์ชันช่วยจัดการการตอบกลับ
async function handleResponse(res) {
  const json = await readJsonSafe(res);

  if (!res.ok) {
    if (
      res.status === 304 &&
      json &&
      (json.status === "success" ||
        Array.isArray(json.data) ||
        Array.isArray(json))
    ) {
      const payload = Array.isArray(json) ? json : json.data || json;
      return { ok: true, status: res.status, data: payload };
    }

    const message =
      (json && (json.message || json.error || json.msg)) ||
      `Request failed (${res.status})`;
    return { ok: false, status: res.status, data: json, error: message };
  }

  return { ok: true, status: res.status, data: json };
}

// ฟังก์ชันหลักสำหรับทำคำขอ API
export async function apiRequest({
  apiBaseUrl, // URL ของ API
  path, // เส้นทางของ API
  method, // วิธีการ HTTP (GET, POST, etc.)
  body, // เนื้อหาของคำขอ
  headers, // หัวข้อของคำขอ (ถ้ามี)
  idToken, // โทเค็นการเข้าถึง (ถ้ามี)
}) {
  const url = buildApiUrl(apiBaseUrl, path);

  const requestHeaders = prepareHeaders(headers, idToken);
  const requestBody = prepareBodyAndHeaders(body, requestHeaders);

  try {
    const res = await fetch(url, {
      method: method || "GET",
      headers: requestHeaders,
      body: requestBody,
      cache: "no-store",
    });

    return await handleResponse(res);
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || String(err),
    };
  }
}
