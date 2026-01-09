import { getRuntimeConfig } from "../core/config.js";
import { apiRequest } from "../core/api.js";
import {
  initLiffOrThrow,
  ensureLoggedIn,
  getIdTokenSafe,
  getProfileSafe,
  trySendMessage,
} from "../core/liff.js";
import {
  clearFormErrors,
  hideBanner,
  setFormErrors,
  setLoading,
  setText,
  showToast,
} from "../core/ui.js";
import { isEmptyErrors, validateForgetTime } from "../core/validation.js";

function requireDayjs() {
  if (!globalThis.dayjs)
    throw new Error(
      "dayjs ไลบรารีไม่ได้ถูกโหลด. ตรวจสอบให้แน่ใจว่าได้รวมสคริปต์ dayjs ในหน้าเว็บของคุณแล้ว"
    );
}

// แปลงค่าจาก input วันที่ (YYYY-MM-DD) เป็น ISO string
function toIsoFromDateInput(yyyyMmDd) {
  if (!yyyyMmDd) return "";
  return globalThis.dayjs(yyyyMmDd).startOf("day").toISOString();
}

// Global state for Missing Timestamps
let missingData = [];
let calendarState = {
  collapsed: false,
  selectedDate: null,
  currentDisplayDate: null, // Dayjs object for month view
};

// ==============================================================================
// Smart Calendar Logic
// ==============================================================================

async function fetchMissingTimestamps(lineUserId) {
  resetFetchState();

  try {
    const response = await performFetch(lineUserId);
    if (response.ok && response.status === 200) {
      handleFetchSuccess(response);
    } else {
      handleFetchError(response);
    }
  } catch (err) {
    handleFetchError(err);
  } finally {
    const loadingEl = document.getElementById("initial-loading");
    loadingEl.classList.add("hidden");
  }
}

function resetFetchState() {
  const loadingEl = document.getElementById("initial-loading");
  const emptyEl = document.getElementById("empty-state");
  const mainEl = document.getElementById("main-content");

  loadingEl.classList.remove("hidden");
  emptyEl.classList.add("hidden");
  mainEl.classList.add("hidden");
}

async function performFetch(lineUserId) {
  const { config } = getRuntimeConfig();
  const idToken = await getIdTokenSafe();

  return await apiRequest({
    apiBaseUrl: config.apiBaseUrl,
    path: config.endpoints.forgetRequestMissing,
    method: "POST",
    body: { lineUserId },
    idToken: idToken,
  });
}

function handleFetchSuccess(response) {
  const emptyEl = document.getElementById("empty-state");
  const mainEl = document.getElementById("main-content");

  missingData = response.data.data ? response.data.data : response.data;

  const hasMissing = missingData.some((item) => item.status === "missing");

  if (hasMissing) {
    calendarState.currentDisplayDate = globalThis.dayjs();
    renderCalendar();
    renderMissingSummary();
    mainEl.classList.remove("hidden");
  } else {
    emptyEl.classList.remove("hidden");
  }
}

function handleFetchError(errorOrResponse) {
  const errorEl = document.getElementById("error-state");
  const errorMsgEl = document.getElementById("error-message");
  const emptyEl = document.getElementById("empty-state");
  const mainEl = document.getElementById("main-content");

  if (errorEl) errorEl.classList.remove("hidden");
  if (emptyEl) emptyEl.classList.add("hidden");
  if (mainEl) mainEl.classList.add("hidden");

  // Format incoming error/response into a user-friendly string
  const message =
    formatErrorMessage(errorOrResponse) || "ไม่สามารถดึงข้อมูลย้อนหลังได้";

  if (errorMsgEl) errorMsgEl.textContent = message;

  showToast({
    title: "เกิดข้อผิดพลาด",
    message: message,
    type: "error",
  });

  startErrorCountdown(5);
}

// Helper function to extract message from an object
function getMessageFromObject(obj) {
  if (obj.message && typeof obj.message === "string") return obj.message;
  if (obj.error && typeof obj.error === "string") return obj.error;
  if (obj.status && obj.statusText) return `${obj.status} ${obj.statusText}`;
  const keys = ["detail", "description", "msg"];
  for (const key of keys) {
    if (obj[key] && typeof obj[key] === "string") return obj[key];
  }
  try {
    const json = JSON.stringify(obj);
    return json.length > 300 ? json.slice(0, 300) + "..." : json;
  } catch {
    return String(obj);
  }
}

