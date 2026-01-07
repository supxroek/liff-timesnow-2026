import { getRuntimeConfig } from "../core/config.js";
import { apiRequest } from "../core/api.js";
import { showToast } from "../core/ui.js";

// ==============================================================================
//                ฟังก์ชันช่วยเหลือ (Helpers)
// ==============================================================================
// Helper: ดึง token จาก URL query parameters
function getToken() {
  const urlParams = new URLSearchParams(globalThis.location.search);
  return urlParams.get("token");
}

// Helper: ถอดรหัส JWT token แบบง่ายๆ (ไม่ตรวจสอบลายเซ็นต์)
function decodeToken(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replaceAll("-", "+").replaceAll("_", "/");
    const jsonPayload = decodeURIComponent(
      globalThis
        .atob(base64)
        .split("")
        .map(
          (c) => "%" + ("00" + (c.codePointAt(0) ?? 0).toString(16)).slice(-2)
        )
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Helper: ตั้งค่าข้อความในองค์ประกอบ HTML
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "-";
}
// Helper: แสดง/ซ่อน องค์ประกอบ HTML
function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}
// Helper: แสดง/ซ่อน องค์ประกอบ HTML
function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}
// แสดงสถานะกำลังโหลด
function showLoading() {
  hideElement("action-buttons");
  hideElement("user-info");
  hideElement("result");
  showElement("loading");
  setText("main-title", "กำลังดำเนินการ...");
  setText("subtitle", "กรุณารอสักครู่");
}
// แสดงข้อมูลคำขอ
function showInfo(data) {
  hideElement("loading");
  hideElement("result");
  showElement("user-info");

  // Populate data
  setText("info-name", data.employeeName);
  setText("info-date", data.date);
  setText("info-current-time", data.currentTime || "-");
  setText("info-time", data.time);
  setText("info-type", data.type);
  setText("info-reason", data.reason);

  // Status Check
  if (data.status === "pending") {
    showElement("action-buttons");
    setText("main-title", "ตรวจสอบคำขอลืมลงเวลา");
    setText("subtitle", "กรุณาเลือกดำเนินการสำหรับคำขอนี้");
  } else if (data.status === "approved") {
    showResult("success", "ดำเนินการแล้ว", "คำขอนี้ถูกอนุมัติไปแล้ว", true);
    return;
  } else if (data.status === "rejected") {
    showResult("error", "ดำเนินการแล้ว", "คำขอนี้ถูกปฏิเสธไปแล้ว", true);
    return;
  } else {
    // If status is unknown
    showResult(
      "error",
      "ข้อผิดพลาด",
      "สถานะคำขอไม่ถูกต้อง (" + data.status + ")"
    );
    return;
  }
}

// แสดงผลลัพธ์การอนุมัติ/ปฏิเสธ
function showResult(type, title, message, keepInfo = false) {
  hideElement("loading");
  hideElement("action-buttons");

  if (keepInfo) {
    showElement("user-info");
  } else {
    hideElement("user-info");
  }

  showElement("result");

  const resultIcon = document.querySelector("#result svg");
  const resultBg = document.querySelector("#result div");

  if (type === "success") {
    // Green
    resultBg.className =
      "mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4";
    resultIcon.setAttribute("class", "h-8 w-8 text-green-600");
    resultIcon.innerHTML =
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />';
  } else if (type === "error") {
    // Red
    resultBg.className =
      "mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4";
    resultIcon.setAttribute("class", "h-8 w-8 text-red-600");
    resultIcon.innerHTML =
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />';
  } else {
    // Warning (Orange) - for general errors or warnings
    resultBg.className =
      "mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 mb-4";
    resultIcon.setAttribute("class", "h-8 w-8 text-orange-600");
    // Exclamation Mark
    resultIcon.innerHTML =
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />';
  }

  setText("result-message", message);
  setText("main-title", title);
  setText("subtitle", "ปิดหน้าต่างนี้ได้เลย");
}

// แสดงข้อมูล Snapshot ที่ถอดรหัสได้จาก Token
function displaySnapshot(snapshot) {
  if (snapshot.employeeName) setText("info-name", snapshot.employeeName);
  if (snapshot.date) setText("info-date", snapshot.date);
  if (snapshot.currentTime) setText("info-current-time", snapshot.currentTime);
  if (snapshot.time) setText("info-time", snapshot.time);
  if (snapshot.type) setText("info-type", snapshot.type);
  if (snapshot.reason) setText("info-reason", snapshot.reason);
  showElement("user-info");
}

