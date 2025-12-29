// ==============================================================================
// ฟังก์ชันช่วยเหลือสำหรับการเริ่มต้น LIFF SDK หรือโยนข้อผิดพลาด
export async function initLiffOrThrow(liffId) {
  if (!globalThis.liff)
    throw new Error(
      "LIFF SDK ไม่ถูกโหลด. โปรดตรวจสอบให้แน่ใจว่าได้รวม https://static.line-scdn.net/liff/edge/2/sdk.js"
    );
  if (!liffId) throw new Error("ขาด LIFF ID");

  await globalThis.liff.init({ liffId });
  if (globalThis.liff.ready) await globalThis.liff.ready;
  return globalThis.liff;
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

  globalThis.liff.login({
    redirectUri: redirectUri || globalThis.location.href,
  });
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