// Helper function to extract message from data
function extractMessageFromData(d) {
  if (typeof d === "string") return d;
  if (d.message && typeof d.message === "string") return d.message;
  if (d.error && typeof d.error === "string") return d.error;
  if (Array.isArray(d.errors) && d.errors.length) {
    return d.errors
      .map((e) => (typeof e === "string" ? e : e.message || JSON.stringify(e)))
      .join("; ");
  }
  if (typeof d === "object") {
    return getMessageFromObject(d);
  }
  return null;
}

// Nicely format different error shapes into a readable string
function formatErrorMessage(err) {
  if (!err) return null;

  // If response-like object with .data, prefer its message
  if (err.data) {
    const msg = extractMessageFromData(err.data);
    if (msg) return msg;
  }

  // Error instance
  if (err instanceof Error) {
    return formatErrorFromError(err);
  }

  // Plain object (try to interpret common fields)
  if (typeof err === "object") {
    return formatErrorFromObject(err);
  }

  // Fallback string conversions with some translations
  return formatErrorFromString(err);
}

function formatErrorFromError(err) {
  const m = err.message || String(err);
  // common network error returned by browsers
  if (m.includes("Failed to fetch"))
    return "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ (ตรวจสอบการเชื่อมต่อเครือข่าย)";
  if (/timeout/i.test(m)) return "คำขอหมดเวลา โปรดลองอีกครั้งภายหลัง";
  return m;
}

function formatErrorFromObject(err) {
  // HTTP status mapping
  if (err.status) {
    const code = Number(err.status) || null;
    const statusMessages = {
      401: "สิทธิ์ไม่เพียงพอ (401) โปรดเข้าสู่ระบบ",
      403: "ไม่มีสิทธิ์เข้าถึง (403)",
      404: "ไม่พบข้อมูลที่ร้องขอ (404)",
      500: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ (500)",
    };
    if (statusMessages[code]) return statusMessages[code];
    // fallback to statusText or composed
    if (err.statusText) return `${err.status} ${err.statusText}`;
  }

  const objMsg = getMessageFromObject(err);
  if (objMsg) {
    // If object message is a generic english phrase, translate some common ones
    if (objMsg.includes("Failed to fetch"))
      return "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ (ตรวจสอบการเชื่อมต่อเครือข่าย)";
    return objMsg;
  }
  return null;
}

function formatErrorFromString(s) {
  const str = String(s || "");
  if (str.includes("Failed to fetch"))
    return "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ (ตรวจสอบการเชื่อมต่อเครือข่าย)";
  if (
    str.toLowerCase().includes("networkerror") ||
    str.toLowerCase().includes("network error")
  )
    return "เกิดปัญหาเครือข่าย โปรดลองใหม่อีกครั้ง";
  if (str.toLowerCase().includes("timeout"))
    return "คำขอหมดเวลา โปรดลองอีกครั้งภายหลัง";
  if (/401|unauthorized/i.test(str))
    return "สิทธิ์ไม่เพียงพอ (401) โปรดเข้าสู่ระบบหรือขอสิทธิ์เพิ่มเติม";
  if (/403|forbidden/i.test(str)) return "ไม่มีสิทธิ์เข้าถึง (403)";
  if (/404|not found/i.test(str)) return "ไม่พบทรัพยากรที่ร้องขอ (404)";
  if (/500|internal server error/i.test(str))
    return "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ (500)";

  return str;
}

// Start a visible countdown on the error UI and close the LIFF window when it reaches 0
function startErrorCountdown(seconds = 5) {
  const countdownEl = document.getElementById("error-countdown-seconds");
  const errorEl = document.getElementById("error-state");
  if (!errorEl) return;
  let remaining = typeof seconds === "number" && seconds > 0 ? seconds : 5;
  if (countdownEl) countdownEl.textContent = String(remaining);

  const timer = setInterval(() => {
    remaining -= 1;
    if (countdownEl) countdownEl.textContent = String(Math.max(0, remaining));
    if (remaining <= 0) {
      clearInterval(timer);
      // Attempt to close LIFF client window, fallback to window.close
      if (
        globalThis.liff &&
        typeof globalThis.liff.isInClient === "function" &&
        globalThis.liff.isInClient()
      ) {
        try {
          globalThis.liff.closeWindow();
        } catch (e) {
          console.warn("liff.closeWindow failed", e);
          globalThis.close();
        }
      } else {
        globalThis.close();
      }
    }
  }, 1000);
}

