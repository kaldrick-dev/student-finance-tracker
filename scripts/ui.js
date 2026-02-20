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
import { compileRegex, highlight, matchesRecord, escapeHtml } from "./search.js";

let editingRowId = null;

function el(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  el(id).textContent = text;
}

function setHtml(id, html) {
  el(id).innerHTML = html;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function clearFormErrors() {
  ["description", "amount", "category", "date"].forEach((field) => setText(`${field}-error`, ""));
}

function showFormError(field, message) {
  setText(`${field}-error`, message);
}

function showStatus(targetId, message, isError = false) {
  const node = el(targetId);
  node.textContent = message;
  node.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function getRecordFormValues() {
  return {
    id: el("record-id").value,
    description: el("description").value,
    amount: el("amount").value,
    category: el("category").value,
    date: el("date").value,
  };
}

function validateRecordInput(input) {
  clearFormErrors();
  const vDescription = validateDescription(input.description);
  const vAmount = validateAmount(input.amount);
  const vCategory = validateCategory(input.category);
  const vDate = validateDate(input.date);

  let valid = true;
  if (!vDescription.valid) {
    showFormError("description", vDescription.message);
    valid = false;
  }
  if (!vAmount.valid) {
    showFormError("amount", vAmount.message);
    valid = false;
  }
  if (!vCategory.valid) {
    showFormError("category", vCategory.message);
    valid = false;
  }
  if (!vDate.valid) {
    showFormError("date", vDate.message);
    valid = false;
  }

  if (!valid) return { valid: false };

  return {
    valid: true,
    value: {
      description: vDescription.value,
      amount: vAmount.value,
      category: vCategory.value,
      date: vDate.value,
    },
  };
}

function fillForm(record = null) {
  if (!record) {
    el("record-id").value = "";
    el("description").value = "";
    el("amount").value = "";
    el("category").value = "";
    el("date").value = todayISO();
    setText("save-record-btn", "Save Transaction");
    return;
  }

  el("record-id").value = record.id;
  el("description").value = record.description;
  el("amount").value = String(record.amount);
  el("category").value = record.category;
  el("date").value = record.date;
  setText("save-record-btn", "Update Transaction");
}

function getFilteredSortedRecords() {
  const state = getState();
  const flags = state.caseInsensitive ? "i" : "";
  const regex = compileRegex(state.searchPattern, flags);

  if (state.searchPattern && !regex) {
    showStatus("search-error", "Invalid regex pattern.", true);
  } else {
    showStatus("search-error", "", false);
  }

  const filtered = state.records.filter((record) => matchesRecord(record, regex));
  return {
    records: sortRecords(filtered, state.sortBy),
    regex,
  };
}

function renderCategories() {
  const { categories } = getState().settings;
  setHtml("category-list", categories.map((cat) => `<option value="${escapeHtml(cat)}"></option>`).join(""));
}

function renderStats() {
  const state = getState();
  const total = state.records.length;
  const sum = state.records.reduce((acc, item) => acc + item.amount, 0);

  const categoryTotals = state.records.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});

  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  setText("stat-total-records", String(total));
  setText("stat-total-amount", formatCurrency(sum, state.settings));
  setText("stat-top-category", topCategory);

  const cap = Number(state.settings.cap) || 0;
  const capLive = el("cap-live");
  if (cap > 0) {
    const remaining = cap - sum;
    if (remaining >= 0) {
      setText("stat-cap-status", `${formatCurrency(remaining, state.settings)} remaining`);
      capLive.setAttribute("aria-live", "polite");
      capLive.textContent = `You are under cap by ${formatCurrency(remaining, state.settings)}.`;
    } else {
      const over = Math.abs(remaining);
      setText("stat-cap-status", `${formatCurrency(over, state.settings)} over cap`);
      capLive.setAttribute("aria-live", "assertive");
      capLive.textContent = `Warning. Cap exceeded by ${formatCurrency(over, state.settings)}.`;
    }
  } else {
    setText("stat-cap-status", "No cap set");
    capLive.setAttribute("aria-live", "polite");
    capLive.textContent = "No cap configured.";
  }

  renderTrendChart();
}

