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

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  } else if (data.status === "approved" || data.status === "rejected") {
    showAlreadyProcessed(data);
    return;
  } else {
    // If status is unknown
    showError("ข้อผิดพลาด", "สถานะคำขอไม่ถูกต้อง (" + data.status + ")");
    return;
  }
}

// แสดงผลสำเร็จ
function showSuccess(title, message) {
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
      <div class="inline-flex items-center gap-1.5 text-xs text-slate-400 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>หน้าต่างจะปิดอัตโนมัติใน 3 วินาที</span>
      </div>
    `;
  }

  // Auto close window after 3 seconds
  setTimeout(() => globalThis.close(), 3000);
}

// แสดงผลเมื่อดำเนินการไปแล้ว
function showAlreadyProcessed(data) {
  hideElement("loading");
  hideElement("action-buttons");
  hideElement("user-info");
  showElement("result");

  const isApproved = data.status === "approved";
  const colorClass = isApproved ? "text-blue-600" : "text-slate-600";
  const bgClass = isApproved ? "bg-blue-100" : "bg-slate-100";
  const title = isApproved ? "อนุมัติเรียบร้อยแล้ว" : "ปฏิเสธเรียบร้อยแล้ว";
  const icon = isApproved
    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />';

  setText("main-title", "ดำเนินการเสร็จสิ้น");
  hideElement("subtitle");

  const resultEl = document.getElementById("result");
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${bgClass}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 ${colorClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          ${icon}
        </svg>
      </div>
      <div class="text-slate-900 text-lg font-bold mb-2">${title}</div>
      <p class="text-slate-600 text-sm mb-4">
        พนักงาน: <span class="font-semibold">${escapeHtml(
          data.employeeName
        )}</span><br>
        วันที่: ${escapeHtml(data.date)}<br>
        <span class="text-xs text-slate-400">คำขอนี้ถูกดำเนินการไปแล้ว</span>
      </p>
    `;
  }

  // Auto close window after 5 seconds
  setTimeout(() => globalThis.close(), 5000);
}

// แสดงข้อผิดพลาด
function showError(title, message) {
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
      <div class="text-red-600 text-lg font-bold mb-2">${escapeHtml(
        title
      )}</div>
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p class="text-red-800 text-sm leading-relaxed">${escapeHtml(
          message
        )}</p>
      </div>
      <p class="text-xs text-slate-500">กรุณาติดต่อผู้ดูแลระบบหากปัญหายังคงมีอยู่</p>
    `;
  }

  // Auto close window after 3 seconds
  setTimeout(() => globalThis.close(), 3000);
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
  showError(isExpired ? "ลิงก์หมดอายุ" : "ข้อผิดพลาด", err.message);
}

// ==============================================================================
//                ฟังก์ชันหลัก (Main Logic)
// ==============================================================================

// ==============================================================================
// ฟังก์ชัน Modal (Custom Confirmation) - เพิ่มตรงนี้
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
    ? "คุณต้องการอนุมัติคำขอลืมลงเวลานี้ใช่หรือไม่?"
    : "คุณต้องการปฏิเสธคำขอลืมลงเวลานี้ใช่หรือไม่?";

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

// ผูกปุ่มอนุมัติ/ปฏิเสธกับฟังก์ชัน
function bindButtons(token, config) {
  const btnApprove = document.getElementById("btn-approve");
  const btnReject = document.getElementById("btn-reject");
  if (btnApprove) {
    btnApprove.addEventListener("click", () =>
      showConfirmModal("approve", (reason) => {
        processRequest(token, "approve", config, reason);
      })
    );
  }
  if (btnReject) {
    btnReject.addEventListener("click", () => {
      showConfirmModal("reject", (reason) => {
        processRequest(token, "reject", config, reason);
      });
    });
  }
}

// Main Logic: เริ่มต้นเมื่อโหลดหน้าเพจ
async function initialize() {
  const { config } = getRuntimeConfig();
  const token = getToken();
  if (!token) {
    showError("ข้อผิดพลาด", "ไม่พบ Token หรือลิงก์ไม่ถูกต้อง");
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

    showSuccess(
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
