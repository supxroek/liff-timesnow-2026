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
  showBanner,
} from "../core/ui.js";
import { isEmptyErrors, validateForgetTime } from "../core/validation.js";

function requireDayjs() {
  if (!globalThis.dayjs)
    throw new Error(
      "dayjs not loaded. Include https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js"
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
  const time = document.getElementById("time").value;
  const reason = document.getElementById("reason").value;
  const evidence = document.getElementById("evidence").value;

  return {
    timestamp_type: String(timestamp_type || "").trim(),
    date: dateInput ? toIsoFromDateInput(dateInput) : "",
    time: String(time || "").trim(),
    reason: String(reason || "").trim(),
    evidence: evidence === "" ? "" : String(evidence),
  };
}

// ==============================================================================
// ฟังก์ชันบูตสแตรปหน้า Forget Time
async function bootstrap() {
  hideBanner(); // ซ่อนแบนเนอร์แจ้งเตือน
  setLoading(false); // ปิดสถานะโหลด
  setText("statusText", "กำลังเริ่ม..."); // อัปเดตสถานะเริ่มต้น

  // ตรวจสอบการโหลดไลบรารี dayjs
  requireDayjs();

  // ดึงการตั้งค่ารันไทม์
  const { config, warnings } = getRuntimeConfig();
  if (config.debug) console.log("[LIFF ForgetTime] runtime config", config);
  if (warnings.length) {
    showBanner({
      type: "warning",
      title: "การกำหนดค่า",
      message: warnings.join(" | "),
    });
  }

  // ==============================================================================
  // เริ่มต้น LIFF SDK
  try {
    const liff = await initLiffOrThrow(config.liffId); // เริ่มต้น LIFF SDK

    // ตรวจสอบการล็อกอินถ้าจำเป็น
    if (config.requireLogin && !liff.isLoggedIn()) {
      const redirectUri = `${globalThis.location.origin}/forget-time`;
      setText("statusText", "กำลังเปลี่ยนเส้นทางไปยังการเข้าสู่ระบบ LINE...");
      showBanner({
        type: "warning",
        title: "ต้องเข้าสู่ระบบ",
        message:
          "กำลังเปลี่ยนเส้นทางไปยังการเข้าสู่ระบบ LINE โปรดตั้งค่า LIFF Endpoint URL ใน LINE Developers ให้ตรงกับ URL หน้านี้ (แนะนำ: /forget-time).",
      });
      ensureLoggedIn({ redirectUri });
      return;
    }

    // ดึงข้อมูลโปรไฟล์ผู้ใช้
    const profile = await getProfileSafe();
    setText(
      "liffState",
      globalThis.liff.isLoggedIn() ? "เข้าสู่ระบบแล้ว" : "ยังไม่เข้าสู่ระบบ"
    );
    setText("lineUserId", profile?.userId || "-");
    setText("displayName", profile?.displayName || "-");

    setText("statusText", "พร้อม"); // อัปเดตสถานะพร้อม
  } catch (err) {
    if (config.debug) console.error("[LIFF ForgetTime] init failed", err);
    setText("statusText", "ไม่พร้อม");
    showBanner({
      type: "error",
      title: "การเริ่ม LIFF ล้มเหลว",
      message:
        (err?.message || String(err)) +
        " | ตรวจสอบ: (1) หน้าเว็บต้องให้บริการผ่าน HTTPS (ไม่ใช่ file://), (2) ตั้งค่า LIFF Endpoint URL ใน LINE Developers ให้ตรงกับ URL หน้านี้",
    });
  }

  // ==============================================================================
  // ตั้งค่าการส่งฟอร์มลืมบันทึกเวลา
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
      showBanner({
        type: "error",
        title: "การตรวจสอบข้อมูล",
        message: "กรุณาแก้ไขฟิลด์ที่ไฮไลต์",
      });
      return;
    }

    // ดึงโทเค็นการเข้าถึงอย่างปลอดภัย
    const accessToken = getAccessTokenSafe();

    setLoading(true);
    setText("statusText", "กำลังส่ง...");
    try {
      const res = await apiRequest({
        apiBaseUrl: config.apiBaseUrl,
        path: config.endpoints.forgetTime,
        method: "POST",
        body: payload,
        accessToken,
      });

      if (!res.ok) {
        showBanner({
          type: "error",
          title: "การส่งล้มเหลว",
          message: res.error,
        });
        setText("statusText", "ล้มเหลว");
        return;
      }

      // ส่งคำขอสำเร็จ
      showBanner({
        type: "success",
        title: "ส่งแล้ว",
        message: "คำขอลืมเวลา (forget-time) ของคุณถูกส่งเรียบร้อยแล้ว",
      });
      setText("statusText", "สำเร็จ");

      // ส่งข้อความผ่าน LIFF
      await trySendMessage("ส่งคำขอ forget-time สำเร็จแล้ว");

      form.reset(); // รีเซ็ตฟอร์ม
    } catch (err) {
      showBanner({
        type: "error",
        title: "Unexpected error",
        message: err?.message || String(err),
      });
      setText("statusText", "Failed");
    } finally {
      setLoading(false);
    }
  });
}

// เรียกใช้ฟังก์ชันบูตสแตรป
await bootstrap();
