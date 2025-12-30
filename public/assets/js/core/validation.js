const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

// ==============================================================================
// ฟังก์ชันตรวจสอบความถูกต้องของข้อมูลการลงทะเบียน (Register)
export function validateRegister(payload) {
  const errors = {};

  // ตรวจสอบชื่อ
  const name = String(payload.name || "").trim();
  if (!name) errors.name = "กรุณาระบุชื่อ";
  else if (name.length < 3) errors.name = "ชื่ออย่างน้อย 3 ตัวอักษร";
  else if (name.length > 30) errors.name = "ชื่อไม่เกิน 30 ตัวอักษร";

  const idCard = String(payload.IDCard || "").trim();
  if (!idCard) errors.IDCard = "กรุณาระบุหมายเลขบัตรประชาชน";
  else if (!/^\d{13}$/.test(idCard))
    errors.IDCard = "หมายเลขบัตรประชาชนต้องมี 13 หลัก";

  const companyIdRaw = payload.companyId;
  const companyIdNum = Number(companyIdRaw);
  if (!Number.isInteger(companyIdNum) || companyIdNum <= 0)
    errors.companyId = "รหัสบริษัทต้องเป็นจำนวนเต็มบวก";

  const startDate = String(payload.start_date || "").trim();
  if (!startDate) errors.start_date = "กรุณาระบุวันที่เริ่มต้นงาน";
  else if (!isIsoDate(startDate))
    errors.start_date = "วันที่เริ่มต้นงานต้องเป็นรูปแบบ ISO";

  return errors;
}

// ==============================================================================
// ฟังก์ชันตรวจสอบความถูกต้องของข้อมูลการลืมบันทึกเวลา (Forget Time)
export function validateForgetTime(payload) {
  const errors = {};

  const allowedTypes = new Set([
    "work_in",
    "break_in",
    "ot_in",
    "work_out",
    "break_out",
    "ot_out",
  ]);
  const type = String(payload.timestamp_type || "").trim();
  if (!type) errors.timestamp_type = "กรุณาระบุประเภท Timestamp";
  else if (!allowedTypes.has(type))
    errors.timestamp_type = "ประเภท Timestamp ไม่ถูกต้อง";

  const date = String(payload.date || "").trim();
  if (!date) errors.date = "กรุณาระบุวันที่";
  else if (!isIsoDate(date)) errors.date = "วันที่ต้องเป็นรูปแบบ ISO";

  const time = String(payload.time || "").trim();
  if (!time) errors.time = "กรุณาระบุเวลา";
  else if (!TIME_REGEX.test(time))
    errors.time = "เวลาต้องเป็นรูปแบบ HH:mm หรือ HH:mm:ss";

  const reason = String(payload.reason || "").trim();
  if (!reason) errors.reason = "กรุณาระบุเหตุผล";
  else if (reason.length > 500)
    errors.reason = "เหตุผลต้องไม่เกิน 500 ตัวอักษร";

  const evidence = payload.evidence;
  if (evidence != null) {
    const evidenceStr = String(evidence);
    if (evidenceStr.length > 65535) errors.evidence = "หลักฐานยาวเกินไป";
  }

  return errors;
}

// ==============================================================================
// ฟังก์ชันตรวจสอบว่ามีข้อผิดพลาดหรือไม่
export function isEmptyErrors(errors) {
  return !errors || Object.keys(errors).length === 0;
}
// ฟังก์ชันตรวจสอบว่าค่าเป็นวันที่ในรูปแบบ ISO หรือไม่
function isIsoDate(value) {
  // Accept full ISO strings; also accept YYYY-MM-DD (we'll convert with dayjs later)
  if (!value) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
  return !Number.isNaN(Date.parse(value));
}