function renderTrendChart() {
  const state = getState();
  const today = new Date();
  const dates = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const totals = dates.map((date) =>
    state.records.filter((r) => r.date === date).reduce((acc, r) => acc + convertAmount(r.amount, state.settings), 0)
  );

  const max = Math.max(1, ...totals);
  const bars = totals
    .map((value, idx) => {
      const pct = Math.round((value / max) * 100);
      const day = new Date(dates[idx]).toLocaleDateString(undefined, { weekday: "short" });
      return `<div class="bar" data-day="${day}" style="height:${Math.max(8, pct)}%" title="${day}: ${value.toFixed(2)}"></div>`;
    })
    .join("");

  setHtml("trend-chart", bars);
}

function renderTableAndCards() {
  const state = getState();
  const { records, regex } = getFilteredSortedRecords();

  const rowHtml = records
    .map((record) => {
      if (editingRowId === record.id) {
        return `
          <tr data-id="${record.id}">
            <td><input type="date" class="inline-date" value="${escapeHtml(record.date)}" /></td>
            <td><input type="text" class="inline-description" value="${escapeHtml(record.description)}" /></td>
            <td><input type="text" class="inline-category" value="${escapeHtml(record.category)}" /></td>
            <td><input type="text" class="inline-amount" value="${escapeHtml(record.amount)}" /></td>
            <td>${new Date(record.updatedAt).toLocaleString()}</td>
            <td class="actions">
              <button class="small" data-action="save-inline" data-id="${record.id}">Save</button>
              <button class="small secondary" data-action="cancel-inline" data-id="${record.id}">Cancel</button>
            </td>
          </tr>
        `;
      }

      return `
        <tr data-id="${record.id}">
          <td>${record.date}</td>
          <td>${highlight(record.description, regex)}</td>
          <td>${highlight(record.category, regex)}</td>
          <td>${formatCurrency(record.amount, state.settings)}</td>
          <td>${new Date(record.updatedAt).toLocaleString()}</td>
          <td class="actions">
            <button class="small" data-action="edit-inline" data-id="${record.id}">Inline Edit</button>
            <button class="small secondary" data-action="edit-form" data-id="${record.id}">Edit Form</button>
            <button class="small danger" data-action="delete" data-id="${record.id}">Delete</button>
          </td>
        </tr>
      `;
    })
    .join("");

  const cardHtml = records
    .map(
      (record) => `
      <article class="card" aria-label="Transaction ${escapeHtml(record.description)}">
        <h3>${highlight(record.description, regex)}</h3>
        <p><strong>Date:</strong> ${record.date}</p>
        <p><strong>Category:</strong> ${highlight(record.category, regex)}</p>
        <p><strong>Amount:</strong> ${formatCurrency(record.amount, state.settings)}</p>
        <p><strong>Updated:</strong> ${new Date(record.updatedAt).toLocaleString()}</p>
        <div class="actions">
          <button class="small secondary" data-action="edit-form" data-id="${record.id}">Edit</button>
          <button class="small danger" data-action="delete" data-id="${record.id}">Delete</button>
        </div>
      </article>
    `
    )
    .join("");

  setHtml("records-table-body", rowHtml || '<tr><td colspan="6">No records found.</td></tr>');
  setHtml("records-cards", cardHtml || "<p>No records found.</p>");
}

function handleRecordSubmit(event) {
  event.preventDefault();
  const input = getRecordFormValues();
  const checked = validateRecordInput(input);

  if (!checked.valid) {
    showStatus("form-status", "Fix validation errors before saving.", true);
    return;
  }

  const payload = checked.value;
  const now = new Date().toISOString();

  if (input.id) {
    updateRecord(input.id, payload);
    showStatus("form-status", "Transaction updated.");
  } else {
    addRecord({
      id: createId(),
      ...payload,
      createdAt: now,
      updatedAt: now,
    });
    showStatus("form-status", "Transaction added.");
  }

  fillForm();
  renderAll();
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  const amountCheck = validateAmount(el("cap-amount").value || "0");
  if (!amountCheck.valid) {
    showStatus("settings-status", "Cap must be a valid number.", true);
    return;
  }

  const usdRateCheck = validateAmount(el("rate-usd").value || "1");
  const eurRateCheck = validateAmount(el("rate-eur").value || "1");
  const gbpRateCheck = validateAmount(el("rate-gbp").value || "1");
  if (!usdRateCheck.valid || !eurRateCheck.valid || !gbpRateCheck.valid) {
    showStatus("settings-status", "All currency rates must be valid numbers.", true);
    return;
  }

  const rates = {
    USD: usdRateCheck.value,
    EUR: eurRateCheck.value,
    GBP: gbpRateCheck.value,
  };

  const categories = el("categories-input")
    .value.split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .filter((c) => validateCategory(c).valid);

  updateSettings({
    baseCurrency: el("base-currency").value,
    displayCurrency: el("display-currency").value,
    rates,
    cap: amountCheck.value,
    categories: categories.length ? categories : getState().settings.categories,
  });

  showStatus("settings-status", "Settings saved.");
  renderAll();
}