function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  const monthLabel = document.getElementById("current-month-label");
  if (!grid) return;

  // Insert Headers if missing (re-render safe)
  grid.innerHTML = `
        <div class="text-slate-400 font-medium py-2">อา</div>
        <div class="text-slate-400 font-medium py-2">จ</div>
        <div class="text-slate-400 font-medium py-2">อ</div>
        <div class="text-slate-400 font-medium py-2">พ</div>
        <div class="text-slate-400 font-medium py-2">พฤ</div>
        <div class="text-slate-400 font-medium py-2">ศ</div>
        <div class="text-slate-400 font-medium py-2">ส</div>
    `;

  const today = globalThis.dayjs();
  // Valid Range: [today-30, today]
  const validStart = today.subtract(30, "day").startOf("day");
  const validEnd = today.endOf("day");

  // Display Month Logic
  const displayDate = calendarState.currentDisplayDate || today;
  if (monthLabel) {
    // Thai Month Names
    const thaiMonths = [
      "ม.ค.",
      "ก.พ.",
      "มี.ค.",
      "เม.ย.",
      "พ.ค.",
      "มิ.ย.",
      "ก.ค.",
      "ส.ค.",
      "ก.ย.",
      "ต.ค.",
      "พ.ย.",
      "ธ.ค.",
    ];
    monthLabel.textContent = `${thaiMonths[displayDate.month()]} ${
      displayDate.year() + 543
    }`;
  }

  // Generate Month Grid
  const startOfMonth = displayDate.startOf("month");
  const daysInMonth = displayDate.daysInMonth();
  const startDayOfWeek = startOfMonth.day(); // 0 (Sun)

  // Data Map
  const dataMap = mapMissingDataToDates(missingData);

  // Empty slots for start offset
  for (let i = 0; i < startDayOfWeek; i++) {
    const empty = document.createElement("div");
    grid.appendChild(empty);
  }

  // Days
  for (let i = 1; i <= daysInMonth; i++) {
    const current = startOfMonth.date(i);
    const dateStr = current.format("YYYY-MM-DD");
    const items = dataMap[dateStr] || [];

    // Valid range check
    const isValidRange =
      (current.isAfter(validStart) || current.isSame(validStart, "day")) &&
      (current.isBefore(validEnd) || current.isSame(validEnd, "day"));

    const btn = createDayButton(i, dateStr, items, isValidRange);
    grid.appendChild(btn);
  }

  // Wire buttons
  setupCalendarNav();
}

function mapMissingDataToDates(data) {
  const map = {};
  data.forEach((item) => {
    if (!map[item.date]) map[item.date] = [];
    map[item.date].push(item);
  });
  return map;
}

function createDayButton(dayNumber, dateStr, items, isValidRange) {
  let status = "disabled"; // Default disabled if out of range

  if (isValidRange) {
    status = "normal";
    if (items.some((x) => x.status === "missing")) status = "missing";
    else if (items.some((x) => x.status === "pending")) status = "pending";
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `relative flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 aspect-square text-xs font-medium`;

  if (status === "missing") {
    btn.className += ` bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-inset ring-red-200 font-bold`;
    btn.innerHTML = `<span class="z-10">${dayNumber}</span><span class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500"></span>`;
    btn.onclick = () => selectDate(dateStr, items);
  } else if (status === "pending") {
    btn.className += ` bg-yellow-50 text-yellow-700 hover:bg-yellow-100 ring-1 ring-inset ring-yellow-200`;
    btn.innerHTML = `<span class="z-10">${dayNumber}</span>`;
    btn.onclick = () => {
      showToast({
        type: "info",
        title: "รออนุมัติ",
        message: "รายการในวันนี้อยู่ระหว่างการตรวจสอบ",
      });
    };
  } else if (status === "normal") {
    // Only show "Normal" if it's within scannable range
    btn.className += ` text-slate-400 hover:bg-slate-50`;
    btn.innerHTML = `<span class="z-10">${dayNumber}</span>`;
    btn.onclick = () => {
      showToast({
        type: "success",
        title: "สมบูรณ์",
        message: "ไม่มีรายการตกหล่นในวันนี้",
      });
    };
  } else {
    // Disabled (Future or Older than 30 days)
    btn.className += ` text-slate-200 cursor-default`;
    btn.innerHTML = `<span class="z-10">${dayNumber}</span>`;
    btn.disabled = true;
  }
  return btn;
}

function setupCalendarNav() {
  const prevBtn = document.getElementById("prev-month-btn");
  const nextBtn = document.getElementById("next-month-btn");

  // Unbind first to prevent multiple listeners if called multiple times?
  // Actually replaceWith(clone) is a quick hack to strip listeners.
  if (prevBtn) {
    const newPrev = prevBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrev, prevBtn);
    newPrev.onclick = () => {
      calendarState.currentDisplayDate =
        calendarState.currentDisplayDate.subtract(1, "month");
      renderCalendar();
    };
  }

  if (nextBtn) {
    const newNext = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);
    newNext.onclick = () => {
      // Prevent going to future months? Maybe limit to current month?
      // "if current month is same as today's month, don't go next" logic if desired.
      // But strict requirement wasn't given.
      calendarState.currentDisplayDate = calendarState.currentDisplayDate.add(
        1,
        "month"
      );
      renderCalendar();
    };
  }
}

