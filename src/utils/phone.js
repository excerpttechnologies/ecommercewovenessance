function normalisePhone(value, { required = false } = {}) {
  const phone = String(value || "").replace(/\D/g, "");
  if (!phone && !required) return "";
  if (!/^\d{10}$/.test(phone)) throw new Error("Phone number must contain exactly 10 digits");
  return phone;
}

module.exports = { normalisePhone };