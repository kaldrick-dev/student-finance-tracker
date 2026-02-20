import {
  getState,
  createId,
  addRecord,
  updateRecord,
  deleteRecord,
  replaceRecords,
  updateSettings,
  setSearchPattern,
  setCaseInsensitive,
  setSortBy,
  sortRecords,
  formatCurrency,
  convertAmount,
} from "./state.js";
import {
  validateDescription,
  validateAmount,
  validateCategory,
  validateDate,
  validateRecordShape,
} from "./validators.js";
import {
  compileRegex,
  highlight,
  matchesRecord,
  escapeHtml,
} from "./search.js";

const $ = (id) => document.getElementById(id);

function setText(id, text) {
  $(id).textContent = text;
}

function setHtml(id, html) {
  $(id).innerHTML = html;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function clearFormErrors() {
  for (const field of ["description", "amount", "category", "date"]) {
    setText(`${field}-error`, "");
  }
}

function showStatus(targetId, message, isError = false) {
  const node = $(targetId);
  node.textContent = message;
  node.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function readForm() {
  return {
    id: $("record-id").value,
    description: $("description").value,
    amount: $("amount").value,
    category: $("category").value,
    date: $("date").value,
  };
}

// Validates each field and shows per-field errors. Returns the cleaned
// values on success, or null if anything failed.
function validateForm(input) {
  clearFormErrors();

  const validators = {
    description: validateDescription,
    amount: validateAmount,
    category: validateCategory,
    date: validateDate,
  };

  let allGood = true;
  const cleaned = {};

  for (const [field, validate] of Object.entries(validators)) {
    const result = validate(input[field]);
    if (result.valid) {
      cleaned[field] = result.value;
    } else {
      setText(`${field}-error`, result.message);
      allGood = false;
    }
  }

  return allGood ? cleaned : null;
}

function fillForm(record) {
  if (!record) {
    $("record-id").value = "";
    $("description").value = "";
    $("amount").value = "";
    $("category").value = "";
    $("date").value = todayISO();
    setText("save-record-btn", "Save Transaction");
    return;
  }

  $("record-id").value = record.id;
  $("description").value = record.description;
  $("amount").value = String(record.amount);
  $("category").value = record.category;
  $("date").value = record.date;
  setText("save-record-btn", "Update Transaction");
}

function getFilteredSortedRecords() {
  const state = getState();
  const flags = state.caseInsensitive ? "i" : "";
  const regex = compileRegex(state.searchPattern, flags);

  if (state.searchPattern && !regex) {
    showStatus("search-error", "Invalid regex pattern.", true);
  } else {
    showStatus("search-error", "");
  }

  const filtered = state.records.filter((r) => matchesRecord(r, regex));
  return { records: sortRecords(filtered, state.sortBy), regex };
}

function renderCategories() {
  const { categories } = getState().settings;
  setHtml(
    "category-list",
    categories
      .map((c) => `<option value="${escapeHtml(c)}"></option>`)
      .join(""),
  );
}

function renderStats() {
  const { records, settings } = getState();
  const total = records.length;
  const sum = records.reduce((acc, r) => acc + r.amount, 0);

  // Figure out which category has the most spending
  const byCategory = {};
  for (const r of records) {
    byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;
  }
  const topCategory =
    Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  setText("stat-total-records", String(total));
  setText("stat-total-amount", formatCurrency(sum, settings));
  setText("stat-top-category", topCategory);

  // Cap status
  const cap = Number(settings.cap) || 0;
  const capLive = $("cap-live");

  if (cap > 0) {
    const remaining = cap - sum;
    if (remaining >= 0) {
      setText(
        "stat-cap-status",
        `${formatCurrency(remaining, settings)} remaining`,
      );
      capLive.setAttribute("aria-live", "polite");
      capLive.textContent = `You are under cap by ${formatCurrency(remaining, settings)}.`;
    } else {
      const over = Math.abs(remaining);
      setText("stat-cap-status", `${formatCurrency(over, settings)} over cap`);
      capLive.setAttribute("aria-live", "assertive");
      capLive.textContent = `Warning. Cap exceeded by ${formatCurrency(over, settings)}.`;
    }
  } else {
    setText("stat-cap-status", "No cap set");
    capLive.setAttribute("aria-live", "polite");
    capLive.textContent = "No cap configured.";
  }

  renderTrendChart();
}

function renderTrendChart() {
  const { records, settings } = getState();
  const today = new Date();

  // Build the last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const totals = days.map((date) =>
    records
      .filter((r) => r.date === date)
      .reduce((acc, r) => acc + convertAmount(r.amount, settings), 0),
  );

  const peak = Math.max(1, ...totals);
  const bars = totals
    .map((val, i) => {
      const pct = Math.round((val / peak) * 100);
      const label = new Date(days[i]).toLocaleDateString(undefined, {
        weekday: "short",
      });
      return `<div class="bar" data-day="${label}" style="height:${Math.max(8, pct)}%" title="${label}: ${val.toFixed(2)}"></div>`;
    })
    .join("");

  setHtml("trend-chart", bars);
}

function renderTableAndCards() {
  const { settings } = getState();
  const { records, regex } = getFilteredSortedRecords();

  const rows = records
    .map(
      (r) => `
        <tr data-id="${r.id}">
          <td>${r.date}</td>
          <td>${highlight(r.description, regex)}</td>
          <td>${highlight(r.category, regex)}</td>
          <td>${formatCurrency(r.amount, settings)}</td>
          <td>${new Date(r.updatedAt).toLocaleString()}</td>
          <td class="actions">
            <button class="small secondary" data-action="edit-form" data-id="${r.id}">Edit</button>
            <button class="small danger" data-action="delete" data-id="${r.id}">Delete</button>
          </td>
        </tr>`,
    )
    .join("");

  const cards = records
    .map(
      (r) => `
      <article class="card" aria-label="Transaction ${escapeHtml(r.description)}">
        <h3>${highlight(r.description, regex)}</h3>
        <p><strong>Date:</strong> ${r.date}</p>
        <p><strong>Category:</strong> ${highlight(r.category, regex)}</p>
        <p><strong>Amount:</strong> ${formatCurrency(r.amount, settings)}</p>
        <p><strong>Updated:</strong> ${new Date(r.updatedAt).toLocaleString()}</p>
        <div class="actions">
          <button class="small secondary" data-action="edit-form" data-id="${r.id}">Edit</button>
          <button class="small danger" data-action="delete" data-id="${r.id}">Delete</button>
        </div>
      </article>`,
    )
    .join("");

  setHtml(
    "records-table-body",
    rows || '<tr><td colspan="6">No records found.</td></tr>',
  );
  setHtml("records-cards", cards || "<p>No records found.</p>");
}

// --- Event handlers ---

function handleRecordSubmit(e) {
  e.preventDefault();
  const input = readForm();
  const cleaned = validateForm(input);

  if (!cleaned) {
    showStatus("form-status", "Fix validation errors before saving.", true);
    return;
  }

  const now = new Date().toISOString();

  if (input.id) {
    updateRecord(input.id, cleaned);
    showStatus("form-status", "Transaction updated.");
  } else {
    addRecord({ id: createId(), ...cleaned, createdAt: now, updatedAt: now });
    showStatus("form-status", "Transaction added.");
  }

  fillForm();
  renderAll();
}

function handleSettingsSubmit(e) {
  e.preventDefault();

  const capCheck = validateAmount($("cap-amount").value || "0");
  if (!capCheck.valid) {
    showStatus("settings-status", "Cap must be a valid number.", true);
    return;
  }

  const usd = validateAmount($("rate-usd").value || "1");
  const eur = validateAmount($("rate-eur").value || "1");
  const gbp = validateAmount($("rate-gbp").value || "1");
  if (!usd.valid || !eur.valid || !gbp.valid) {
    showStatus(
      "settings-status",
      "All currency rates must be valid numbers.",
      true,
    );
    return;
  }

  const categories = $("categories-input")
    .value.split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .filter((c) => validateCategory(c).valid);

  updateSettings({
    baseCurrency: $("base-currency").value,
    displayCurrency: $("display-currency").value,
    rates: { USD: usd.value, EUR: eur.value, GBP: gbp.value },
    cap: capCheck.value,
    categories: categories.length ? categories : getState().settings.categories,
  });

  showStatus("settings-status", "Settings saved.");
  renderAll();
}

function populateSettingsForm() {
  const { settings } = getState();
  $("base-currency").value = settings.baseCurrency;
  $("display-currency").value = settings.displayCurrency;
  $("rate-usd").value = String(settings.rates.USD ?? 1);
  $("rate-eur").value = String(settings.rates.EUR ?? 1);
  $("rate-gbp").value = String(settings.rates.GBP ?? 1);
  $("cap-amount").value = String(settings.cap ?? 0);
  $("categories-input").value = settings.categories.join(", ");
}

function downloadJSON(filename, data) {
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function handleExport() {
  const data = JSON.stringify(getState().records, null, 2);
  downloadJSON("finance-records.json", data);
  showStatus("settings-status", "Exported records JSON.");
}

function handleImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array.");
      if (!parsed.every(validateRecordShape))
        throw new Error("One or more records are invalid.");

      replaceRecords(parsed);
      showStatus("settings-status", `Imported ${parsed.length} records.`);
      renderAll();
    } catch (err) {
      showStatus("settings-status", `Import failed: ${err.message}`, true);
    }
  };

  reader.readAsText(file);
  e.target.value = "";
}