// ดึงข้อมูลคำขอจาก API
async function fetchRequestInfo(token, config) {
  const res = await apiRequest({
    apiBaseUrl: config.apiBaseUrl,
    path: config.endpoints.forgetRequestInfo,
    method: "POST",
    body: { token },
  });
  if (!res.ok) {
    throw new Error(res.error || "ไม่สามารถดึงข้อมูลได้");
  }
  return res.data.data || res.data;
}

// รวมข้อมูลจาก Snapshot และ API
function mergeData(snapshot, apiData) {
  return {
    ...apiData,
    employeeName: snapshot?.employeeName || apiData.employeeName,
    date: snapshot?.date || apiData.date,
    currentTime: snapshot?.currentTime || apiData.currentTime,
    time: snapshot?.time || apiData.time,
    type: snapshot?.type || apiData.type,
    reason: snapshot?.reason || apiData.reason,
    status: apiData.status,
  };
}

// จัดการข้อผิดพลาดทั่วไป
function handleError(err) {
  const isExpired = err.message.includes("หมดอายุ");
  showResult(
    isExpired ? "warning" : "error",
    isExpired ? "ลิงก์หมดอายุ" : "ข้อผิดพลาด",
    err.message,
    true
  );
}

// ==============================================================================
//                ฟังก์ชันหลัก (Main Logic)
// ==============================================================================
// ผูกปุ่มอนุมัติ/ปฏิเสธกับฟังก์ชัน
function bindButtons(token, config) {
  const btnApprove = document.getElementById("btn-approve");
  const btnReject = document.getElementById("btn-reject");
  if (btnApprove) {
    btnApprove.addEventListener("click", () =>
      processRequest(token, "approve", config)
    );
  }
  if (btnReject) {
    btnReject.addEventListener("click", () => {
      const reason = prompt("กรุณาระบุเหตุผลที่ปฏิเสธ (ถ้ามี):");
      if (reason === null) return;
      processRequest(token, "reject", config, reason);
    });
  }
}

// Main Logic: เริ่มต้นเมื่อโหลดหน้าเพจ
async function initialize() {
  const { config } = getRuntimeConfig();
  const token = getToken();
  if (!token) {
    showResult("error", "ข้อผิดพลาด", "ไม่พบ Token หรือลิงก์ไม่ถูกต้อง");
    return;
  }
  showLoading();
  const snapshot = decodeToken(token);
  if (snapshot) {
    displaySnapshot(snapshot);
  }
  try {
    const apiData = await fetchRequestInfo(token, config);
    const finalData = mergeData(snapshot, apiData);
    showInfo(finalData);
  } catch (err) {
    handleError(err);
  }
  bindButtons(token, config);
}

document.addEventListener("DOMContentLoaded", initialize);

// ประมวลผลคำขออนุมัติ/ปฏิเสธ
async function processRequest(token, action, config, reason = "") {
  if (!confirm(`ยืนยันการ ${action === "approve" ? "อนุมัติ" : "ปฏิเสธ"}?`))
    return;

  showLoading();

  try {
    const res = await apiRequest({
      apiBaseUrl: config.apiBaseUrl,
      path: config.endpoints.forgetRequestApprove,
      method: "POST",
      body: { token, action, reason },
    });

    if (!res.ok) {
      throw new Error(res.error || "ดำเนินการล้มเหลว");
    }

    showResult(
      action === "approve" ? "อนุมัติสำเร็จ" : "ปฏิเสธสำเร็จ",
      action === "approve"
        ? "อนุมัติคำขอเรียบร้อยแล้ว"
        : "ปฏิเสธคำขอเรียบร้อยแล้ว"
    );
  } catch (err) {
    showToast({ type: "error", title: "เกิดข้อผิดพลาด", message: err.message });
    hideElement("loading");
    showElement("action-buttons");
    showElement("user-info"); // Show info again if failed
    setText("main-title", "ตรวจสอบคำขอลืมลงเวลา");
  }
}