function renderMissingSummary() {
  const container = document.getElementById("missing-summary");
  if (!container) return;

  // Count missing
  const missingCount = missingData.filter((x) => x.status === "missing").length;

  if (missingCount === 0) {
    // Handled by fetchMissingTimestamps main logic (empty-state)
    container.classList.add("hidden");
    return;
  }

  container.innerHTML = `
        <span class="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/10 whitespace-nowrap">
            พบ ${missingCount} รายการที่สามารถแก้ไขได้
        </span>
    `;
  container.classList.remove("hidden");
}

function selectDate(dateStr, items) {
  // 1. Update Hidden Form Input
  const dateInput = document.getElementById("date");
  if (dateInput) dateInput.value = dateStr;

  // 1.1 Update Selected Date Display
  const dateDisplay = document.getElementById("selected-date-text");
  const dateInfoContainer = document.getElementById("selected-date-info");
  if (dateDisplay) {
    // Format date to Thai format short? Or just YYYY-MM-DD for now
    // Let's use DayJS to format nicely
    const formatted = globalThis.dayjs(dateStr).format("DD/MM/YYYY");
    dateDisplay.textContent = formatted;
  }
  if (dateInfoContainer) dateInfoContainer.classList.remove("hidden");
  if (dateInfoContainer) dateInfoContainer.classList.add("flex"); // Ensure flex

  // 1.2 Show Form
  const form = document.getElementById("forgetTimeForm");
  if (form) {
    form.classList.remove("hidden", "opacity-0");
  }

  // 2. Filter Dropdown
  const typeSelect = document.getElementById("timestamp_type");
  if (typeSelect) {
    // Reset options
    typeSelect.innerHTML = '<option value="">เลือกประเภท...</option>';

    // Define all possible options map
    const typeMap = {
      work_in: "เข้างาน (Work In)",
      work_out: "ออกงาน (Work Out)",
      break_in: "พักเบรก (Break In)",
      break_out: "สิ้นสุดพัก (Break Out)",
      ot_in: "เข้าโอที (OT In)",
      ot_out: "ออกโอที (OT Out)",
    };

    // Filter valid missing types
    const missingTypes = items
      .filter((x) => x.status === "missing")
      .map((x) => x.type);

    missingTypes.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.text = typeMap[type] || type;
      typeSelect.appendChild(option);
    });

    // 3. Auto-select first option
    if (missingTypes.length > 0) {
      typeSelect.value = missingTypes[0];
    }
  }

  // 4. Collapse Calendar automatically (Removed logic to toggle button click)
  // Since we removed the toggle button, we might want to just scroll to form

  // Scroll to form smoothly
  if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
}

// อ่านข้อมูลจากฟอร์ม
function readPayload() {
  const timestamp_type = document.getElementById("timestamp_type").value;
  const dateInput = document.getElementById("date").value;
  const timeInput = document.getElementById("time").value;
  const reason = document.getElementById("reason").value;
  // evidence is handled separately for file upload

  const date = dateInput ? toIsoFromDateInput(dateInput) : "";
  const time = String(timeInput || "").trim();

  return {
    timestamp_type: String(timestamp_type || "").trim(),
    date: date,
    time: time,
    reason: String(reason || "").trim(),
  };
}