function populateSettingsForm() {
  const { settings } = getState();
  el("base-currency").value = settings.baseCurrency;
  el("display-currency").value = settings.displayCurrency;
  el("rate-usd").value = String(settings.rates.USD ?? 1);
  el("rate-eur").value = String(settings.rates.EUR ?? 1);
  el("rate-gbp").value = String(settings.rates.GBP ?? 1);
  el("cap-amount").value = String(settings.cap ?? 0);
  el("categories-input").value = settings.categories.join(", ");
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function handleExport() {
  const data = JSON.stringify(getState().records, null, 2);
  download("finance-records.json", data);
  showStatus("settings-status", "Exported records JSON.");
}

function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array.");
      if (!parsed.every(validateRecordShape)) throw new Error("One or more records are invalid.");

      replaceRecords(parsed);
      showStatus("settings-status", `Imported ${parsed.length} records.`);
      renderAll();
    } catch (error) {
      showStatus("settings-status", `Import failed: ${error.message}`, true);
    }
  };

  reader.readAsText(file);
  event.target.value = "";
}

function handleTableActions(event) {
  const action = event.target?.dataset?.action;
  const id = event.target?.dataset?.id;
  if (!action || !id) return;

  const state = getState();
  const record = state.records.find((item) => item.id === id);
  if (!record) return;

  if (action === "delete") {
    const ok = window.confirm(`Delete transaction "${record.description}"?`);
    if (!ok) return;
    deleteRecord(id);
    showStatus("form-status", "Transaction deleted.");
    renderAll();
    return;
  }

  if (action === "edit-form") {
    fillForm(record);
    el("description").focus();
    return;
  }

  if (action === "edit-inline") {
    editingRowId = id;
    renderTableAndCards();
    return;
  }

  if (action === "cancel-inline") {
    editingRowId = null;
    renderTableAndCards();
    return;
  }

  if (action === "save-inline") {
    const row = event.target.closest("tr");
    if (!row) return;

    const description = row.querySelector(".inline-description")?.value || "";
    const amount = row.querySelector(".inline-amount")?.value || "";
    const category = row.querySelector(".inline-category")?.value || "";
    const date = row.querySelector(".inline-date")?.value || "";

    const checked = validateRecordInput({ description, amount, category, date });
    if (!checked.valid) {
      showStatus("form-status", "Inline edit has validation errors.", true);
      return;
    }

    updateRecord(id, checked.value);
    editingRowId = null;
    showStatus("form-status", "Transaction updated with inline edit.");
    renderAll();
  }
}

function bindEvents() {
  el("record-form").addEventListener("submit", handleRecordSubmit);
  el("reset-form-btn").addEventListener("click", () => fillForm());

  el("settings-form").addEventListener("submit", handleSettingsSubmit);
  el("export-json-btn").addEventListener("click", handleExport);
  el("import-json-input").addEventListener("change", handleImport);

  el("search-pattern").addEventListener("input", (event) => {
    setSearchPattern(event.target.value);
    renderTableAndCards();
  });

  el("search-case-insensitive").addEventListener("change", (event) => {
    setCaseInsensitive(Boolean(event.target.checked));
    renderTableAndCards();
  });

  el("sort-by").addEventListener("change", (event) => {
    setSortBy(event.target.value);
    renderTableAndCards();
  });

  el("records-table-body").addEventListener("click", handleTableActions);
  el("records-cards").addEventListener("click", handleTableActions);
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
