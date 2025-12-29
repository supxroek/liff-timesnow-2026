// ==============================================================================
// ฟังก์ชันช่วยเหลือสำหรับการจัดการ UI

// ฟังก์ชันตั้งค่าข้อความธรรมดาในองค์ประกอบที่ระบุด้วย ID
export function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
}

// ฟังก์ชันตั้งค่า HTML ในองค์ประกอบที่ระบุด้วย ID
export function setHtml(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html;
}

// ฟังก์ชันแสดงแบนเนอร์ข้อความแจ้งเตือน
export function showBanner({ type, title, message }) {
  const host = document.getElementById("banner");
  if (!host) return;

  let color = "bg-red-50 border-red-200 text-red-800";
  if (type === "success") color = "bg-green-50 border-green-200 text-green-800";
  if (type === "warning")
    color = "bg-yellow-50 border-yellow-200 text-yellow-800";

  host.className = `w-full rounded-lg border p-3 ${color}`;
  host.innerHTML = `
    <div class="font-semibold">${escapeHtml(title || "")}</div>
    <div class="text-sm mt-1">${escapeHtml(message || "")}</div>
  `;
  host.hidden = false;
}

// ฟังก์ชันซ่อนแบนเนอร์ข้อความแจ้งเตือน
export function hideBanner() {
  const host = document.getElementById("banner");
  if (!host) return;
  host.hidden = true;
}

// ฟังก์ชันตั้งค่าสถานะการโหลดในปุ่มส่งข้อมูล
export function setLoading(isLoading) {
  const btn = document.getElementById("submitBtn");
  if (btn) {
    btn.disabled = Boolean(isLoading);
    btn.dataset.loading = isLoading ? "1" : "0";
    btn.textContent = isLoading
      ? "Submitting..."
      : btn.dataset.defaultText || "Submit";
  }

  const spinner = document.getElementById("loadingSpinner");
  if (spinner) spinner.hidden = !isLoading;
}

// ฟังก์ชันล้างข้อผิดพลาดในฟอร์มที่ระบุด้วย ID
export function clearFormErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.querySelectorAll("[data-error-for]").forEach((el) => {
    el.textContent = "";
  });
}

// ฟังก์ชันตั้งค่าข้อผิดพลาดในฟอร์มที่ระบุด้วย ID
export function setFormErrors(formId, errors) {
  const form = document.getElementById(formId);
  if (!form || !errors) return;

  Object.entries(errors).forEach(([key, msg]) => {
    const el = form.querySelector(`[data-error-for="${cssEscape(key)}"]`);
    if (el) el.textContent = msg;
  });
}

// ฟังก์ชันช่วยเหลือสำหรับการหนีอักขระพิเศษใน CSS selectors
function cssEscape(value) {
  return String(value).replaceAll('"', String.raw`\"`);
}

// ฟังก์ชันช่วยเหลือสำหรับการหนีอักขระพิเศษใน HTML
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