// ==============================================================================
// ฟังก์ชันบูตสแตรปหน้า Forget Time
async function bootstrap() {
  hideBanner(); // ซ่อนแบนเนอร์แจ้งเตือน
  setLoading(false); // ปิดสถานะโหลด
  // statusText UI updates removed per request

  // ตรวจสอบการโหลดไลบรารี dayjs
  requireDayjs();

  // จัดการการแสดงตัวอย่างไฟล์
  setupFilePreview();

  // ดึงการตั้งค่ารันไทม์
  const { config, warnings } = getRuntimeConfig();
  if (config.debug) console.log("[LIFF ForgetTime] runtime config", config);
  if (warnings.length) {
    showToast({
      type: "warning",
      title: "การกำหนดค่า",
      message: warnings.join(" | "),
    });
  }

  // เริ่มต้น LIFF และตั้งค่า UI
  await initLiffAndSetupUI(config);

  // set up calendar (after liff init to get profile)
  const profile = await getProfileSafe();
  if (profile?.userId) {
    await fetchMissingTimestamps(profile.userId);
  }

  // ตั้งค่าการส่งฟอร์มลืมบันทึกเวลา
  setupFormSubmission(config);
}

// ตั้งค่าการแสดงตัวอย่างไฟล์
function setupFilePreview() {
  const evidenceInput = document.getElementById("evidence");
  const previewContainer = document.getElementById("previewContainer");
  const imagePreview = document.getElementById("imagePreview");
  const fileName = document.getElementById("fileName");
  const fileInfo = document.getElementById("fileInfo");
  const removeFileBtn = document.getElementById("removeFileBtn");

  if (evidenceInput) {
    evidenceInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;

      // แสดง Container
      previewContainer.classList.remove("hidden");

      if (file.type.startsWith("image/")) {
        // กรณีเป็นรูปภาพ
        const reader = new FileReader();
        reader.onload = function (e) {
          imagePreview.src = e.target.result;
          imagePreview.classList.remove("hidden");
          fileInfo.classList.add("hidden");
        };
        reader.readAsDataURL(file);
      } else {
        // กรณีไม่ใช่รูปภาพ (เช่น PDF)
        imagePreview.classList.add("hidden");
        fileInfo.classList.remove("hidden");
        fileName.textContent = file.name;
      }
    });
  }

  if (removeFileBtn) {
    removeFileBtn.addEventListener("click", function () {
      evidenceInput.value = ""; // ล้างค่า input
      previewContainer.classList.add("hidden"); // ซ่อน preview
      imagePreview.src = "";
    });
  }
}

// เริ่มต้น LIFF และตั้งค่า UI ผู้ใช้
async function initLiffAndSetupUI(config) {
  try {
    const liff = await initLiffOrThrow(config.liffId); // เริ่มต้น LIFF SDK

    // จัดการการเปลี่ยนเส้นทางเข้าสู่ระบบถ้าจำเป็น
    if (handleLoginRedirect(liff, config)) return;

    // ดึงข้อมูลโปรไฟล์ผู้ใช้
    const profile = await getProfileSafe();

    // ตั้งค่า UI สำหรับโปรไฟล์
    setupProfileUI(liff, profile);
    // statusText UI updates removed per request
  } catch (err) {
    if (config.debug) console.error("[LIFF ForgetTime] init failed", err);
    // statusText UI updates removed per request
    showToast({
      type: "error",
      title: "การเริ่ม LIFF ล้มเหลว",
      message:
        (formatErrorMessage(err) || err?.message || String(err)) +
        " โปรดตรวจสอบการตั้งค่า LIFF ID และการเชื่อมต่อเครือข่ายของคุณ",
    });
  }
}

// จัดการการเปลี่ยนเส้นทางเข้าสู่ระบบ
function handleLoginRedirect(liff, config) {
  if (config.requireLogin && !liff.isLoggedIn()) {
    const redirectUri = `${globalThis.location.origin}/forget-time`;
    showToast({
      type: "warning",
      title: "ต้องเข้าสู่ระบบ",
      message: "กำลังเปลี่ยนเส้นทางไปยังหน้าการเข้าสู่ระบบ LINE...",
    });
    ensureLoggedIn({ redirectUri });
    return true;
  }
  return false;
}

