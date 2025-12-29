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
import { isEmptyErrors, validateRegister } from "../core/validation.js";

function requireDayjs() {
  if (!globalThis.dayjs)
    throw new Error(
      "dayjs not loaded. Include https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js"
    );
}

// แปลงค่าจาก input วันที่ (YYYY-MM-DD) เป็น ISO string
function toIsoFromDateInput(yyyyMmDd) {
  // dayjs parses YYYY-MM-DD as local date.
  return globalThis.dayjs(yyyyMmDd).startOf("day").toISOString();
}

// อ่านข้อมูลจากฟอร์ม
function readPayload() {
  const name = document.getElementById("name").value;
  const IDCard = document.getElementById("IDCard").value;
  const conpanyId = document.getElementById("conpanyId").value;
  const startDateInput = document.getElementById("start_date").value;

  return {
    name: String(name || "").trim(),
    IDCard: String(IDCard || "").trim(),
    conpanyId: Number(conpanyId),
    start_date: startDateInput ? toIsoFromDateInput(startDateInput) : "",
  };
}

// โหลดรายชื่อบริษัท
async function loadCompanies(apiBaseUrl) {
  const select = document.getElementById("conpanyId");
  if (!select) return;

  try {
    const res = await apiRequest({
      apiBaseUrl,
      path: "/api/companies",
      method: "GET",
    });

    if (res.ok && Array.isArray(res.data)) {
      // Clear existing options except the first one
      while (select.options.length > 1) {
        select.remove(1);
      }

      res.data.forEach((company) => {
        const option = document.createElement("option");
        option.value = company.id;
        option.textContent = company.name;
        select.appendChild(option);
      });
    } else {
      console.error("Failed to load companies:", res.error);
      showToast({
        type: "error",
        title: "ข้อผิดพลาด",
        message: "ไม่สามารถโหลดรายชื่อบริษัทได้",
      });
    }
  } catch (err) {
    console.error("Error loading companies:", err);
    showToast({
      type: "error",
      title: "ข้อผิดพลาด",
      message: "เกิดข้อผิดพลาดในการโหลดรายชื่อบริษัท",
    });
  }
}

// ==============================================================================
// ฟังก์ชันบูตสแตรปหน้า Register
async function bootstrap() {
  hideBanner(); // ซ่อนแบนเนอร์แจ้งเตือน
  setLoading(false); // ปิดสถานะโหลด
  setText("statusText", "กำลังเริ่ม..."); // อัปเดตสถานะเริ่มต้น

  // ตรวจสอบการโหลดไลบรารี dayjs
  requireDayjs();

  // ดึงการตั้งค่ารันไทม์
  const { config, warnings } = getRuntimeConfig();
  if (config.debug) console.log("[LIFF Register] runtime config", config);
  if (warnings.length) {
    showToast({
      type: "warning",
      title: "การกำหนดค่า",
      message: warnings.join(" | "),
    });
  }

  // เริ่มต้น LIFF และตั้งค่า UI
  await initializeLiffAndUI(config);

  // ตั้งค่าการส่งฟอร์มลงทะเบียน
  setupFormSubmission(config);
}

async function initializeLiffAndUI(config) {
  try {
    const liff = await initLiffOrThrow(config.liffId); // เริ่มต้น LIFF SDK

    // บังคับให้ล็อกอินถ้าจำเป็น
    if (config.requireLogin && !liff.isLoggedIn()) {
      const redirectUri = `${globalThis.location.origin}/register`;
      setText("statusText", "กำลังเปลี่ยนเส้นทางไปยังการเข้าสู่ระบบ LINE...");
      showToast({
        type: "warning",
        title: "ต้องเข้าสู่ระบบ",
        message:
          "กำลังเปลี่ยนเส้นทางไปยังการเข้าสู่ระบบ LINE โปรดตั้งค่า LIFF Endpoint URL ใน LINE Developers ให้ตรงกับ URL หน้านี้ (แนะนำ: /register).",
      });
      ensureLoggedIn({ redirectUri });
      return;
    }

    // ดึงข้อมูลโปรไฟล์ผู้ใช้และตั้งค่า UI
    await setupUserProfile();

    // โหลดข้อมูลบริษัท
    await loadCompanies(config.apiBaseUrl);

    setText("statusText", "พร้อม");
  } catch (err) {
    if (config.debug) console.error("[LIFF Register] init failed", err);
    setText("statusText", "ไม่พร้อม");
    showToast({
      type: "error",
      title: "การเริ่ม LIFF ล้มเหลว",
      message:
        (err?.message || String(err)) +
        " | ตรวจสอบ: (1) หน้าเว็บต้องให้บริการผ่าน HTTPS (ไม่ใช่ file://), (2) ตั้งค่า LIFF Endpoint URL ใน LINE Developers ให้ตรงกับ URL หน้านี้",
    });
  }
}

