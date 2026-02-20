import { loadRecords, saveRecords, loadSettings, saveSettings } from "./storage.js";
import { validateRecordShape } from "./validators.js";

const defaultCategories = ["Food", "Books", "Transport", "Entertainment", "Fees", "Other"];

const defaultSettings = {
  baseCurrency: "USD",
  displayCurrency: "USD",
  rates: { USD: 1, EUR: 0.92, GBP: 0.79 },
  cap: 0,
  categories: defaultCategories,
};

const state = {
  records: [],
  settings: { ...defaultSettings },
  searchPattern: "",
  caseInsensitive: true,
  sortBy: "date_desc",
};

export function initState() {
  const loadedRecords = loadRecords();
  state.records = Array.isArray(loadedRecords) ? loadedRecords.filter(validateRecordShape) : [];

  const loadedSettings = loadSettings();
  state.settings = loadedSettings ? { ...defaultSettings, ...loadedSettings } : { ...defaultSettings };

  saveRecords(state.records);
  saveSettings(state.settings);
}

export function getState() {
  return state;
}

export function persistState() {
  saveRecords(state.records);
  saveSettings(state.settings);
}

export function createId() {
  const max = state.records.reduce((acc, rec) => {
    const num = Number.parseInt(rec.id.replace(/\D+/g, ""), 10);
    return Number.isNaN(num) ? acc : Math.max(acc, num);
  }, 0);
  return `txn_${String(max + 1).padStart(4, "0")}`;
}

export function addRecord(record) {
  state.records.push(record);
  persistState();
}

export function updateRecord(id, partial) {
  const idx = state.records.findIndex((item) => item.id === id);
  if (idx === -1) return false;
  state.records[idx] = { ...state.records[idx], ...partial, updatedAt: new Date().toISOString() };
  persistState();
  return true;
}

export function deleteRecord(id) {
  const before = state.records.length;
  state.records = state.records.filter((r) => r.id !== id);
  if (state.records.length !== before) persistState();
}

export function replaceRecords(records) {
  state.records = records;
  persistState();
}

export function updateSettings(nextSettings) {
  state.settings = {
    ...state.settings,
    ...nextSettings,
    rates: { ...state.settings.rates, ...(nextSettings.rates || {}) },
  };
  persistState();
}

export function setSearchPattern(pattern) {
  state.searchPattern = pattern;
}

export function setCaseInsensitive(value) {
  state.caseInsensitive = value;
}

export function setSortBy(value) {
  state.sortBy = value;
}

export function sortRecords(records, sortBy) {
  const sorted = [...records];
  const collator = new Intl.Collator(undefined, { sensitivity: "base" });

  sorted.sort((a, b) => {
    switch (sortBy) {
      case "date_asc":
        return a.date.localeCompare(b.date);
      case "date_desc":
        return b.date.localeCompare(a.date);
      case "description_asc":
        return collator.compare(a.description, b.description);
      case "description_desc":
        return collator.compare(b.description, a.description);
      case "amount_asc":
        return a.amount - b.amount;
      case "amount_desc":
        return b.amount - a.amount;
      default:
        return 0;
    }
  });

  return sorted;
}

export function convertAmount(amount, settings) {
  const rate = settings.rates[settings.displayCurrency] || 1;
  return amount * rate;
}

export function formatCurrency(amount, settings) {
  const converted = convertAmount(amount, settings);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: settings.displayCurrency,
  }).format(converted);
}
