import { getRuntimeConfig } from "../core/config.js";
import { apiRequest } from "../core/api.js";
import {
  initLiffOrThrow,
  ensureLoggedIn,
  getAccessTokenSafe,
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
  return globalThis.dayjs(yyyyMmDd).startOf("day").toISOString();
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
        (err?.message || String(err)) +
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

    // ดึงโทเค็นการเข้าถึงอย่างปลอดภัย
    const accessToken = getAccessTokenSafe();
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
    // statusText UI updates removed per request

    try {
      // สร้าง FormData สำหรับส่งไฟล์
      const formData = new FormData();
      formData.append("timestampType", payload.timestamp_type);
      formData.append("forgetDate", payload.date);
      formData.append("forgetTime", payload.time);
      formData.append("reason", payload.reason);
      formData.append("lineUserId", profile.userId);

      const evidenceInput = document.getElementById("evidence");
      if (evidenceInput.files.length > 0) {
        formData.append("evidence", evidenceInput.files[0]);
      }
      const res = await apiRequest({
        apiBaseUrl: config.apiBaseUrl,
        path: config.endpoints.forgetTime,
        method: "POST",
        body: formData,
        accessToken,
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
      // statusText UI updates removed per request

      // ส่งข้อความผ่าน LIFF
      await trySendMessage("ส่งคำขอ forget-time สำเร็จแล้ว");

      form.reset(); // รีเซ็ตฟอร์ม

      // ซ่อน preview ถ้ามี
      const previewContainer = document.getElementById("previewContainer");
      if (previewContainer) previewContainer.classList.add("hidden");
    } catch (err) {
      showToast({
        type: "error",
        title: "Unexpected error",
        message: err?.message || String(err),
      });
      // statusText UI updates removed per request
    } finally {
      setLoading(false);
    }
  });
}

// เรียกใช้ฟังก์ชันบูตสแตรป
await bootstrap();
