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

  const resultEl = document.getElementById("result");
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div class="text-green-600 text-lg font-bold mb-2">${escapeHtml(
        title
      )}</div>
      <p class="text-slate-600 text-sm mb-4 leading-relaxed">${escapeHtml(
        message
      )}</p>
      ${
        autoCloseSeconds > 0
          ? `<div class="inline-flex items-center gap-1.5 text-xs text-slate-400 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>หน้าต่างจะปิดอัตโนมัติใน ${autoCloseSeconds} วินาที</span>
            </div>`
          : ""
      }
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

  const resultEl = document.getElementById("result");
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="text-slate-900 text-lg font-bold mb-2">อนุมัติเรียบร้อยแล้ว</div>
      <p class="text-slate-600 text-sm mb-4">พนักงาน: <span class="font-semibold">${escapeHtml(
        userData.name
      )}</span><br>ระบบได้ทำการอนุมัติไปเรียบร้อยแล้ว</p>
    `;
  }

  // Auto Close
  setTimeout(() => globalThis.close(), 3000);
}

// ฟังก์ชันแสดงข้อผิดพลาด
function showError(message) {
  hideElement("loading");
  hideElement("action-buttons");
  hideElement("user-info");
  showElement("result");

  setText("main-title", "ไม่สามารถดำเนินการได้");
  hideElement("subtitle");

  const resultEl = document.getElementById("result");
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div class="text-red-600 text-lg font-bold mb-2">เกิดข้อผิดพลาด</div>
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p class="text-red-800 text-sm leading-relaxed">${escapeHtml(
          message
        )}</p>
      </div>
      <p class="text-xs text-slate-500">กรุณาติดต่อผู้ดูแลระบบหากปัญหายังคงมีอยู่</p>
    `;
  }

  // Auto Close
  setTimeout(() => globalThis.close(), 3000);
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
// ฟังก์ชัน Modal (Custom Confirmation)

function ensureModalExists() {
  if (document.getElementById("confirm-modal")) return;

  const modalHtml = `
    <div id="confirm-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 opacity-0 pointer-events-none transition-opacity duration-300" aria-hidden="true" style="backdrop-filter: blur(4px);">
      <div id="confirm-modal-content" class="w-full max-w-sm transform rounded-2xl bg-white p-6 shadow-2xl transition-all scale-95 opacity-0">
        <div class="mb-4 text-center">
          <div id="modal-icon-container" class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
             <span id="modal-icon">ℹ️</span>
          </div>
          <h3 id="modal-title" class="text-lg font-bold text-slate-900"></h3>
          <p id="modal-message" class="mt-2 text-sm text-slate-500"></p>
        </div>
        
        <div id="modal-reason-box" class="mb-6 hidden text-left">
          <label class="mb-1.5 block text-sm font-medium text-slate-700">เหตุผลที่ปฏิเสธ (ถ้ามี)</label>
          <textarea id="modal-reason" rows="3" class="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:ring-red-500 outline-none transition-all resize-none" placeholder="ระบุเหตุผล..."></textarea>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <button id="modal-cancel" class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">ยกเลิก</button>
          <button id="modal-confirm" class="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all transform active:scale-95"></button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

function showConfirmModal(action, onConfirm) {
  ensureModalExists();
  const modal = document.getElementById("confirm-modal");
  const modalContent = document.getElementById("confirm-modal-content");
  const titleEl = document.getElementById("modal-title");
  const msgEl = document.getElementById("modal-message");
  const iconContainer = document.getElementById("modal-icon-container");
  const iconEl = document.getElementById("modal-icon");
  const reasonBox = document.getElementById("modal-reason-box");
  const reasonInput = document.getElementById("modal-reason");
  const btnConfirm = document.getElementById("modal-confirm");
  const btnCancel = document.getElementById("modal-cancel");

  const isApprove = action === "approve";

  // Set Content
  titleEl.textContent = isApprove ? "ยืนยันการอนุมัติ" : "ยืนยันการปฏิเสธ";
  msgEl.textContent = isApprove
    ? "คุณต้องการอนุมัติคำขอลงทะเบียนนี้ใช่หรือไม่?"
    : "คุณต้องการปฏิเสธคำขอลงทะเบียนนี้ใช่หรือไม่?";

  // Set Styles & Icon
  if (isApprove) {
    iconContainer.className =
      "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100";
    iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
    reasonBox.classList.add("hidden");
    btnConfirm.className =
      "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-blue-200";
    btnConfirm.textContent = "ยืนยันอนุมัติ";
  } else {
    iconContainer.className =
      "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100";
    iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;
    reasonBox.classList.remove("hidden");
    reasonInput.value = "";
    btnConfirm.className =
      "rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 shadow-red-200";
    btnConfirm.textContent = "ยืนยันปฏิเสธ";
  }

  // Show Modal
  modal.classList.remove("opacity-0", "pointer-events-none");
  setTimeout(() => {
    modalContent.classList.remove("scale-95", "opacity-0");
    modalContent.classList.add("scale-100", "opacity-100");
    if (!isApprove) setTimeout(() => reasonInput.focus(), 100);
  }, 10);

  // Close Handler
  const close = () => {
    modalContent.classList.remove("scale-100", "opacity-100");
    modalContent.classList.add("scale-95", "opacity-0");
    modal.classList.add("opacity-0", "pointer-events-none");
    setTimeout(() => {
      btnConfirm.onclick = null;
      btnCancel.onclick = null;
    }, 300);
  };

  btnCancel.onclick = close;
  modal.onclick = (e) => {
    if (e.target === modal) close();
  };

  btnConfirm.onclick = () => {
    const reason = isApprove ? null : reasonInput.value.trim();
    close();
    // Wait for animation to finish slightly before processing
    setTimeout(() => onConfirm(reason), 300);
  };
}

// ==============================================================================
// ฟังก์ชัน Handle Actions

async function handleAction(action, reason = null) {
  const token = getToken();
  if (!token) {
    showError("ไม่พบ Token การยืนยันตัวตน");
    return;
  }

  showLoading();
  setButtonsDisabled(true);

  try {
    const response = await callApproveApi(token, action, reason);

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
    btnApprove.addEventListener("click", () => {
      showConfirmModal("approve", (reason) => {
        handleAction("approve", reason);
      });
    });
  }

  if (btnReject) {
    btnReject.addEventListener("click", () => {
      showConfirmModal("reject", (reason) => {
        handleAction("reject", reason);
      });
    });
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
