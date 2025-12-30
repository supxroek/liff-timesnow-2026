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
import { isEmptyErrors, validateRegister } from "../core/validation.js";

function requireDayjs() {
  if (!globalThis.dayjs)
    throw new Error(
      "dayjs ไลบรารีไม่ถูกโหลด. ตรวจสอบให้แน่ใจว่าได้รวมสคริปต์ dayjs ในหน้าเว็บของคุณแล้ว"
    );
}

// แปลงค่าจาก input วันที่ (YYYY-MM-DD) เป็น ISO string
function toIsoFromDateInput(yyyyMmDd) {
  // dayjs parses YYYY-MM-DD as local date.
  return globalThis.dayjs(yyyyMmDd).startOf("day").toISOString();
}

// อ่านข้อมูลจากฟอร์ม
async function readPayload() {
  const profile = await getProfileSafe();

  const name = document.getElementById("name").value;
  const IDCard = document.getElementById("IDCard").value;
  const companyId = document.getElementById("companyId").value;
  const lineUserId = profile?.userId || "";
  const startDateInput = document.getElementById("start_date").value;

  return {
    name: String(name || "").trim(),
    IDCard: String(IDCard || "").trim(),
    companyId: Number(companyId),
    lineUserId: String(lineUserId || "").trim(),
    start_date: startDateInput ? toIsoFromDateInput(startDateInput) : "",
  };
}

// ดึงรายชื่อบริษัทจาก API
function parseCompanies(res) {
  if (Array.isArray(res.data)) return res.data;
  if (res.data && Array.isArray(res.data.data)) return res.data.data;
  if (res.data && Array.isArray(res.data.results)) return res.data.results;
  return null;
}

// เติมข้อมูลบริษัทลงใน select element
function populateSelect(select, companies) {
  // Clear existing options except the first one
  while (select.options.length > 1) {
    select.remove(1);
  }
  companies.forEach((company) => {
    const option = document.createElement("option");
    option.value = company.id;
    option.textContent = company.name;
    select.appendChild(option);
  });
}

// โหลดรายชื่อบริษัท
async function loadCompanies(config) {
  const select = document.getElementById("companyId");
  if (!select) return;

  // ดึง ID token อย่างปลอดภัย เพื่อส่งให้ backend ตรวจสอบ (LIFF ให้ getIDToken)
  // getIdTokenSafe may be synchronous or return a promise in future; await to be safe
  const idToken = await getIdTokenSafe();

  // If no idToken, force login (if required) or show a helpful message
  if (!idToken) {
    if (config.requireLogin) {
      // Redirect to login flow
      ensureLoggedIn({ redirectUri: `${globalThis.location.origin}/register` });
      return;
    }
    console.warn("loadCompanies: missing idToken");
    showToast({
      type: "error",
      title: "ข้อผิดพลาด",
      message: "ไม่พบ Id token ของผู้ใช้ กรุณาเข้าสู่ระบบ",
    });
    return;
  }

  try {
    const res = await apiRequest({
      apiBaseUrl: config.apiBaseUrl,
      path: config.endpoints.company,
      method: "GET",
      idToken,
    });

    if (res.ok) {
      const companies = parseCompanies(res);
      if (companies) {
        populateSelect(select, companies);
        return;
      }

      console.error("Failed to load companies: unexpected response shape", res);
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
  // statusText UI updates removed per request

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
      // statusText UI updates removed per request
      showToast({
        type: "warning",
        title: "ต้องเข้าสู่ระบบ",
        message: "กำลังเปลี่ยนเส้นทางไปยังหน้าการเข้าสู่ระบบ LINE...",
      });
      ensureLoggedIn({ redirectUri });
      return;
    }

    // ดึงข้อมูลโปรไฟล์ผู้ใช้และตั้งค่า UI
    await setupUserProfile();

    // โหลดข้อมูลบริษัท
    await loadCompanies(config);
    // statusText UI updates removed per request
  } catch (err) {
    if (config.debug) console.error("[LIFF Register] init failed", err);
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
    const payload = await readPayload();
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
    const idToken = await getIdTokenSafe();

    setLoading(true); // ตั้งค่าสถานะโหลด
    // statusText UI updates removed per request
    try {
      const res = await apiRequest({
        apiBaseUrl: config.apiBaseUrl,
        path: config.endpoints.register,
        method: "POST",
        body: payload,
        idToken,
      });

      if (!res.ok) {
        showToast({
          type: "error",
          title: "การส่งล้มเหลว",
          message: res.error,
        });
        // statusText UI updates removed per request
        return;
      }

      // ส่งคำขอสำเร็จ
      showToast({
        type: "success",
        title: "ลงทะเบียนแล้ว",
        message: "การลงทะเบียนของคุณถูกส่งเรียบร้อยแล้ว",
      });
      // statusText UI updates removed per request

      // Optional: send a message back to the chat using LIFF messaging feature.
      await trySendMessage("ส่งคำขอการลงทะเบียนสำเร็จแล้ว");

      form.reset(); // รีเซ็ตฟอร์ม
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

await bootstrap();