async function setupUserProfile() {
  const profile = await getProfileSafe();

  let isLoggedIn;
  if (typeof liff?.isLoggedIn === "function") {
    isLoggedIn = liff.isLoggedIn();
  } else if (
    globalThis.liff &&
    typeof globalThis.liff.isLoggedIn === "function"
  ) {
    isLoggedIn = globalThis.liff.isLoggedIn();
  } else {
    isLoggedIn = false;
  }
  setText("liffState", isLoggedIn ? "เข้าสู่ระบบแล้ว" : "ยังไม่เข้าสู่ระบบ");

  const userId = profile?.userId || "-";
  let displayUserId;
  if (userId && userId !== "-") {
    displayUserId =
      userId.length > 10 ? userId.substring(0, 10) + "..." : userId;
  } else {
    displayUserId = "-";
  }
  setText("lineUserId", displayUserId);
  setText("displayName", profile?.displayName || "-");

  // แสดงรูปโปรไฟล์ โดยจัดการ Tailwind 'hidden' class
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

function setupFormSubmission(config) {
  const form = document.getElementById("registerForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // ป้องกันการส่งฟอร์มแบบดีฟอลต์
    clearFormErrors("registerForm"); // ล้างข้อผิดพลาดในฟอร์ม
    hideBanner(); // ซ่อนแบนเนอร์แจ้งเตือน

    // อ่านข้อมูลจากฟอร์มและตรวจสอบความถูกต้อง
    const payload = readPayload();
    const errors = validateRegister(payload);

    // ถ้ามีข้อผิดพลาด ให้แสดงข้อผิดพลาดและหยุดการส่ง
    if (!isEmptyErrors(errors)) {
      setFormErrors("registerForm", errors);
      showToast({
        type: "error",
        title: "การตรวจสอบข้อมูล",
        message: "กรุณาแก้ไขฟิลด์ที่ไฮไลต์",
      });
      return;
    }

    // ดึงโทเค็นการเข้าถึงอย่างปลอดภัย
    const accessToken = getAccessTokenSafe();

    setLoading(true); // ตั้งค่าสถานะโหลด
    setText("statusText", "กำลังส่ง...");
    try {
      const res = await apiRequest({
        apiBaseUrl: config.apiBaseUrl,
        path: config.endpoints.register,
        method: "POST",
        body: payload,
        accessToken,
      });

      if (!res.ok) {
        showToast({
          type: "error",
          title: "การส่งล้มเหลว",
          message: res.error,
        });
        setText("statusText", "ล้มเหลว");
        return;
      }

      // ส่งคำขอสำเร็จ
      showToast({
        type: "success",
        title: "ลงทะเบียนแล้ว",
        message: "การลงทะเบียนของคุณถูกส่งเรียบร้อยแล้ว",
      });
      setText("statusText", "สำเร็จ");

      // Optional: send a message back to the chat using LIFF messaging feature.
      await trySendMessage("ส่งคำขอการลงทะเบียนสำเร็จแล้ว");

      form.reset(); // รีเซ็ตฟอร์ม
    } catch (err) {
      showToast({
        type: "error",
        title: "Unexpected error",
        message: err?.message || String(err),
      });
      setText("statusText", "ล้มเหลว");
    } finally {
      setLoading(false);
    }
  });
}

await bootstrap();
