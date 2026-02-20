const RE = {
  description: /^\S(?:.*\S)?$/,
  amount: /^(0|[1-9]\d*)(\.\d{1,2})?$/,
  date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  category: /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,
  duplicateWord: /\b(\w+)\s+\1\b/i,
  currencyCode: /^[A-Z]{3}$/,
};

export function normalizeSpaces(value) {
  return value.replace(/\s{2,}/g, " ").trim();
}

export function validateDescription(value) {
  const normalized = normalizeSpaces(value);
  if (!RE.description.test(normalized)) {
    return { valid: false, message: "Description cannot start/end with spaces." };
  }
  if (RE.duplicateWord.test(normalized)) {
    return { valid: false, message: "Duplicate consecutive words are not allowed." };
  }
  return { valid: true, value: normalized };
}

export function validateAmount(value) {
  const trimmed = value.trim();
  if (!RE.amount.test(trimmed)) {
    return { valid: false, message: "Use a valid number (e.g. 0, 10, 10.25)." };
  }
  return { valid: true, value: Number.parseFloat(trimmed) };
}

export function validateDate(value) {
  if (!RE.date.test(value)) {
    return { valid: false, message: "Use YYYY-MM-DD format." };
  }
  return { valid: true, value };
}

export function validateCategory(value) {
  const normalized = normalizeSpaces(value);
  if (!RE.category.test(normalized)) {
    return { valid: false, message: "Only letters, spaces, and hyphens are allowed." };
  }
  return { valid: true, value: normalized };
}

export function validateCurrencyCode(value) {
  if (!RE.currencyCode.test(value.trim().toUpperCase())) {
    return { valid: false, message: "Currency code must be 3 uppercase letters." };
  }
  return { valid: true, value: value.trim().toUpperCase() };
}

export function validateRecordShape(record) {
  if (!record || typeof record !== "object") return false;
  const required = ["id", "description", "amount", "category", "date", "createdAt", "updatedAt"];
  if (!required.every((key) => key in record)) return false;
  if (typeof record.id !== "string") return false;
  if (!validateDescription(String(record.description)).valid) return false;
  if (!validateAmount(String(record.amount)).valid) return false;
  if (!validateCategory(String(record.category)).valid) return false;
  if (!validateDate(String(record.date)).valid) return false;
  return true;
}
