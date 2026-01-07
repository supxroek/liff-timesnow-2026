import { getRuntimeConfig } from "../core/config.js";
import { apiRequest } from "../core/api.js";
import { showToast } from "../core/ui.js";

// Helper Functions
function getToken() {
  const urlParams = new URLSearchParams(globalThis.location.search);
  return urlParams.get("token");
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "-";
}

function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

function showLoading() {
  hideElement("action-buttons");
  hideElement("user-info");
  hideElement("result");
  showElement("loading");
  setText("main-title", "กำลังดำเนินการ...");
  setText("subtitle", "กรุณารอสักครู่");
}

function showInfo(data) {
  hideElement("loading");
  hideElement("result");
  showElement("user-info");

  // Status Check
  if (data.status === "pending") {
    showElement("action-buttons");
    setText("main-title", "ตรวจสอบคำขอลืมลงเวลา");
    setText("subtitle", "กรุณาเลือกดำเนินการสำหรับคำขอนี้");
  } else {
    showResult(
      data.status === "approved",
      data.status === "approved"
        ? "คำขอนี้ถูกอนุมัติไปแล้ว"
        : "คำขอนี้ถูกปฏิเสธไปแล้ว"
    );
    return;
  }

  setText("info-name", data.employeeName);
  setText("info-date", data.date);
  setText("info-time", data.time);
  setText("info-type", data.type);
  setText("info-reason", data.reason);
}

function showResult(success, message) {
  hideElement("loading");
  hideElement("action-buttons");
  showElement("result");

  const resultIcon = document.querySelector("#result svg");
  const resultBg = document.querySelector("#result div");

  if (success) {
    // Green
    resultBg.className =
      "mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4";
    resultIcon.setAttribute("class", "h-8 w-8 text-green-600");
    resultIcon.innerHTML =
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />';
  } else {
    // Red
    resultBg.className =
      "mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4";
    resultIcon.setAttribute("class", "h-8 w-8 text-red-600");
    resultIcon.innerHTML =
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />';
  }

  setText("result-message", message);
  setText("main-title", success ? "สำเร็จ" : "ปฏิเสธสำเร็จ");
  setText("subtitle", "ปิดหน้าต่างนี้ได้เลย");
}

// Main Logic
document.addEventListener("DOMContentLoaded", async () => {
  const { config } = getRuntimeConfig();
  const token = getToken();

  if (!token) {
    showResult(false, "ไม่พบ Token หรือลิงก์ไม่ถูกต้อง");
    return;
  }

  showLoading();

  try {
    // Check Status / Get Info
    const res = await apiRequest({
      apiBaseUrl: config.apiBaseUrl,
      path: config.endpoints.forgetRequestInfo,
      method: "POST",
      body: { token },
    });

    if (!res.ok) {
      throw new Error(res.error || "ไม่สามารถดึงข้อมูลได้");
    }

    showInfo(res.data);
  } catch (err) {
    showResult(false, err.message);
  }

  // Bind Buttons
  const btnApprove = document.getElementById("btn-approve");
  const btnReject = document.getElementById("btn-reject");

  if (btnApprove)
    btnApprove.addEventListener("click", () =>
      processRequest(token, "approve", config)
    );
  if (btnReject)
    btnReject.addEventListener("click", () => {
      const reason = prompt("กรุณาระบุเหตุผลที่ปฏิเสธ (ถ้ามี):");
      if (reason === null) return; // Cancel
      processRequest(token, "reject", config, reason);
    });
});

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
      action === "approve",
      action === "approve"
        ? "อนุมัติคำขอเรียบร้อยแล้ว"
        : "ปฏิเสธคำขอเรียบร้อยแล้ว"
    );
  } catch (err) {
    showToast({ type: "error", title: "เกิดข้อผิดพลาด", message: err.message });
    hideElement("loading");
    showElement("action-buttons");
    showElement("user-info");
    setText("main-title", "ตรวจสอบคำขอลืมลงเวลา");
  }
}