function handleTableActions(e) {
  const btn = e.target;
  const action = btn?.dataset?.action;
  const id = btn?.dataset?.id;
  if (!action || !id) return;

  const record = getState().records.find((r) => r.id === id);
  if (!record) return;

  if (action === "delete") {
    if (!confirm(`Delete transaction "${record.description}"?`)) return;
    deleteRecord(id);
    showStatus("form-status", "Transaction deleted.");
    renderAll();
  } else if (action === "edit-form") {
    fillForm(record);
    $("description").focus();
  }
}

function bindEvents() {
  $("record-form").addEventListener("submit", handleRecordSubmit);
  $("reset-form-btn").addEventListener("click", () => fillForm());
  $("settings-form").addEventListener("submit", handleSettingsSubmit);
  $("export-json-btn").addEventListener("click", handleExport);
  $("import-json-input").addEventListener("change", handleImport);

  $("search-pattern").addEventListener("input", (e) => {
    setSearchPattern(e.target.value);
    renderTableAndCards();
  });
  $("search-case-insensitive").addEventListener("change", (e) => {
    setCaseInsensitive(e.target.checked);
    renderTableAndCards();
  });
  $("sort-by").addEventListener("change", (e) => {
    setSortBy(e.target.value);
    renderTableAndCards();
  });

  $("records-table-body").addEventListener("click", handleTableActions);
  $("records-cards").addEventListener("click", handleTableActions);
}

export function renderAll() {
  renderCategories();
  populateSettingsForm();
  renderStats();
  renderTableAndCards();
}

export function initUI() {
  fillForm();
  bindEvents();
  renderAll();
}
