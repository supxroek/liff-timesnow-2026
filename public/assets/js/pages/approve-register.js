import { getRuntimeConfig } from "../core/config.js";
import { apiRequest } from "../core/api.js";

// ==============================================================================
// ฟังก์ชันช่วยเหลือสำหรับการจัดการ UI ของหน้า Approve

// ฟังก์ชันดึง Token จาก URL
function getToken() {
  const urlParams = new URLSearchParams(globalThis.location.search);
  return urlParams.get("token");
}

// ฟังก์ชันถอดรหัส JWT Token (ดึงข้อมูลผู้ใช้)
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

// ฟังก์ชันซ่อนเลขบัตรประชาชน
function maskIDCard(idCard) {
  if (!idCard || idCard.length < 13) return idCard;
  return idCard.substring(0, 3) + "xxxxxx" + idCard.substring(9);
}

// ฟังก์ชันแปลงวันที่เป็นภาษาไทย
function formatDateThai(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ฟังก์ชันแสดง/ซ่อน Element
function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

// ฟังก์ชันตั้งค่าข้อความ
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ฟังก์ชันแสดง Loading
function showLoading() {
  hideElement("action-buttons");
  hideElement("user-info");
  hideElement("result");
  showElement("loading");
  setText("main-title", "กำลังดำเนินการ...");
  setText("subtitle", "กรุณารอสักครู่");
}

// ฟังก์ชันแสดงหน้าเลือก Action
function showActionPage(userData) {
  hideElement("loading");
  hideElement("result");
  showElement("user-info");
  showElement("action-buttons");

  setText("main-title", "ตรวจสอบคำขอลงทะเบียน");
  setText("subtitle", "กรุณาเลือกดำเนินการสำหรับคำขอลงทะเบียนนี้");

  // แสดงข้อมูลผู้ใช้
  setText("info-name", userData.name || "-");
  setText("info-idcard", maskIDCard(userData.IDCard) || "-");
  setText("info-startdate", formatDateThai(userData.start_date) || "-");
}

// ฟังก์ชันแสดงผลสำเร็จ
function showSuccess(title, message, autoCloseSeconds = 5) {
  hideElement("loading");
  hideElement("action-buttons");
  hideElement("user-info");
  showElement("result");

  setText("main-title", "สำเร็จ");
  hideElement("subtitle");

  // เปลี่ยน icon เป็นสีเขียว
  const headerIcon = document.getElementById("header-icon");
  if (headerIcon) {
    headerIcon.innerHTML = `
      <div class="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center shadow-lg shadow-green-200/50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 sm:h-10 sm:w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    `;
  }

  const resultEl = document.getElementById("result");
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="text-green-600 text-sm sm:text-md font-bold mb-2 sm:mb-3">${escapeHtml(
        title
      )}</div>
      <p class="text-slate-600 text-xs sm:text-sm mb-3 sm:mb-4 leading-relaxed">${escapeHtml(
        message
      )}</p>
      <div class="inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>หน้าต่างจะปิดอัตโนมัติใน ${autoCloseSeconds} วินาที</span>
      </div>
    `;
  }

  if (autoCloseSeconds > 0) {
    setTimeout(() => globalThis.close(), autoCloseSeconds * 1000);
  }
}

// ฟังก์ชันแสดงผลเมื่อได้รับการอนุมัติแล้ว (ปิดหน้าต่างอัตโนมัติ 3 วินาที)
function showAlreadyApproved(userData) {
  hideElement("loading");
  hideElement("action-buttons");
  hideElement("user-info");
  showElement("result");

  setText("main-title", "ลงทะเบียนเรียบร้อยแล้ว");
  hideElement("subtitle");

  // เปลี่ยน icon เป็นสีน้ำเงิน
  const headerIcon = document.getElementById("header-icon");
  if (headerIcon) {
    headerIcon.innerHTML = `
      <div class="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center shadow-lg shadow-blue-200/50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 sm:h-10 sm:w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    `;
  }

  const resultEl = document.getElementById("result");
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="text-blue-600 text-sm sm:text-md font-bold mb-3 sm:mb-4">ผู้ใช้นี้ได้รับการอนุมัติแล้ว</div>
      
      <div class="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-3 sm:p-4 mb-3 border border-blue-200/50 shadow-sm">
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] sm:text-xs font-medium text-blue-600 uppercase tracking-wide">ชื่อ-สกุล</span>
            <span class="text-xs sm:text-sm font-semibold text-slate-900">${escapeHtml(
              userData.name || "-"
            )}</span>
          </div>
          <div class="h-px bg-blue-200/50"></div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] sm:text-xs font-medium text-blue-600 uppercase tracking-wide">เลขบัตร</span>
            <span class="text-xs sm:text-sm font-mono font-semibold text-slate-900">${escapeHtml(
              maskIDCard(userData.IDCard) || "-"
            )}</span>
          </div>
          <div class="h-px bg-blue-200/50"></div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] sm:text-xs font-medium text-blue-600 uppercase tracking-wide">วันที่เริ่มงาน</span>
            <span class="text-xs sm:text-sm font-semibold text-blue-700">${escapeHtml(
              formatDateThai(userData.start_date) || "-"
            )}</span>
          </div>
        </div>
      </div>

      <p class="text-slate-500 text-xs mb-3">ไม่สามารถดำเนินการอนุมัติซ้ำได้</p>
      
      <div class="inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>หน้าต่างจะปิดอัตโนมัติใน 3 วินาที</span>
      </div>
    `;
  }

  // ปิดหน้าต่างอัตโนมัติหลังจาก 3 วินาที
  setTimeout(() => {
    globalThis.close();
  }, 3000);
}

// ฟังก์ชันแสดงข้อผิดพลาด
function showError(message) {
  hideElement("loading");
  hideElement("action-buttons");
  hideElement("user-info");
  showElement("result");

  setText("main-title", "ไม่สามารถดำเนินการได้");
  hideElement("subtitle");

  // เปลี่ยน icon เป็นสีแดง
  const headerIcon = document.getElementById("header-icon");
  if (headerIcon) {
    headerIcon.innerHTML = `
      <div class="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center shadow-lg shadow-red-200/50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 sm:h-10 sm:w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    `;
  }

  const resultEl = document.getElementById("result");
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="text-red-600 text-sm sm:text-md font-bold mb-2 sm:mb-3">เกิดข้อผิดพลาด</div>
      <div class="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-3">
        <p class="text-red-800 text-xs sm:text-sm leading-relaxed">${escapeHtml(
          message
        )}</p>
      </div>
      <p class="text-[10px] sm:text-xs text-slate-500">กรุณาติดต่อผู้ดูแลระบบหากปัญหายังคงมีอยู่</p>
    `;
  }
}

// ฟังก์ชัน Escape HTML เพื่อป้องกัน XSS
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ฟังก์ชัน Disable ปุ่ม
function setButtonsDisabled(disabled) {
  const btnApprove = document.getElementById("btn-approve");
  const btnReject = document.getElementById("btn-reject");
  if (btnApprove) btnApprove.disabled = disabled;
  if (btnReject) btnReject.disabled = disabled;
}

// ==============================================================================
// ฟังก์ชันเรียก API

// ฟังก์ชันตรวจสอบสถานะการลงทะเบียน
async function callCheckStatusApi(token) {
  const { config } = getRuntimeConfig();
  return apiRequest({
    apiBaseUrl: config.apiBaseUrl,
    path: config.endpoints.registerCheckStatus,
    method: "POST",
    body: { token },
  });
}

// ฟังก์ชันอนุมัติ/ปฏิเสธ
async function callApproveApi(token, action, reason = null) {
  const { config } = getRuntimeConfig();
  const body = { token, action };
  if (reason) body.reason = reason;

  return apiRequest({
    apiBaseUrl: config.apiBaseUrl,
    path: config.endpoints.registerApprove,
    method: "POST",
    body,
  });
}

// ==============================================================================
// ฟังก์ชัน Handle Actions

async function handleAction(action) {
  const token = getToken();
  if (!token) {
    showError("ไม่พบ Token การยืนยันตัวตน");
    return;
  }

  showLoading();
  setButtonsDisabled(true);

  try {
    const response = await callApproveApi(token, action);

    if (response.ok) {
      const actionText = action === "approve" ? "อนุมัติ" : "ปฏิเสธ";
      showSuccess(
        "ดำเนินการสำเร็จ",
        `ระบบได้บันทึกผลการ${actionText}เรียบร้อยแล้ว`
      );
    } else {
      showError(response.error || "เกิดข้อผิดพลาดในการดำเนินการ");
    }
  } catch (error) {
    console.error("Error:", error);
    showError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
  }
}

// ฟังก์ชันตรวจสอบและถอดรหัส Token
function validateToken(token) {
  if (!token) {
    showError("ไม่พบ Token การยืนยันตัวตน");
    return null;
  }

  const userData = decodeToken(token);
  if (!userData) {
    showError("Token ไม่ถูกต้อง");
    return null;
  }

  if (userData.exp && userData.exp * 1000 < Date.now()) {
    showError(
      "ลิงก์การอนุมัตินี้หมดอายุแล้ว (30 นาที) กรุณาดำเนินการใหม่อีกครั้ง"
    );
    return null;
  }

  return userData;
}

// ฟังก์ชันจัดการการตอบกลับจาก API ตรวจสอบสถานะ
function handleStatusResponse(statusResponse, userData) {
  if (statusResponse.ok) {
    // Backend ส่งข้อมูลมาแบบ nested: { status: 'success', data: { isRegistered, userData } }
    const responseData = statusResponse.data.data || statusResponse.data;
    const { isRegistered, userData: responseUserData } = responseData;

    if (isRegistered) {
      showAlreadyApproved(responseUserData);
    } else {
      showActionPage(userData);
      addActionListeners();
    }
  } else {
    showError(statusResponse.error || "ไม่สามารถตรวจสอบสถานะการลงทะเบียนได้");
  }
}

// ฟังก์ชันเพิ่ม Event Listeners สำหรับปุ่ม
function addActionListeners() {
  const btnApprove = document.getElementById("btn-approve");
  const btnReject = document.getElementById("btn-reject");

  if (btnApprove) {
    btnApprove.addEventListener("click", () => handleAction("approve"));
  }

  if (btnReject) {
    btnReject.addEventListener("click", () => handleAction("reject"));
  }
}

// ==============================================================================
// ฟังก์ชันเริ่มต้น

async function init() {
  const token = getToken();
  const userData = validateToken(token);
  if (!userData) return;

  showLoading();
  setText("main-title", "กำลังตรวจสอบสถานะ...");
  setText("subtitle", "กรุณารอสักครู่");

  try {
    const statusResponse = await callCheckStatusApi(token);
    handleStatusResponse(statusResponse, userData);
  } catch (error) {
    console.error("Error checking status:", error);
    showError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
  }
}

// ==============================================================================
// เริ่มต้นการทำงาน
await init();
