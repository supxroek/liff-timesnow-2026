import { showGlobalLoader, hideGlobalLoader } from "./ui.js";

// ============================================================================
// ฟังก์ชันช่วยเหลือสำหรับการเริ่มต้น LIFF SDK หรือโยนข้อผิดพลาด
export async function initLiffOrThrow(liffId) {
  if (!globalThis.liff)
    throw new Error(
      "LIFF SDK ไม่ถูกโหลด. ตรวจสอบให้แน่ใจว่าได้รวมสคริปต์ LIFF SDK ในหน้าเว็บของคุณแล้ว"
    );
  if (!liffId) throw new Error("ขาด LIFF ID");

  // แสดง overlay ขณะเริ่ม LIFF
  try {
    showGlobalLoader("กำลังเริ่มระบบ LINE...");
    await globalThis.liff.init({ liffId });
    if (globalThis.liff.ready) await globalThis.liff.ready;
    return globalThis.liff;
  } finally {
    // ซ่อน overlay เสมอ (กรณี error หรือ success)
    hideGlobalLoader();
  }
}

// ==============================================================================
// ฟังก์ชันช่วยเหลือสำหรับการตรวจสอบสถานะการล็อกอินและดึงข้อมูลโปรไฟล์
export function isLoggedIn() {
  if (!globalThis.liff) return false;
  return globalThis.liff.isLoggedIn();
}

// ==============================================================================
// ฟังก์ชันช่วยเหลือเพื่อบังคับให้ผู้ใช้ล็อกอิน
export function ensureLoggedIn({ redirectUri } = {}) {
  if (!globalThis.liff) throw new Error("LIFF SDK ไม่ได้ถูกเริ่มต้น");
  if (globalThis.liff.isLoggedIn()) return;

  try {
    showGlobalLoader("กำลังเปลี่ยนเส้นทางไปยังการเข้าสู่ระบบ...");
    globalThis.liff.login({
      redirectUri: redirectUri || globalThis.location.href,
    });
  } catch (err) {
    hideGlobalLoader();
    throw err;
  }
}

// ==============================================================================
// ฟังก์ชันช่วยเหลือสำหรับดึงข้อมูลโปรไฟล์และโทเค็นการเข้าถึงอย่างปลอดภัย
export async function getProfileSafe() {
  if (!globalThis.liff) return null;
  try {
    return await globalThis.liff.getProfile();
  } catch {
    return null;
  }
}

// ==============================================================================
// ฟังก์ชันช่วยเหลือสำหรับดึงโทเค็นการเข้าถึงอย่างปลอดภัย
export function getAccessTokenSafe() {
  if (!globalThis.liff) return null;
  try {
    return globalThis.liff.getAccessToken();
  } catch {
    return null;
  }
}

// ฟังก์ชันช่วยเหลือสำหรับดึง ID token อย่างปลอดภัย (ใช้สำหรับตรวจสอบฝั่งเซิร์ฟเวอร์)
export function getIdTokenSafe() {
  if (!globalThis.liff) return null;
  try {
    // LIFF SDK provides getIDToken()
    return typeof globalThis.liff.getIDToken === "function"
      ? globalThis.liff.getIDToken()
      : null;
  } catch {
    return null;
  }
}

// ==============================================================================
// ฟังก์ชันช่วยเหลือสำหรับส่งข้อความผ่าน LIFF
export async function trySendMessage(text) {
  if (!globalThis.liff) return { ok: false, reason: "LIFF ไม่พร้อมใช้งาน" };
  if (!globalThis.liff.isInClient())
    return { ok: false, reason: "ไม่อยู่ในไคลเอนต์ LINE" };

  try {
    await globalThis.liff.sendMessages([{ type: "text", text }]);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message || "sendMessages failed" };
  }
}