// ตั้งค่า UI สำหรับโปรไฟล์ผู้ใช้
function setupProfileUI(liff, profile) {
  const isLoggedIn = liff.isLoggedIn();
  setText("liffState", isLoggedIn ? "เข้าสู่ระบบแล้ว" : "ยังไม่เข้าสู่ระบบ");

  // แสดง userId แบบย่อหากมี
  const userId = profile?.userId || "-";
  const lineUserIdValue =
    userId !== "-" && userId.length > 10
      ? userId.substring(0, 10) + "..."
      : userId;
  setText("lineUserId", lineUserIdValue);

  setText("displayName", profile?.displayName || "-");

  // แสดงรูปโปรไฟล์
  const img = document.getElementById("userProfileImg");
  const placeholder = document.getElementById("userProfilePlaceholder");
  if (img && placeholder) {
    if (profile?.pictureUrl) {
      img.src = profile.pictureUrl;
      img.classList.remove("hidden");
      placeholder.classList.add("hidden");
    } else {
      img.classList.add("hidden");
      placeholder.classList.remove("hidden");
    }
  }
}

// Helper to convert file to Base64
function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(
        new Error(`File reading failed: ${reader.error?.message || "Unknown"}`)
      );
  });
}

// ตั้งค่าการส่งฟอร์มลืมบันทึกเวลา
function setupFormSubmission(config) {
  const form = document.getElementById("forgetTimeForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // ป้องกันการส่งฟอร์มแบบดีฟอลต์
    clearFormErrors("forgetTimeForm"); // ล้างข้อผิดพลาดในฟอร์ม
    hideBanner(); // ซ่อนแบนเนอร์แจ้งเตือน

    // อ่านข้อมูลจากฟอร์มและตรวจสอบความถูกต้อง
    const payload = readPayload();
    const errors = validateForgetTime(payload);

    if (!isEmptyErrors(errors)) {
      setFormErrors("forgetTimeForm", errors);
      showToast({
        type: "error",
        title: "การตรวจสอบข้อมูล",
        message: "กรุณาแก้ไขฟิลด์ที่ไฮไลต์",
      });
      return;
    }

    // ดึง ID token อย่างปลอดภัย เพื่อส่งให้ backend ตรวจสอบ (LIFF ให้ getIDToken)
    const idToken = await getIdTokenSafe();
    const profile = await getProfileSafe();

    // ตรวจสอบว่ามีข้อมูลโปรไฟล์หรือไม่
    if (!profile?.userId) {
      showToast({
        type: "error",
        title: "ข้อผิดพลาด",
        message: "ไม่พบข้อมูลผู้ใช้ LINE",
      });
      return;
    }

    setLoading(true);

    try {
      // Logic การแปลงไฟล์เป็น Base64
      let evidenceBase64 = null;
      const evidenceInput = document.getElementById("evidence");
      if (evidenceInput.files.length > 0) {
        const file = evidenceInput.files[0];
        // Check size (10MB)
        if (file.size > 10 * 1024 * 1024)
          throw new Error("ไฟล์ขนาดใหญ่เกินไป (สูงสุด 10MB)");

        evidenceBase64 = await convertFileToBase64(file);
      }

      // สร้าง JSON Body (ตรงกับ Backend Schema)
      const body = {
        lineUserId: profile.userId,
        type: payload.timestamp_type,
        date: payload.date,
        time: payload.time,
        reason: payload.reason,
        evidence: evidenceBase64,
      };

      const res = await apiRequest({
        apiBaseUrl: config.apiBaseUrl,
        path: config.endpoints.forgetRequest,
        method: "POST",
        body: body,
        idToken,
      });

      if (!res.ok) {
        const message =
          (res.data && (res.data.message || res.data.error || res.data.msg)) ||
          `Request failed (${res.status})`;
        showToast({
          type: "error",
          title: "การส่งล้มเหลว",
          message: message,
        });
        return;
      }

      // ส่งคำขอสำเร็จ
      showToast({
        type: "success",
        title: "ส่งแล้ว",
        message: "คำขอลืมเวลา (forget-time) ของคุณถูกส่งเรียบร้อยแล้ว",
      });

      // ส่งข้อความผ่าน LIFF
      await trySendMessage("ส่งคำขอ forget-time สำเร็จแล้ว");

      form.reset(); // รีเซ็ตฟอร์ม

      // ซ่อน preview ถ้ามี
      const previewContainer = document.getElementById("previewContainer");
      if (previewContainer) previewContainer.classList.add("hidden");

      // Close window
      setTimeout(() => {
        if (globalThis.liff?.isInClient()) {
          globalThis.liff.closeWindow();
        }
      }, 2000);
    } catch (err) {
      const msg = formatErrorMessage(err) || err?.message || String(err);
      showToast({
        type: "error",
        title: "Unexpected error",
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  });
}

// เรียกใช้ฟังก์ชันบูตสแตรป
await bootstrap();
