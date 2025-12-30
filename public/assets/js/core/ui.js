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

// ฟังก์ชันแสดง Toast Notification
export function showToast({ type, title, message, duration = 3000 }) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");

  // กำหนดสีและไอคอนตามประเภท
  let borderClass = "border-l-4 border-slate-500";
  let iconHtml = "";
  let titleColor = "text-slate-900";

  if (type === "success") {
    borderClass = "border-l-4 border-green-500";
    iconHtml = `<svg class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
  } else if (type === "error") {
    borderClass = "border-l-4 border-red-500";
    iconHtml = `<svg class="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;
  } else if (type === "warning") {
    borderClass = "border-l-4 border-yellow-500";
    iconHtml = `<svg class="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`;
  }

  toast.className = `pointer-events-auto flex w-full transform items-start gap-3 rounded-lg bg-white p-4 shadow-lg ring-1 ring-black/5 transition-all duration-300 ease-out translate-y-[-100%] opacity-0 ${borderClass}`;

  toast.innerHTML = `
    <div class="flex-shrink-0 pt-0.5">${iconHtml}</div>
    <div class="flex-1 w-0">
      <p class="text-sm font-medium ${titleColor}">${escapeHtml(
    title || ""
  )}</p>
      ${
        message
          ? `<p class="mt-1 text-sm text-slate-500">${escapeHtml(message)}</p>`
          : ""
      }
    </div>
    <div class="flex-shrink-0 ml-4 flex">
      <button class="inline-flex rounded-md bg-white text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2">
        <span class="sr-only">Close</span>
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L10 8.586 5.707 4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  `;

  // Close button logic
  const closeBtn = toast.querySelector("button");
  closeBtn.onclick = () => {
    toast.classList.add("opacity-0", "translate-y-[-100%]");
    setTimeout(() => toast.remove(), 300);
  };

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-[-100%]", "opacity-0");
  });

  // Auto remove
  if (duration > 0) {
    setTimeout(() => {
      if (toast.isConnected) {
        toast.classList.add("opacity-0", "translate-y-[-100%]");
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }
}

// ฟังก์ชันแสดงแบนเนอร์ข้อความแจ้งเตือน (Deprecated: Use showToast instead)
export function showBanner({ type, title, message }) {
  showToast({ type, title, message });
}

// ฟังก์ชันซ่อนแบนเนอร์ข้อความแจ้งเตือน
export function hideBanner() {
  // No-op for toast
}

// ฟังก์ชันตั้งค่าสถานะการโหลดในปุ่มส่งข้อมูล
export function setLoading(isLoading) {
  const btn = document.getElementById("submitBtn");
  const spinner = document.getElementById("loadingSpinner");
  if (btn) {
    btn.disabled = Boolean(isLoading);
    // เก็บข้อความเดิมไว้ถ้ายังไม่มี
    if (!btn.dataset.defaultText) {
      btn.dataset.defaultText =
        btn.querySelector("span")?.textContent || btn.textContent;
    }

    // แสดง/ซ่อนข้อความภายในปุ่ม (อย่าเอาปุ่มออกจาก DOM)
    const span = btn.querySelector("span");
    if (span) {
      if (isLoading) span.classList.add("opacity-0");
      else span.classList.remove("opacity-0");
    }
  }

  if (spinner) {
    // Ensure spinner is shown only when loading. Use style.display as a fallback
    // in case the `hidden` attribute is not respected by CSS in some environments.
    try {
      spinner.hidden = !isLoading;
    } catch (e) {
      console.error("Error setting spinner hidden property:", e);
    }
    spinner.style.display = isLoading ? "flex" : "none";
  }
}

// ============================================================================
// Global full-screen loading overlay
export function showGlobalLoader(message = "กำลังเชื่อมต่อ...") {
  let overlay = document.getElementById("globalLoadingOverlay");
  if (overlay) {
    overlay.style.display = "flex";
    const msgEl = overlay.querySelector("div > div");
    if (msgEl) msgEl.textContent = message;
  } else {
    overlay = document.createElement("div");
    overlay.id = "globalLoadingOverlay";
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.background = "rgba(0,0,0,0.5)";
    overlay.style.zIndex = "9999";
    overlay.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <svg class="loader-spin" width="48" height="48" viewBox="0 0 50 50" style="animation:spin 1s linear infinite;">
          <circle cx="25" cy="25" r="20" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="31.4 31.4"></circle>
        </svg>
        <div style="color:#fff;font-size:16px;">${escapeHtml(message)}</div>
      </div>
    `;

    // small keyframe for spin (inject once)
    const styleId = "globalLoaderStyles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
  }
}

export function hideGlobalLoader() {
  const overlay = document.getElementById("globalLoadingOverlay");
  if (overlay) overlay.style.display = "none";
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
