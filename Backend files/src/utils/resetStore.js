/* ============================================================
   ONE-TIME RESET CODE STORE (in-memory, demo-safe)
   Codes expire after TTL minutes and can be used only once.
   ============================================================ */
const crypto = require("crypto");

const TTL_MINUTES = Number(process.env.RESET_CODE_TTL_MINUTES) || 20;
const store = new Map(); // email -> { code, expiresAt, used }

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion

function generateCode() {
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += CHARSET[bytes[i] % CHARSET.length];
  return code.slice(0, 4) + "-" + code.slice(4); // e.g. VAZT-9B66
}

function createCode(email) {
  const key = String(email).toLowerCase().trim();
  const code = generateCode();
  store.set(key, { code, expiresAt: Date.now() + TTL_MINUTES * 60 * 1000, used: false });
  return code;
}

function verifyCode(email, code) {
  const key = String(email).toLowerCase().trim();
  const entry = store.get(key);
  if (!entry) return { ok: false, reason: "No reset code requested for this email." };
  if (entry.used) return { ok: false, reason: "This code was already used." };
  if (Date.now() > entry.expiresAt) { store.delete(key); return { ok: false, reason: "This code has expired." }; }
  if (entry.code !== String(code).toUpperCase().trim()) return { ok: false, reason: "Incorrect code." };
  entry.used = true; // one-time use
  return { ok: true };
}

module.exports = { createCode, verifyCode, TTL_MINUTES };