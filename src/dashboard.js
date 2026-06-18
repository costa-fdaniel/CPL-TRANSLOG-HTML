const state = {
  data: null,
  filteredContracts: [],
  filteredLedger: [],
  selectedId: null,
  selectedLedgerIds: new Set(),
  selectedInstallmentKeys: new Set(),
  manualEntries: [],
  transactionDraftEntries: [],
  batchImportRows: [],
  panelControlsInitialized: false,
  pendingSystemState: null,
  contractOverrides: {},
};

const MANUAL_STORAGE_KEY = "cpl-translog-html-manual-entries";
const LOCAL_STATE_STORAGE_KEY = "cpl-translog-html-local-state";
const SYSTEM_STATE_SCHEMA = "cpl-translog-system-state";
const API_BASE = "/api";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const preciseCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const els = {
  status: document.querySelector("#statusLine"),
  fileInput: document.querySelector("#fileInput"),
  search: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  entityFilter: document.querySelector("#entityFilter"),
  tabs: document.querySelectorAll(".tab-button"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  kpis: document.querySelector("#kpis"),
  panelYearFilter: document.querySelector("#panelYearFilter"),
  panelContractFilter: document.querySelector("#panelContractFilter"),
  panelSummary: document.querySelector("#panelSummary"),
  monthlyChart: document.querySelector("#monthlyChart"),
  debtSplitChart: document.querySelector("#debtSplitChart"),
  topContractsChart: document.querySelector("#topContractsChart"),
  typeChart: document.querySelector("#typeChart"),
  entityChart: document.querySelector("#entityChart"),
  reviewChart: document.querySelector("#reviewChart"),
  interestChart: document.querySelector("#interestChart"),
  pendingChart: document.querySelector("#pendingChart"),
  contractsTable: document.querySelector("#contractsTable tbody"),
  detail: document.querySelector("#contractDetail"),
  contractEditorStatus: document.querySelector("#contractEditorStatus"),
  contractStatusOverride: document.querySelector("#contractStatusOverride"),
  contractTypeOverride: document.querySelector("#contractTypeOverride"),
  contractCommentsOverride: document.querySelector("#contractCommentsOverride"),
  accountCircOverride: document.querySelector("#accountCircOverride"),
  accountJurosCircOverride: document.querySelector("#accountJurosCircOverride"),
  accountNaoCircOverride: document.querySelector("#accountNaoCircOverride"),
  accountJurosNaoCircOverride: document.querySelector("#accountJurosNaoCircOverride"),
  balanceCurrentOverride: document.querySelector("#balanceCurrentOverride"),
  balanceNonCurrentOverride: document.querySelector("#balanceNonCurrentOverride"),
  interestCurrentOverride: document.querySelector("#interestCurrentOverride"),
  interestNonCurrentOverride: document.querySelector("#interestNonCurrentOverride"),
  saveContractOverrideButton: document.querySelector("#saveContractOverrideButton"),
  clearContractOverrideButton: document.querySelector("#clearContractOverrideButton"),
  audit: document.querySelector("#auditList"),
  operationalSummary: document.querySelector("#operationalSummary"),
  validationList: document.querySelector("#validationList"),
  reconciliationTable: document.querySelector("#reconciliationTable tbody"),
  operationTrailTable: document.querySelector("#operationTrailTable tbody"),
  rules: document.querySelector("#rulesTable tbody"),
  ledgerKpis: document.querySelector("#ledgerKpis"),
  ledgerYearFilter: document.querySelector("#ledgerYearFilter"),
  ledgerDateFrom: document.querySelector("#ledgerDateFrom"),
  ledgerDateTo: document.querySelector("#ledgerDateTo"),
  ledgerContractFilter: document.querySelector("#ledgerContractFilter"),
  ledgerRuleFilter: document.querySelector("#ledgerRuleFilter"),
  ledgerReadyFilter: document.querySelector("#ledgerReadyFilter"),
  ledgerFlowFilter: document.querySelector("#ledgerFlowFilter"),
  ledgerSearch: document.querySelector("#ledgerSearchInput"),
  selectLedgerButton: document.querySelector("#selectLedgerButton"),
  clearLedgerButton: document.querySelector("#clearLedgerButton"),
  approveLedgerButton: document.querySelector("#approveLedgerButton"),
  reopenLedgerButton: document.querySelector("#reopenLedgerButton"),
  exportLedgerButton: document.querySelector("#exportLedgerButton"),
  toggleVisibleLedger: document.querySelector("#toggleVisibleLedger"),
  ledgerMonthChart: document.querySelector("#ledgerMonthChart"),
  ledgerRuleChart: document.querySelector("#ledgerRuleChart"),
  ledgerTable: document.querySelector("#ledgerTable tbody"),
  ledgerCount: document.querySelector("#ledgerCount"),
  transactionContractSelect: document.querySelector("#transactionContractSelect"),
  transactionActionSelect: document.querySelector("#transactionActionSelect"),
  transactionDateInput: document.querySelector("#transactionDateInput"),
  transactionAmountInput: document.querySelector("#transactionAmountInput"),
  transactionInstallmentsInput: document.querySelector("#transactionInstallmentsInput"),
  transactionSettledSelect: document.querySelector("#transactionSettledSelect"),
  transactionScopeSelect: document.querySelector("#transactionScopeSelect"),
  transactionDirectionSelect: document.querySelector("#transactionDirectionSelect"),
  transactionDebitInput: document.querySelector("#transactionDebitInput"),
  transactionCreditInput: document.querySelector("#transactionCreditInput"),
  transactionNoteInput: document.querySelector("#transactionNoteInput"),
  simulateTransactionButton: document.querySelector("#simulateTransactionButton"),
  addTransactionButton: document.querySelector("#addTransactionButton"),
  transactionExplanation: document.querySelector("#transactionExplanation"),
  transactionContractSnapshot: document.querySelector("#transactionContractSnapshot"),
  paymentInstallmentSummary: document.querySelector("#paymentInstallmentSummary"),
  paymentInstallmentsTable: document.querySelector("#paymentInstallmentsTable tbody"),
  selectNextInstallmentButton: document.querySelector("#selectNextInstallmentButton"),
  selectAllPendingInstallmentsButton: document.querySelector("#selectAllPendingInstallmentsButton"),
  clearInstallmentSelectionButton: document.querySelector("#clearInstallmentSelectionButton"),
  transactionSimulationTable: document.querySelector("#transactionSimulationTable tbody"),
  transactionSimulationCount: document.querySelector("#transactionSimulationCount"),
  manualTransactionsTable: document.querySelector("#manualTransactionsTable tbody"),
  exportManualLayerButton: document.querySelector("#exportManualLayerButton"),
  systemStateInput: document.querySelector("#systemStateInput"),
  clearManualLayerButton: document.querySelector("#clearManualLayerButton"),
  downloadBatchTemplateButton: document.querySelector("#downloadBatchTemplateButton"),
  batchCsvInput: document.querySelector("#batchCsvInput"),
  addBatchEntriesButton: document.querySelector("#addBatchEntriesButton"),
  clearBatchImportButton: document.querySelector("#clearBatchImportButton"),
  batchImportSummary: document.querySelector("#batchImportSummary"),
  batchImportTable: document.querySelector("#batchImportTable tbody"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtMoney(value, precise = false) {
  return (precise ? preciseCurrency : currency).format(value || 0);
}

function fmtDateBr(date) {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function normalizeDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function findBalancedJson(text) {
  const source = String(text || "").trim().replace(/^\uFEFF/, "");
  const start = [...source]
    .map((char, index) => (char === "{" || char === "[" ? index : -1))
    .find((index) => index >= 0);
  if (start === undefined) return "";

  const open = source[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        quoted = false;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

function parseJsonLike(text) {
  const source = String(text || "").trim().replace(/^\uFEFF/, "");
  try {
    return JSON.parse(source);
  } catch {
    const jsonSlice = findBalancedJson(source);
    if (!jsonSlice) throw new Error("Nenhum objeto JSON encontrado no arquivo.");
    return JSON.parse(jsonSlice);
  }
}

function isSystemStatePayload(payload) {
  return payload?.schema === SYSTEM_STATE_SCHEMA || Array.isArray(payload?.entries);
}

function isDashboardPayload(payload) {
  return Array.isArray(payload?.contracts) && payload?.metadata && payload?.totals;
}

function looksLikeApplicationScript(text, fileName) {
  const name = String(fileName || "").toLowerCase();
  const source = String(text || "");
  return name.endsWith("dashboard.js")
    || (source.includes("const state =") && source.includes("document.querySelector") && source.includes("function render"));
}

function importErrorMessage(fileName, payload) {
  const name = String(fileName || "").toLowerCase();
  if (name.endsWith("dashboard.js") || (payload && "filteredContracts" in payload && "manualEntries" in payload)) {
    return "Esse arquivo parece ser o codigo do sistema (src/dashboard.js), nao uma base de dados. Importe data/processed/dashboard.json ou o arquivo gerado em Exportar estado JSON.";
  }
  return "Arquivo nao reconhecido. Importe data/processed/dashboard.json ou um JSON gerado por Exportar estado JSON.";
}

function fmtValueBr(value) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function removeAccents(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(value) {
  return removeAccents(value).trim().toLowerCase();
}

function normalizeTypeKey(value) {
  return normalizeKey(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseAmount(value) {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return 0;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized = raw;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function addMonths(dateString, months) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1 + months, day);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayIso() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function accountIsReady(account) {
  const text = String(account ?? "").trim();
  if (!text || ["AAA", "Quitado"].includes(text)) return false;
  return /^\d+$/.test(text);
}

function resultAccountFor(contract) {
  return String(contract?.type ?? "").toLowerCase().includes("leasing") ? "4773" : "375";
}

function contractOverrideFor(contractOrId) {
  const id = typeof contractOrId === "object" ? contractOrId?.id : contractOrId;
  return state.contractOverrides[String(id)] || null;
}

function numberOrOriginal(value, original) {
  const number = Number(value);
  return Number.isFinite(number) ? number : original;
}

function applyContractOverride(contract) {
  const override = contractOverrideFor(contract);
  if (!override) return contract;
  const accounts = {
    ...contract.accounts,
    ...(override.accounts || {}),
  };
  const balances = {
    ...contract.balances,
    ...(override.balances || {}),
  };
  balances.currentFinal = numberOrOriginal(balances.currentFinal, contract.balances.currentFinal);
  balances.nonCurrentFinal = numberOrOriginal(balances.nonCurrentFinal, contract.balances.nonCurrentFinal);
  balances.interestCurrent = numberOrOriginal(balances.interestCurrent, contract.balances.interestCurrent);
  balances.interestNonCurrent = numberOrOriginal(balances.interestNonCurrent, contract.balances.interestNonCurrent);
  balances.finalDebt = balances.currentFinal + balances.nonCurrentFinal;
  balances.interestTotal = balances.interestCurrent + balances.interestNonCurrent;
  return {
    ...contract,
    ...override.fields,
    accounts,
    balances,
    override,
    flags: [
      ...(contract.flags || []),
      ...(override.updatedAt ? ["cadastro_html"] : []),
    ],
  };
}

function byFinalDebt(a, b) {
  return b.balances.finalDebt - a.balances.finalDebt;
}

function sum(items, getter) {
  return items.reduce((total, item) => total + getter(item), 0);
}

function groupSum(items, keyGetter, valueGetter) {
  return items.reduce((acc, item) => {
    const key = keyGetter(item) || "-";
    acc[key] = (acc[key] || 0) + valueGetter(item);
    return acc;
  }, {});
}

function entriesFromGroup(group) {
  return Object.entries(group)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function allLedgerEntries() {
  return [...(state.data?.ledgerEntries || []), ...state.manualEntries];
}

function monthLabel(monthKey) {
  const [year, month] = String(monthKey || "").split("-");
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const index = Number(month) - 1;
  if (!year || index < 0 || index > 11) return monthKey || "-";
  return `${labels[index]}/${year.slice(-2)}`;
}

function panelFilterValues() {
  return {
    year: els.panelYearFilter?.value || "all",
    contractId: els.panelContractFilter?.value || "all",
  };
}

function panelLedgerEntries() {
  const { year, contractId } = panelFilterValues();
  const status = els.statusFilter.value;
  const entity = els.entityFilter.value;
  return allLedgerEntries()
    .filter((entry) => status === "all" || entry.status === status)
    .filter((entry) => entity === "all" || entry.entity === entity)
    .filter((entry) => year === "all" || String(entry.year) === year)
    .filter((entry) => contractId === "all" || String(entry.contractId) === contractId);
}

function panelContracts() {
  const { year, contractId } = panelFilterValues();
  const visibleIds = new Set(panelLedgerEntries().map((entry) => entry.contractId));
  return state.filteredContracts
    .filter((contract) => contractId === "all" || String(contract.id) === contractId)
    .filter((contract) => year === "all" || contractId !== "all" || visibleIds.has(contract.id));
}

function manualImpactFor(contract) {
  const impact = {
    currentPrincipal: 0,
    nonCurrentPrincipal: 0,
    currentInterest: 0,
    nonCurrentInterest: 0,
  };
  state.manualEntries
    .filter((entry) => entry.contractId === contract.id)
    .forEach((entry) => {
      const amount = Number(entry.amount || 0);
      const debit = String(entry.debit || "");
      const credit = String(entry.credit || "");
      const rule = String(entry.rule || "");

      if (entry.installmentComponent === "principal") {
        impact.currentPrincipal += entry.installmentAdjustment === "reversal" ? amount : -amount;
      } else if (entry.installmentComponent === "juros") {
        impact.currentInterest += entry.installmentAdjustment === "reversal" ? amount : -amount;
      } else if ((rule.includes("PGTO") || rule.includes("QUITACAO")) && credit === "000") {
        if (debit === contract.accounts.naoCirc) impact.nonCurrentPrincipal -= amount;
        if (debit === contract.accounts.circ) impact.currentPrincipal -= amount;
      } else if (rule.includes("PASSIVO")) {
        if (credit === contract.accounts.circ) impact.currentPrincipal += amount;
        if (debit === contract.accounts.circ) impact.currentPrincipal -= amount;
        if (credit === contract.accounts.naoCirc) impact.nonCurrentPrincipal += amount;
        if (debit === contract.accounts.naoCirc) impact.nonCurrentPrincipal -= amount;
      } else if (rule.includes("JUROS")) {
        if (credit === contract.accounts.jurosCirc) impact.currentInterest += amount;
        if (debit === contract.accounts.jurosCirc) impact.currentInterest -= amount;
        if (credit === contract.accounts.jurosNaoCirc) impact.nonCurrentInterest += amount;
        if (debit === contract.accounts.jurosNaoCirc) impact.nonCurrentInterest -= amount;
      }
    });
  return impact;
}

function adjustedContract(contract) {
  if (!contract) return null;
  const baseContract = applyContractOverride(contract);
  const impact = manualImpactFor(baseContract);
  const currentFinal = Math.max(0, (baseContract.balances.currentFinal || 0) + impact.currentPrincipal);
  const nonCurrentFinal = Math.max(0, (baseContract.balances.nonCurrentFinal || 0) + impact.nonCurrentPrincipal);
  const interestCurrent = Math.max(0, (baseContract.balances.interestCurrent || 0) + impact.currentInterest);
  const interestNonCurrent = Math.max(0, (baseContract.balances.interestNonCurrent || 0) + impact.nonCurrentInterest);
  return {
    ...baseContract,
    status: baseContract.status === "quitado" || (currentFinal + nonCurrentFinal <= 0.005 && contractInstallments(baseContract).every((item) => item.status !== "pendente"))
      ? "quitado"
      : baseContract.status,
    balances: {
      ...baseContract.balances,
      currentFinal,
      nonCurrentFinal,
      finalDebt: currentFinal + nonCurrentFinal,
      interestCurrent,
      interestNonCurrent,
      interestTotal: interestCurrent + interestNonCurrent,
    },
    systemImpact: impact,
  };
}

function adjustedContracts() {
  return (state.data?.contracts || []).map((contract) => adjustedContract(contract));
}

function localStatePayload() {
  return {
    entries: state.manualEntries,
    contractOverrides: state.contractOverrides,
  };
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }
  return response.json();
}

function persistStateToServer() {
  if (!window.location.protocol.startsWith("http")) return;
  if (!state.data?.contracts?.length) return;
  const payload = buildSystemStatePayload();
  apiJson("/state", {
    method: "PUT",
    body: JSON.stringify(payload),
  }).catch(() => {
    // Fallback local continua sendo a fonte de seguranca quando o servidor nao esta ativo.
  });
}

async function hydrateStateFromServer() {
  if (!window.location.protocol.startsWith("http")) return false;
  try {
    const response = await apiJson("/state");
    if (!response?.found || !response.payload) return false;
    importSystemState(response.payload, { sync: false, source: "server" });
    els.status.textContent += ` | estado SQLite aplicado (${response.updatedAt})`;
    return true;
  } catch {
    return false;
  }
}

function saveManualEntries(options = {}) {
  localStorage.setItem(LOCAL_STATE_STORAGE_KEY, JSON.stringify(localStatePayload()));
  localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(state.manualEntries));
  if (options.sync !== false) {
    persistStateToServer();
  }
}

function loadManualEntries() {
  try {
    const storedState = JSON.parse(localStorage.getItem(LOCAL_STATE_STORAGE_KEY) || "null");
    if (storedState && typeof storedState === "object") {
      state.manualEntries = Array.isArray(storedState.entries) ? storedState.entries : [];
      state.contractOverrides = storedState.contractOverrides && typeof storedState.contractOverrides === "object"
        ? storedState.contractOverrides
        : {};
      return;
    }
    const storedEntries = JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEY) || "[]");
    state.manualEntries = Array.isArray(storedEntries) ? storedEntries : [];
    state.contractOverrides = {};
  } catch {
    state.manualEntries = [];
    state.contractOverrides = {};
  }
}

function selectedTransactionContract() {
  const id = Number(els.transactionContractSelect.value);
  return adjustedContracts().find((contract) => contract.id === id) || null;
}

function contractByInput(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return adjustedContracts().find((contract) => (
    String(contract.id) === text || String(contract.contractNumber) === text
  )) || null;
}

function syncTransactionContractToSelected() {
  if (!els.transactionContractSelect || !state.selectedId) return;
  const hasOption = [...els.transactionContractSelect.options].some((option) => option.value === String(state.selectedId));
  if (hasOption) {
    els.transactionContractSelect.value = String(state.selectedId);
  }
}

function contractDetailById(contractId) {
  return state.data?.contractDetails.find((detail) => detail.sheetId === contractId && !detail.replacedSheet)
    || state.data?.contractDetails.find((detail) => detail.sheetId === contractId)
    || null;
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatRate(contract, detail) {
  const candidates = [
    detail?.general?.method,
    detail?.general?.rateOrInstallments,
    contract?.type,
  ];
  const rate = candidates
    .map((value) => numericValue(value))
    .find((value) => value !== null && value > 0 && value < 1);
  return rate ? `${(rate * 100).toFixed(2).replace(".", ",")}% a.m.` : "-";
}

function installmentAmountFromMovement(movement) {
  const values = movement?.values || {};
  const principal = Math.abs(Math.min(0, values.amortizacao_principal || 0));
  const interest = Math.abs(Math.min(0, values.amortizacao_juros || 0));
  return {
    principal,
    interest,
    total: principal + interest,
  };
}

function queuedInstallmentKeys() {
  return new Set(state.manualEntries
    .filter((entry) => entry.installmentKey)
    .map((entry) => entry.installmentKey));
}

function contractInstallments(contract) {
  const detail = contractDetailById(contract?.id);
  if (!contract || !detail) return [];
  const today = todayIso();
  const queued = queuedInstallmentKeys();
  return (detail.movements || [])
    .map((movement) => {
      const amounts = installmentAmountFromMovement(movement);
      if (amounts.total <= 0.005) return null;
      const key = `${contract.id}:${movement.parcel}:${movement.date}`;
      let status = "pendente";
      if (contract.status === "quitado" || movement.date < today) {
        status = "paga";
      } else if (queued.has(key)) {
        status = "na esteira";
      } else if (state.selectedInstallmentKeys.has(key)) {
        status = "selecionada";
      }
      return {
        key,
        contractId: contract.id,
        parcel: movement.parcel,
        date: movement.date,
        principal: amounts.principal,
        interest: amounts.interest,
        total: amounts.total,
        status,
        textMarkers: movement.textMarkers || {},
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date) || Number(a.parcel) - Number(b.parcel));
}

function contractInstallmentStats(contract) {
  const detail = contractDetailById(contract?.id);
  const installments = contractInstallments(contract);
  const statedInstallments = numericValue(detail?.general?.rateOrInstallments);
  const maxParcel = Math.max(0, ...installments.map((item) => Number(item.parcel) || 0));
  const total = statedInstallments && statedInstallments > 1
    ? Math.max(statedInstallments, maxParcel)
    : maxParcel || installments.length;
  const paid = installments.filter((item) => item.status === "paga").length;
  const queued = installments.filter((item) => item.status === "na esteira").length;
  const selected = installments.filter((item) => item.status === "selecionada").length;
  const pending = installments.filter((item) => item.status === "pendente" || item.status === "selecionada").length;
  const pendingAfterSelection = Math.max(0, pending - selected);
  return {
    installments,
    total,
    paid,
    queued,
    selected,
    pending,
    pendingAfterSelection,
    selectedAmount: sum(installments.filter((item) => item.status === "selecionada"), (item) => item.total),
    pendingAmount: sum(installments.filter((item) => item.status === "pendente" || item.status === "selecionada"), (item) => item.total),
  };
}

function entryBalanceEffect(entry, contract) {
  const amount = Number(entry.amount || 0);
  const effect = {
    currentPrincipal: 0,
    nonCurrentPrincipal: 0,
    currentInterest: 0,
    nonCurrentInterest: 0,
    result: 0,
    cash: 0,
  };
  if (!contract || !amount) return effect;

  const accountMap = [
    ["currentPrincipal", contract.accounts.circ],
    ["nonCurrentPrincipal", contract.accounts.naoCirc],
    ["currentInterest", contract.accounts.jurosCirc],
    ["nonCurrentInterest", contract.accounts.jurosNaoCirc],
  ];
  accountMap.forEach(([key, account]) => {
    if (entry.credit === account) effect[key] += amount;
    if (entry.debit === account) effect[key] -= amount;
  });

  const resultAccount = resultAccountFor(contract);
  if (entry.debit === resultAccount) effect.result += amount;
  if (entry.credit === resultAccount) effect.result -= amount;
  if (entry.credit === "000") effect.cash -= amount;
  if (entry.debit === "000") effect.cash += amount;
  return effect;
}

function addFinding(findings, severity, contractId, title, detail, entry = null) {
  findings.push({
    severity,
    contractId: contractId || "",
    title,
    detail,
    entryId: entry?.id || "",
    rule: entry?.rule || "",
    amount: entry?.amount || 0,
  });
}

function validateEntryAgainstRule(entry, contract, findings) {
  const rule = String(entry.rule || "");
  const amount = Number(entry.amount || 0);
  if (!contract) {
    addFinding(findings, "critical", entry.contractId, "Contrato ausente", "Lancamento sem contrato correspondente na base carregada.", entry);
    return;
  }
  if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    addFinding(findings, "critical", entry.contractId, "Data invalida", "Lancamento sem data ISO valida para exportacao.", entry);
  }
  if (!Number.isFinite(amount) || amount <= 0.005) {
    addFinding(findings, "critical", entry.contractId, "Valor invalido", "Lancamento sem valor positivo relevante.", entry);
  }
  if (!accountIsReady(entry.debit) || !accountIsReady(entry.credit)) {
    addFinding(findings, "warning", entry.contractId, "Conta pendente", `Debito ${entry.debit || "-"} / credito ${entry.credit || "-"}.`, entry);
  }
  if (entry.debit && entry.credit && entry.debit === entry.credit) {
    addFinding(findings, "critical", entry.contractId, "Debito igual ao credito", "Lancamento sem efeito contabil liquido.", entry);
  }
  if (contract.status === "quitado" && entry.origin === "manual" && !rule.includes("ESTORNO")) {
    addFinding(findings, "warning", entry.contractId, "Contrato quitado com movimento HTML", "Conferir se o contrato deve ser reaberto ou se o movimento e somente estorno.", entry);
  }
  if (entry.reviewStatus !== "pronto") {
    addFinding(findings, "warning", entry.contractId, "Lancamento em revisao", entry.issues?.join(" ") || "Marcado para revisao.", entry);
  }

  const resultAccount = resultAccountFor(contract);
  const isLiabilityTransfer = rule.includes("TRANSF-PASSIVO-NC-C") || rule === "R4T";
  const isInterestTransfer = rule.includes("TRANSF-JUROS-NC-C") || rule === "R12";
  const isInterestReversal = rule.includes("ESTORNO-JUROS-DRE") || rule === "R2E" || rule === "R5E";
  const isInterestComplement = rule.includes("COMP-JUROS-DRE") || rule === "R2" || rule === "R5";
  if (isLiabilityTransfer && (entry.debit !== contract.accounts.naoCirc || entry.credit !== contract.accounts.circ)) {
    addFinding(findings, "critical", entry.contractId, "Transferencia de passivo fora do padrao", "Esperado debito N-CIRC e credito CIRC.", entry);
  }
  if (isInterestTransfer && (entry.debit !== contract.accounts.jurosNaoCirc || entry.credit !== contract.accounts.jurosCirc)) {
    addFinding(findings, "critical", entry.contractId, "Transferencia de juros fora do padrao", "Esperado debito juros N-CIRC e credito juros CIRC.", entry);
  }
  if (isInterestReversal && entry.credit !== resultAccount) {
    addFinding(findings, "critical", entry.contractId, "Estorno DRE sem credito em resultado", "Estorno de juros deve creditar resultado financeiro.", entry);
  }
  if (isInterestComplement && entry.debit !== resultAccount) {
    addFinding(findings, "critical", entry.contractId, "Complemento DRE sem debito em resultado", "Complemento de juros deve debitar resultado financeiro.", entry);
  }
  if ((rule.includes("PGTO") || rule.includes("QUIT")) && entry.credit !== "000" && entry.origin === "manual") {
    addFinding(findings, "warning", entry.contractId, "Pagamento sem credito 000", "Baixas operacionais devem sair contra a conta 000 no modelo atual.", entry);
  }
}

function buildOperationalModel() {
  if (!state.data) {
    return {
      summary: {},
      findings: [],
      accountRows: [],
      trailRows: [],
      contractRows: [],
    };
  }

  const contracts = adjustedContracts();
  const contractMap = new Map(contracts.map((contract) => [contract.id, contract]));
  const entries = allLedgerEntries();
  const manualEntries = state.manualEntries;
  const findings = [];
  const accountMap = {};
  const contractRows = contracts.map((contract) => {
    const stats = contractInstallmentStats(contract);
    const manual = manualEntries.filter((entry) => entry.contractId === contract.id);
    return {
      contract,
      pending: stats.pendingAfterSelection,
      queued: stats.queued,
      manualEntries: manual.length,
      reviewEntries: manual.filter((entry) => entry.reviewStatus !== "pronto").length,
      exportedEntries: manual.filter((entry) => entry.operationStatus === "exportado").length,
      impact: contract.systemImpact || {},
    };
  });

  entries.forEach((entry) => {
    const contract = contractMap.get(entry.contractId);
    validateEntryAgainstRule(entry, contract, findings);
    const amount = Number(entry.amount || 0);
    [entry.debit, entry.credit].forEach((account) => {
      if (!account) return;
      if (!accountMap[account]) accountMap[account] = { account, debit: 0, credit: 0 };
    });
    if (entry.debit) accountMap[entry.debit].debit += amount;
    if (entry.credit) accountMap[entry.credit].credit += amount;
  });

  const paymentKeys = {};
  manualEntries.forEach((entry) => {
    if (!entry.installmentKey || entry.installmentAdjustment === "reversal") return;
    paymentKeys[entry.installmentKey] = paymentKeys[entry.installmentKey] || [];
    paymentKeys[entry.installmentKey].push(entry);
  });
  Object.values(paymentKeys)
    .filter((items) => items.length > 2)
    .forEach((items) => {
      addFinding(
        findings,
        "warning",
        items[0].contractId,
        "Parcela com multiplos movimentos HTML",
        `${items.length} lancamentos vinculados a mesma parcela; conferir se houve duplicidade ou composicao principal/juros.`,
        items[0],
      );
    });

  contractRows.forEach((row) => {
    const finalDebt = row.contract.balances.finalDebt;
    if (finalDebt <= 0.005 && row.pending > 0) {
      addFinding(findings, "warning", row.contract.id, "Saldo zerado com parcelas pendentes", "Contrato sem divida final, mas com parcelas ainda classificadas como pendentes.");
    }
    if (row.reviewEntries > 0) {
      addFinding(findings, "warning", row.contract.id, "Contrato com HTML em revisao", `${row.reviewEntries} lancamento(s) HTML exigem conferencia.`);
    }
  });

  const accountRows = Object.values(accountMap)
    .map((row) => ({
      ...row,
      balance: row.debit - row.credit,
      volume: row.debit + row.credit,
    }))
    .sort((a, b) => b.volume - a.volume);

  const trailRows = [...manualEntries]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 80);

  const severityCounts = findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1;
    return acc;
  }, {});
  const exportedEntries = manualEntries.filter((entry) => entry.operationStatus === "exportado").length;
  const draftEntries = manualEntries.filter((entry) => entry.operationStatus !== "exportado").length;
  return {
    summary: {
      contracts: contracts.length,
      contractOverrides: Object.keys(state.contractOverrides).length,
      entries: entries.length,
      manualEntries: manualEntries.length,
      exportedEntries,
      draftEntries,
      critical: severityCounts.critical || 0,
      warnings: severityCounts.warning || 0,
      readyManual: manualEntries.filter((entry) => entry.reviewStatus === "pronto").length,
      reviewManual: manualEntries.filter((entry) => entry.reviewStatus !== "pronto").length,
      totalDebit: sum(accountRows, (row) => row.debit),
      totalCredit: sum(accountRows, (row) => row.credit),
    },
    findings: findings.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
    }),
    accountRows,
    trailRows,
    contractRows,
  };
}

function selectedPaymentInstallments(contract) {
  return contractInstallments(contract).filter((item) => item.status === "selecionada");
}

function selectedInstallmentsByKey(contract) {
  return contractInstallments(contract).filter((item) => state.selectedInstallmentKeys.has(item.key));
}

function scaledInstallmentAmount(value, installment, selectedTotal) {
  if (!value || selectedTotal <= 0) return value;
  return value * (installment.total / selectedTotal);
}

async function loadDefaultData() {
  try {
    const response = await fetch("data/processed/dashboard.json", { cache: "no-store" });
    if (!response.ok) throw new Error("JSON nao encontrado");
    const data = await response.json();
    setData(data, "data/processed/dashboard.json");
  } catch {
    els.status.textContent = "Nenhum JSON carregado. Gere data/processed/dashboard.json ou selecione um arquivo JSON.";
    renderEmpty();
  }
}

function setData(data, sourceLabel) {
  data.ledgerEntries = data.ledgerEntries || [];
  state.data = data;
  state.selectedId = data.contracts?.[0]?.id ?? null;
  state.selectedLedgerIds.clear();
  state.selectedInstallmentKeys.clear();
  state.transactionDraftEntries = [];
  state.panelControlsInitialized = false;
  loadManualEntries();
  els.status.textContent = `${sourceLabel} | ${data.totals.contracts} contratos | gerado em ${data.metadata.generatedAt}`;
  if (state.pendingSystemState) {
    els.status.textContent += ` | estado aplicado: ${state.manualEntries.length} transacoes HTML`;
    state.pendingSystemState = null;
  }
  populatePanelControls();
  populateLedgerControls();
  populateTransactionControls();
  applyFilters();
  renderRules();
  renderTransactionPanel();
  hydrateStateFromServer().then((loaded) => {
    if (loaded) {
      populatePanelControls();
      populateLedgerControls();
      applyFilters();
      renderRules();
      renderTransactionPanel();
    }
  });
}

function populatePanelControls() {
  const previousYear = els.panelYearFilter.value;
  const previousContract = els.panelContractFilter.value;
  const years = [...new Set(allLedgerEntries().map((entry) => entry.year).filter(Boolean))].sort((a, b) => a - b);
  els.panelYearFilter.innerHTML = `<option value="all">Todos os anos</option>`
    + years.map((year) => `<option value="${year}">${year}</option>`).join("");
  if (!state.panelControlsInitialized && years.length) {
    const currentYear = new Date().getFullYear();
    els.panelYearFilter.value = years.includes(currentYear) ? String(currentYear) : String(years[years.length - 1]);
    state.panelControlsInitialized = true;
  } else if (years.map(String).includes(previousYear) || previousYear === "all") {
    els.panelYearFilter.value = previousYear || "all";
  } else if (years.length) {
    els.panelYearFilter.value = String(years[years.length - 1]);
  }

  const contracts = [...state.data.contracts].sort((a, b) => a.id - b.id);
  els.panelContractFilter.innerHTML = `<option value="all">Todos os contratos</option>`
    + contracts.map((contract) => (
      `<option value="${contract.id}">${contract.id} - ${escapeHtml(contract.contractNumber)} (${escapeHtml(contract.entity)})</option>`
    )).join("");
  if ([...els.panelContractFilter.options].some((option) => option.value === previousContract)) {
    els.panelContractFilter.value = previousContract;
  }
}

function populateLedgerControls() {
  const previousYear = els.ledgerYearFilter.value;
  const previousContract = els.ledgerContractFilter.value;
  const previousRule = els.ledgerRuleFilter.value;
  const years = [...new Set(allLedgerEntries().map((entry) => entry.year))].sort();
  els.ledgerYearFilter.innerHTML = `<option value="all">Todos os anos</option>`
    + years.map((year) => `<option value="${year}">${year}</option>`).join("");
  if (years.map(String).includes(previousYear)) {
    els.ledgerYearFilter.value = previousYear;
  } else if (years.includes(2025)) {
    els.ledgerYearFilter.value = "2025";
  }

  const contracts = [...state.data.contracts].sort((a, b) => a.id - b.id);
  els.ledgerContractFilter.innerHTML = `<option value="all">Todos os contratos</option>`
    + contracts.map((contract) => (
      `<option value="${contract.id}">${contract.id} - ${escapeHtml(contract.contractNumber)}</option>`
    )).join("");
  if ([...els.ledgerContractFilter.options].some((option) => option.value === previousContract)) {
    els.ledgerContractFilter.value = previousContract;
  }

  const rules = [...new Set(allLedgerEntries().map((entry) => entry.rule))].sort();
  els.ledgerRuleFilter.innerHTML = `<option value="all">Todas as regras</option>`
    + rules.map((rule) => `<option value="${rule}">${rule}</option>`).join("");
  if ([...els.ledgerRuleFilter.options].some((option) => option.value === previousRule)) {
    els.ledgerRuleFilter.value = previousRule;
  }
}

function populateTransactionControls() {
  const contracts = [...(state.filteredContracts.length ? state.filteredContracts : adjustedContracts())].sort((a, b) => a.id - b.id);
  els.transactionContractSelect.innerHTML = contracts.map((contract) => (
    `<option value="${contract.id}">${contract.id} - ${escapeHtml(contract.contractNumber)} (${escapeHtml(contract.entity)})</option>`
  )).join("");
  if (state.selectedId && contracts.some((contract) => contract.id === state.selectedId)) {
    els.transactionContractSelect.value = String(state.selectedId);
  } else if (contracts.length) {
    state.selectedId = contracts[0].id;
    els.transactionContractSelect.value = String(state.selectedId);
    state.selectedInstallmentKeys.clear();
  } else {
    state.selectedId = null;
    state.selectedInstallmentKeys.clear();
  }
  if (!els.transactionDateInput.value) {
    els.transactionDateInput.value = new Date().toISOString().slice(0, 10);
  }
}

function applyFilters() {
  if (!state.data) return;
  const term = els.search.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  const entity = els.entityFilter.value;

  state.filteredContracts = adjustedContracts()
    .filter((contract) => status === "all" || contract.status === status)
    .filter((contract) => entity === "all" || contract.entity === entity)
    .filter((contract) => {
      if (!term) return true;
      return [
        contract.id,
        contract.contractNumber,
        contract.entity,
        contract.type,
        contract.comments,
      ].join(" ").toLowerCase().includes(term);
    })
    .sort(byFinalDebt);

  if (!state.filteredContracts.some((contract) => contract.id === state.selectedId)) {
    state.selectedId = state.filteredContracts[0]?.id ?? null;
    state.selectedInstallmentKeys.clear();
  }

  populateTransactionControls();
  syncTransactionContractToSelected();
  state.transactionDraftEntries = simulateTransaction();
  applyLedgerFilters();
  render();
}

function applyLedgerFilters() {
  if (!state.data) return;
  const status = els.statusFilter.value;
  const entity = els.entityFilter.value;
  const year = els.ledgerYearFilter.value;
  const contractId = els.ledgerContractFilter.value;
  const rule = els.ledgerRuleFilter.value;
  const ready = els.ledgerReadyFilter.value;
  const flow = els.ledgerFlowFilter.value;
  const dateFrom = els.ledgerDateFrom.value;
  const dateTo = els.ledgerDateTo.value;
  const term = els.ledgerSearch.value.trim().toLowerCase();

  state.filteredLedger = allLedgerEntries()
    .filter((entry) => status === "all" || entry.status === status)
    .filter((entry) => entity === "all" || entry.entity === entity)
    .filter((entry) => year === "all" || String(entry.year) === year)
    .filter((entry) => contractId === "all" || String(entry.contractId) === contractId)
    .filter((entry) => rule === "all" || entry.rule === rule)
    .filter((entry) => ready === "all" || entry.reviewStatus === ready)
    .filter((entry) => {
      const status = entry.operationStatus || (entry.origin === "manual" ? "rascunho" : "historico");
      if (flow === "all") return true;
      if (flow === "not_exported") return status !== "exportado";
      if (flow === "exported") return status === "exportado";
      if (flow === "approved") return status === "aprovado";
      if (flow === "draft") return ["rascunho", "pronto", "revisar"].includes(status);
      return true;
    })
    .filter((entry) => !dateFrom || entry.date >= dateFrom)
    .filter((entry) => !dateTo || entry.date <= dateTo)
    .filter((entry) => {
      if (!term) return true;
      return [
        entry.contractId,
        entry.contractNumber,
        entry.debit,
        entry.credit,
        entry.rule,
        entry.description,
      ].join(" ").toLowerCase().includes(term);
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.contractId - b.contractId || a.rule.localeCompare(b.rule));
}

function renderEmpty() {
  els.kpis.innerHTML = "";
  els.panelSummary.innerHTML = "";
  els.monthlyChart.innerHTML = `<div class="empty-state">Aguardando dados processados.</div>`;
  els.debtSplitChart.innerHTML = "";
  els.topContractsChart.innerHTML = "";
  els.typeChart.innerHTML = "";
  els.entityChart.innerHTML = "";
  els.reviewChart.innerHTML = "";
  els.interestChart.innerHTML = "";
  els.pendingChart.innerHTML = "";
  els.contractsTable.innerHTML = "";
  els.detail.innerHTML = `<div class="empty-state">Selecione ou carregue uma base.</div>`;
  els.contractEditorStatus.innerHTML = "";
  els.audit.innerHTML = "";
  els.operationalSummary.innerHTML = "";
  els.validationList.innerHTML = "";
  els.reconciliationTable.innerHTML = "";
  els.operationTrailTable.innerHTML = "";
  els.rules.innerHTML = "";
  els.ledgerTable.innerHTML = "";
  els.ledgerKpis.innerHTML = "";
  els.transactionSimulationTable.innerHTML = "";
  els.manualTransactionsTable.innerHTML = "";
  els.paymentInstallmentSummary.innerHTML = "";
  els.paymentInstallmentsTable.innerHTML = "";
  els.batchImportSummary.innerHTML = "";
  els.batchImportTable.innerHTML = "";
  els.transactionExplanation.innerHTML = "";
  els.transactionContractSnapshot.innerHTML = "";
}

function render() {
  renderKpis();
  renderPanelCharts();
  renderContractsTable();
  renderDetail();
  renderContractEditor();
  renderAudit();
  renderLedgerPanel();
  renderTransactionPanel();
}

function renderKpis() {
  const contracts = state.filteredContracts;
  const items = [
    ["Contratos", contracts.length],
    ["Ativos", contracts.filter((contract) => contract.status === "ativo").length],
    ["Quitados", contracts.filter((contract) => contract.status === "quitado").length],
    ["Divida final", fmtMoney(sum(contracts, (contract) => contract.balances.finalDebt))],
    ["Juros no ano", fmtMoney(sum(contracts, (contract) => contract.balances.interestTotal))],
    ["Lancamentos filtrados", state.filteredLedger.length],
    ["Transacoes HTML", state.manualEntries.length],
  ];
  els.kpis.innerHTML = items.map(([label, value]) => `
    <section class="kpi">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${escapeHtml(value)}</div>
    </section>
  `).join("");
}

function renderPanelCharts() {
  renderPanelSummary();
  renderMonthlyChart();
  renderDebtSplit();
  renderTopContractsChart();
  renderTypeChart();
  renderEntityChart();
  renderReviewChart();
  renderInterestChart();
  renderPendingChart();
}

function renderPanelSummary() {
  const contracts = panelContracts();
  const entries = panelLedgerEntries();
  const manualEntries = entries.filter((entry) => entry.origin === "manual");
  const finalDebt = sum(contracts, (contract) => contract.balances.finalDebt);
  const originalDebt = sum(
    state.data.contracts.filter((contract) => contracts.some((item) => item.id === contract.id)),
    (contract) => contract.balances.finalDebt,
  );
  const principalImpact = finalDebt - originalDebt;
  const pendingInstallments = sum(contracts, (contract) => contractInstallmentStats(contract).pendingAfterSelection);
  const reviewCount = entries.filter((entry) => entry.reviewStatus === "revisar").length;
  const ledgerAmount = sum(entries, (entry) => entry.amount);
  els.panelSummary.innerHTML = `
    <div class="summary-hero">
      <span>Saldo atualizado no sistema</span>
      <strong>${fmtMoney(finalDebt, true)}</strong>
      <small>${principalImpact <= 0 ? "Reducao" : "Aumento"} pela camada HTML: ${fmtMoney(Math.abs(principalImpact), true)}</small>
    </div>
    <div class="summary-tile">
      <span>Parcelas pendentes</span>
      <strong>${pendingInstallments}</strong>
    </div>
    <div class="summary-tile">
      <span>Fluxo filtrado</span>
      <strong>${fmtMoney(ledgerAmount)}</strong>
      <small>${entries.length} lancamento(s)</small>
    </div>
    <div class="summary-tile">
      <span>HTML / revisar</span>
      <strong>${manualEntries.length} / ${reviewCount}</strong>
    </div>
  `;
}

function renderMonthlyChart() {
  const entries = panelLedgerEntries();
  const series = entriesFromGroup(groupSum(
    entries,
    (entry) => entry.month,
    (entry) => entry.amount,
  ))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((item) => ({ label: item.label, display: monthLabel(item.label), amount: item.value }));
  if (!series.length) {
    els.monthlyChart.innerHTML = `<div class="empty-state">Sem fluxo para o filtro atual.</div>`;
    return;
  }
  const max = Math.max(...series.map((item) => item.amount), 1);
  els.monthlyChart.innerHTML = series.map((item) => {
    const height = Math.max(3, (item.amount / max) * 100);
    return `
      <div class="bar-wrap" title="${escapeHtml(item.label)}: ${fmtMoney(item.amount, true)}">
        <div class="bar-value">${fmtMoney(item.amount)}</div>
        <div class="bar" style="height:${height}%"></div>
        <div class="bar-label">${escapeHtml(item.display)}</div>
      </div>
    `;
  }).join("");
}

function renderDebtSplit() {
  const contracts = panelContracts();
  const current = sum(contracts, (contract) => Math.max(0, contract.balances.currentFinal));
  const nonCurrent = sum(contracts, (contract) => Math.max(0, contract.balances.nonCurrentFinal));
  const total = Math.max(current + nonCurrent, 1);
  const currentPct = (current / total) * 100;
  const nonCurrentPct = (nonCurrent / total) * 100;
  const interest = sum(contracts, (contract) => Math.max(0, contract.balances.interestTotal));

  els.debtSplitChart.innerHTML = `
    <div class="donut-layout">
      <div class="donut" style="background: conic-gradient(var(--blue) 0 ${currentPct}%, var(--green) ${currentPct}% 100%)">
        <div>
          <span>Total</span>
          <strong>${fmtMoney(total)}</strong>
        </div>
      </div>
      <div class="split-legend">
        <div><span class="dot current"></span> Circulante <strong>${fmtMoney(current, true)}</strong> <em>${currentPct.toFixed(1).replace(".", ",")}%</em></div>
        <div><span class="dot non-current"></span> Nao circulante <strong>${fmtMoney(nonCurrent, true)}</strong> <em>${nonCurrentPct.toFixed(1).replace(".", ",")}%</em></div>
        <div><span class="dot amber"></span> Juros total <strong>${fmtMoney(interest, true)}</strong></div>
      </div>
    </div>
  `;
}

function renderTopContractsChart() {
  const items = panelContracts()
    .map((contract) => ({
      id: contract.id,
      label: `${contract.id} - ${contract.contractNumber}`,
      value: contract.balances.finalDebt,
      meta: `${contract.entity} / ${contract.status}`,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  renderRankChart(els.topContractsChart, items, { clickable: true });
}

function renderInterestChart() {
  const items = panelContracts()
    .filter((contract) => contract.balances.finalDebt > 0)
    .map((contract) => ({
      id: contract.id,
      label: `${contract.id} - ${contract.contractNumber}`,
      value: contract.balances.interestTotal,
      meta: contract.entity,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  renderRankChart(els.interestChart, items, { clickable: true });
}

function renderPendingChart() {
  const items = panelContracts()
    .map((contract) => ({
      id: contract.id,
      label: `${contract.id} - ${contract.contractNumber}`,
      value: contractInstallmentStats(contract).pendingAfterSelection,
      meta: contract.entity,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  renderRankChart(els.pendingChart, items, {
    clickable: true,
    valueFormatter: (value) => `${value} parc.`,
  });
}

function renderTypeChart() {
  const items = entriesFromGroup(groupSum(
    panelContracts(),
    (contract) => contract.type || "Sem tipo",
    (contract) => contract.balances.finalDebt,
  )).slice(0, 10);
  renderRankChart(els.typeChart, items);
}

function renderEntityChart() {
  const items = entriesFromGroup(groupSum(
    panelContracts(),
    (contract) => contract.entity || "Sem empresa",
    (contract) => contract.balances.finalDebt,
  ));
  renderRankChart(els.entityChart, items);
}

function renderReviewChart() {
  const entries = panelLedgerEntries();
  const ready = entries.filter((entry) => entry.reviewStatus === "pronto").length;
  const review = entries.filter((entry) => entry.reviewStatus !== "pronto").length;
  const total = Math.max(ready + review, 1);
  const readyPct = (ready / total) * 100;
  const reviewPct = (review / total) * 100;
  els.reviewChart.innerHTML = `
    <div class="review-track">
      <div class="review-ready" style="width:${readyPct}%"></div>
      <div class="review-warning" style="width:${reviewPct}%"></div>
    </div>
    <div class="review-grid">
      <div><span>Prontos</span><strong>${ready}</strong><small>${readyPct.toFixed(1).replace(".", ",")}%</small></div>
      <div><span>A revisar</span><strong>${review}</strong><small>${reviewPct.toFixed(1).replace(".", ",")}%</small></div>
    </div>
  `;
}

function renderRankChart(container, items, options = {}) {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">Sem dados no filtro atual.</div>`;
    return;
  }
  const valueFormatter = options.valueFormatter || ((value) => fmtMoney(value));
  const max = Math.max(...items.map((item) => item.value), 1);
  container.innerHTML = items.map((item) => `
    <button class="rank-row ${options.clickable ? "rank-clickable" : ""}" type="button" ${options.clickable && item.id ? `data-contract-id="${item.id}"` : ""}>
      <div class="rank-label">
        <strong>${escapeHtml(item.label)}</strong>
        ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
      </div>
      <div class="rank-track">
        <div class="rank-bar" style="width:${Math.max(2, (item.value / max) * 100)}%"></div>
      </div>
      <div class="rank-value">${escapeHtml(valueFormatter(item.value))}</div>
    </button>
  `).join("");
  if (options.clickable) {
    container.querySelectorAll("[data-contract-id]").forEach((row) => {
      row.addEventListener("click", () => selectPanelContract(Number(row.dataset.contractId)));
    });
  }
}

function selectPanelContract(contractId) {
  if (!contractId) return;
  state.selectedId = contractId;
  state.selectedInstallmentKeys.clear();
  els.panelContractFilter.value = String(contractId);
  syncTransactionContractToSelected();
  state.transactionDraftEntries = simulateTransaction();
  renderPanelCharts();
  renderContractsTable();
  renderDetail();
  renderContractEditor();
  renderAudit();
  renderTransactionPanel();
}

function renderContractsTable() {
  els.contractsTable.innerHTML = state.filteredContracts.map((contract) => `
    <tr data-id="${contract.id}" data-selected="${contract.id === state.selectedId}">
      <td>${contract.id}</td>
      <td>${escapeHtml(contract.contractNumber)}</td>
      <td>${escapeHtml(contract.entity)}</td>
      <td><span class="pill ${contract.status === "ativo" ? "pill-active" : "pill-settled"}">${escapeHtml(contract.status)}</span></td>
      <td>${escapeHtml(contract.type || "-")}</td>
      <td>${fmtMoney(contract.balances.finalDebt)}</td>
      <td>${fmtMoney(contract.balances.interestTotal)}</td>
      <td>${escapeHtml(contract.comments || "-")}</td>
    </tr>
  `).join("");

  els.contractsTable.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedId = Number(row.dataset.id);
      state.selectedInstallmentKeys.clear();
      syncTransactionContractToSelected();
      state.transactionDraftEntries = simulateTransaction();
      renderContractsTable();
      renderDetail();
      renderContractEditor();
      renderAudit();
      renderTransactionPanel();
    });
  });
}

function selectedContract() {
  return adjustedContracts().find((contract) => contract.id === state.selectedId);
}

function selectedDetail() {
  return contractDetailById(state.selectedId);
}

function renderDetail() {
  const contract = selectedContract();
  if (!contract) {
    els.detail.innerHTML = `<div class="empty-state">Nenhum contrato na selecao atual.</div>`;
    return;
  }
  const detail = selectedDetail();
  const stats = contractInstallmentStats(contract);
  const movementCount = detail?.movements?.length || 0;
  const ledgerCount = allLedgerEntries().filter((entry) => entry.contractId === contract.id).length;
  const flags = contract.flags.length
    ? contract.flags.map((flag) => `<span class="pill pill-warning">${escapeHtml(flag)}</span>`).join(" ")
    : "-";
  const description = detail?.general?.financiado || contract.comments || contract.type || "-";
  const progress = stats.total ? Math.min(100, (stats.paid / stats.total) * 100) : 0;
  const accounts = [
    ["Conta CIRC", contract.accounts.circ, "C"],
    ["(-) Juros CIRC", contract.accounts.jurosCirc, "D"],
    ["Conta N-CIRC", contract.accounts.naoCirc, "C"],
    ["(-) Juros N-CIRC", contract.accounts.jurosNaoCirc, "D"],
  ];
  const systemImpact = contract.systemImpact || {};
  const principalImpact = (systemImpact.currentPrincipal || 0) + (systemImpact.nonCurrentPrincipal || 0);
  const interestImpact = (systemImpact.currentInterest || 0) + (systemImpact.nonCurrentInterest || 0);

  els.detail.innerHTML = `
    <div class="contract-card">
      <div class="contract-card-head">
        <div class="contract-card-title">Contratos</div>
        <span class="index-pill">Index principal</span>
      </div>

      <div class="contract-id-box">
        <span>No. contrato (ID)</span>
        <strong>#${escapeHtml(contract.contractNumber)} <small>(${contract.id})</small></strong>
      </div>

      <div class="contract-metrics">
        <div>
          <span>Descricao</span>
          <strong>${escapeHtml(description)}</strong>
          <small>${escapeHtml(contract.entity)} / ${escapeHtml(contract.type || "-")}</small>
        </div>
        <div>
          <span>% Juros</span>
          <strong>${escapeHtml(formatRate(contract, detail))}</strong>
          <small>${escapeHtml(detail?.general?.method || "")}</small>
        </div>
        <div>
          <span>Principal (divida) / juros</span>
          <strong>${fmtMoney(contract.balances.finalDebt, true)}</strong>
          <small>${fmtMoney(contract.balances.interestTotal, true)}</small>
        </div>
        <div>
          <span>No. de parcelas</span>
          <strong>${stats.total || "-"}</strong>
          <small>${stats.pending} pendente(s)</small>
        </div>
      </div>

      <div class="installment-progress-block">
        <div class="progress-row">
          <span>Parcelas pagas (qtd)</span>
          <strong>${stats.paid} de ${stats.total || stats.installments.length} pagas</strong>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <div class="progress-foot">
          <span>${stats.pendingAfterSelection} pendente(s) apos selecao</span>
          <span>${stats.queued} na esteira</span>
        </div>
      </div>

      <div class="accounts-box">
        <div class="accounts-title">Contas contabeis dos saldos</div>
        ${accounts.map(([label, account, nature]) => `
          <div class="account-line">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(account || "-")}</strong>
            <em>${nature}</em>
          </div>
        `).join("")}
      </div>

      <div class="contract-footer">
        <span>Movimentos: ${movementCount}</span>
        <span>Lancamentos: ${ledgerCount}</span>
        <span>Impacto HTML principal: ${fmtMoney(principalImpact, true)}</span>
        <span>Impacto HTML juros: ${fmtMoney(interestImpact, true)}</span>
        <span>${flags}</span>
      </div>
    </div>
  `;
}

function setEditorDisabled(disabled) {
  [
    els.contractStatusOverride,
    els.contractTypeOverride,
    els.contractCommentsOverride,
    els.accountCircOverride,
    els.accountJurosCircOverride,
    els.accountNaoCircOverride,
    els.accountJurosNaoCircOverride,
    els.balanceCurrentOverride,
    els.balanceNonCurrentOverride,
    els.interestCurrentOverride,
    els.interestNonCurrentOverride,
    els.saveContractOverrideButton,
    els.clearContractOverrideButton,
  ].forEach((control) => {
    if (control) control.disabled = disabled;
  });
}

function fillEditorInput(input, value) {
  if (input) input.value = value ?? "";
}

function renderContractEditor() {
  const original = state.data?.contracts?.find((item) => item.id === state.selectedId);
  const contract = original ? applyContractOverride(original) : null;
  if (!contract) {
    setEditorDisabled(true);
    els.contractEditorStatus.textContent = "Selecione um contrato para editar o cadastro operacional.";
    return;
  }
  setEditorDisabled(false);
  fillEditorInput(els.contractStatusOverride, contract.status || "ativo");
  fillEditorInput(els.contractTypeOverride, contract.type || "");
  fillEditorInput(els.contractCommentsOverride, contract.comments || "");
  fillEditorInput(els.accountCircOverride, contract.accounts.circ || "");
  fillEditorInput(els.accountJurosCircOverride, contract.accounts.jurosCirc || "");
  fillEditorInput(els.accountNaoCircOverride, contract.accounts.naoCirc || "");
  fillEditorInput(els.accountJurosNaoCircOverride, contract.accounts.jurosNaoCirc || "");
  fillEditorInput(els.balanceCurrentOverride, Number(contract.balances.currentFinal || 0).toFixed(2));
  fillEditorInput(els.balanceNonCurrentOverride, Number(contract.balances.nonCurrentFinal || 0).toFixed(2));
  fillEditorInput(els.interestCurrentOverride, Number(contract.balances.interestCurrent || 0).toFixed(2));
  fillEditorInput(els.interestNonCurrentOverride, Number(contract.balances.interestNonCurrent || 0).toFixed(2));
  els.contractEditorStatus.textContent = contract.override?.updatedAt
    ? `Cadastro local ativo desde ${fmtDateBr(contract.override.updatedAt.slice(0, 10))}.`
    : "Sem ajuste local: os campos refletem a base importada.";
}

function inputMoneyValue(input, fallback) {
  if (!String(input?.value ?? "").trim()) return fallback;
  const value = parseAmount(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

function saveContractOverride() {
  const original = state.data?.contracts?.find((contract) => contract.id === state.selectedId);
  if (!original) return;
  const override = {
    updatedAt: new Date().toISOString(),
    fields: {
      status: els.contractStatusOverride.value || original.status,
      type: els.contractTypeOverride.value.trim(),
      comments: els.contractCommentsOverride.value.trim(),
    },
    accounts: {
      circ: els.accountCircOverride.value.trim(),
      jurosCirc: els.accountJurosCircOverride.value.trim(),
      naoCirc: els.accountNaoCircOverride.value.trim(),
      jurosNaoCirc: els.accountJurosNaoCircOverride.value.trim(),
    },
    balances: {
      currentFinal: inputMoneyValue(els.balanceCurrentOverride, original.balances.currentFinal),
      nonCurrentFinal: inputMoneyValue(els.balanceNonCurrentOverride, original.balances.nonCurrentFinal),
      interestCurrent: inputMoneyValue(els.interestCurrentOverride, original.balances.interestCurrent),
      interestNonCurrent: inputMoneyValue(els.interestNonCurrentOverride, original.balances.interestNonCurrent),
    },
  };
  state.contractOverrides[String(original.id)] = override;
  saveManualEntries();
  populatePanelControls();
  populateLedgerControls();
  applyFilters();
}

function clearContractOverride() {
  if (!state.selectedId) return;
  delete state.contractOverrides[String(state.selectedId)];
  saveManualEntries();
  populatePanelControls();
  populateLedgerControls();
  applyFilters();
}

function renderOperationalControl() {
  const model = buildOperationalModel();
  const summary = model.summary;
  const delta = Math.abs((summary.totalDebit || 0) - (summary.totalCredit || 0));
  const healthLabel = summary.critical > 0
    ? "Bloqueio"
    : summary.warnings > 0
      ? "Revisar"
      : "Operacional";
  const items = [
    ["Saude do motor", healthLabel, summary.critical > 0 ? "danger" : summary.warnings > 0 ? "warning" : "good"],
    ["Criticos", summary.critical || 0, summary.critical > 0 ? "danger" : ""],
    ["Avisos", summary.warnings || 0, summary.warnings > 0 ? "warning" : ""],
    ["Cadastros HTML", summary.contractOverrides || 0, ""],
    ["Transacoes HTML", summary.manualEntries || 0, ""],
    ["Nao exportadas", summary.draftEntries || 0, summary.draftEntries > 0 ? "warning" : ""],
    ["Exportadas", summary.exportedEntries || 0, "good"],
    ["D/C diferenca", fmtMoney(delta, true), delta > 0.005 ? "danger" : "good"],
  ];
  els.operationalSummary.innerHTML = items.map(([label, value, tone]) => `
    <section class="control-card ${tone ? `control-${tone}` : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </section>
  `).join("");

  const findings = model.findings.slice(0, 80);
  els.validationList.innerHTML = findings.map((finding) => `
    <div class="validation-item ${escapeHtml(finding.severity)}">
      <div>
        <strong>${escapeHtml(finding.title)}</strong>
        <span>${escapeHtml(finding.detail)}</span>
      </div>
      <em>${escapeHtml(finding.contractId || "-")}${finding.rule ? ` / ${escapeHtml(finding.rule)}` : ""}</em>
    </div>
  `).join("") || `<div class="empty-state">Nenhuma pendencia operacional encontrada.</div>`;

  els.reconciliationTable.innerHTML = model.accountRows.slice(0, 40).map((row) => `
    <tr>
      <td>${escapeHtml(row.account)}</td>
      <td>${fmtMoney(row.debit, true)}</td>
      <td>${fmtMoney(row.credit, true)}</td>
      <td>${fmtMoney(row.balance, true)}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="empty-cell">Sem contas movimentadas.</td></tr>`;

  els.operationTrailTable.innerHTML = model.trailRows.map((entry) => `
    <tr>
      <td>${escapeHtml(entry.operationId || "-")}</td>
      <td>${escapeHtml(entry.createdAt ? fmtDateBr(entry.createdAt.slice(0, 10)) : "-")}</td>
      <td>${entry.contractId} - ${escapeHtml(entry.contractNumber)}</td>
      <td>${escapeHtml(entry.rule)}</td>
      <td>
        <span class="pill ${operationStatusClass(entry.operationStatus || "rascunho")}">
          ${escapeHtml(entry.operationStatus || entry.reviewStatus)}
        </span>
      </td>
      <td>${fmtMoney(entry.amount, true)}</td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="empty-cell">Nenhuma operacao HTML criada.</td></tr>`;
}

function renderAudit() {
  renderOperationalControl();
  const selectedOnly = state.data.audit.filter((item) => item.contractId === state.selectedId);
  const items = selectedOnly.length ? selectedOnly : state.data.audit.slice(0, 50);
  els.audit.innerHTML = items.map((item) => `
    <div class="audit-item ${escapeHtml(item.severity)}">
      <div class="audit-message"><strong>${escapeHtml(item.contractId || "-")}</strong> ${escapeHtml(item.message)}</div>
    </div>
  `).join("") || `<div class="empty-state">Sem alertas para o contrato selecionado.</div>`;
}

function renderRules() {
  els.rules.innerHTML = (state.data.rules || []).map((rule) => `
    <tr>
      <td>${escapeHtml(rule.column)}</td>
      <td>${escapeHtml(rule.name)}</td>
    </tr>
  `).join("");
}

function renderLedgerPanel() {
  renderLedgerKpis();
  renderLedgerCharts();
  renderLedgerTable();
}

function renderLedgerKpis() {
  const entries = state.filteredLedger;
  const selectedEntries = entries.filter((entry) => state.selectedLedgerIds.has(entry.id));
  const ready = entries.filter((entry) => entry.reviewStatus === "pronto").length;
  const review = entries.length - ready;
  const approved = entries.filter((entry) => entry.operationStatus === "aprovado").length;
  const exported = entries.filter((entry) => entry.operationStatus === "exportado").length;
  const notExported = entries.filter((entry) => entry.operationStatus !== "exportado").length;
  const selectedAmount = sum(selectedEntries, (entry) => entry.amount);
  const items = [
    ["Lancamentos", entries.length],
    ["Prontos", ready],
    ["A revisar", review],
    ["Aprovados", approved],
    ["Exportados", exported],
    ["Nao export.", notExported],
    ["Selecionados", selectedEntries.length],
    ["Valor selecionado", fmtMoney(selectedAmount)],
  ];
  els.ledgerKpis.innerHTML = items.map(([label, value]) => `
    <section class="kpi">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${escapeHtml(value)}</div>
    </section>
  `).join("");
}

function renderLedgerCharts() {
  const byMonth = Object.values(state.filteredLedger.reduce((acc, entry) => {
    const date = entry.month || "-";
    if (!acc[date]) {
      acc[date] = { date, label: monthLabel(date), amount: 0, count: 0 };
    }
    acc[date].amount += entry.amount || 0;
    acc[date].count += 1;
    return acc;
  }, {}))
    .sort((a, b) => a.date.localeCompare(b.date));

  const maxMonth = Math.max(...byMonth.map((item) => item.amount), 1);
  els.ledgerMonthChart.innerHTML = byMonth.map((item) => {
    const height = Math.max(2, (item.amount / maxMonth) * 128);
    return `
      <div class="bar-wrap narrow" title="${escapeHtml(item.date)}: ${fmtMoney(item.amount, true)} | ${item.count} lancamento(s)">
        <div class="bar-count">${item.count}</div>
        <div class="bar ledger" style="height:${height}px"></div>
        <div class="bar-label">${escapeHtml(item.label)}</div>
      </div>
    `;
  }).join("") || `<div class="empty-state">Sem lancamentos no filtro.</div>`;

  const byRule = entriesFromGroup(groupSum(
    state.filteredLedger,
    (entry) => entry.rule,
    (entry) => entry.amount,
  )).map((item) => ({
    ...item,
    meta: state.filteredLedger.find((entry) => entry.rule === item.label)?.description || "",
  }));
  renderRankChart(els.ledgerRuleChart, byRule);
}

function renderLedgerTable() {
  const maxRows = 700;
  const rows = state.filteredLedger.slice(0, maxRows);
  els.ledgerCount.textContent = `${rows.length} de ${state.filteredLedger.length} linhas exibidas`;
  els.toggleVisibleLedger.checked = rows.length > 0 && rows.every((entry) => state.selectedLedgerIds.has(entry.id));

  els.ledgerTable.innerHTML = rows.map((entry) => ledgerRowCells(entry, true)).join("");

  els.ledgerTable.querySelectorAll(".ledger-check").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.selectedLedgerIds.add(checkbox.dataset.id);
      } else {
        state.selectedLedgerIds.delete(checkbox.dataset.id);
      }
      renderLedgerKpis();
    });
  });
}

function isInterestAction(action) {
  return [
    "interest_adjustment",
    "interest_reversal_dre",
    "interest_complement_dre",
  ].includes(action);
}

function isFixedTransferAction(action) {
  return ["liability_transfer_nc_current", "interest_transfer_nc_current"].includes(action);
}

function normalizeScopeValue(value, fallback = "current") {
  const scope = normalizeKey(value || fallback)
    .replace("nao_circulante", "non_current")
    .replace("nao circulante", "non_current")
    .replace("nao_current", "non_current")
    .replace("nao current", "non_current")
    .replace("circulante", "current");
  return ["current", "non_current", "both"].includes(scope) ? scope : fallback;
}

function scopeTargets(contract, scope, action) {
  const balances = contract.balances;
  const interestWeights = {
    current: Math.max(0, balances.interestCurrent || 0),
    non_current: Math.max(0, balances.interestNonCurrent || 0),
  };
  const principalWeights = {
    current: Math.max(0, balances.currentFinal || 0),
    non_current: Math.max(0, balances.nonCurrentFinal || 0),
  };
  const weights = isInterestAction(action) ? interestWeights : principalWeights;
  const totalWeight = weights.current + weights.non_current;
  const base = [
    {
      scope: "current",
      label: "Circulante",
      principalAccount: contract.accounts.circ,
      interestAccount: contract.accounts.jurosCirc,
      weight: totalWeight ? weights.current / totalWeight : 0.5,
    },
    {
      scope: "non_current",
      label: "Nao circulante",
      principalAccount: contract.accounts.naoCirc,
      interestAccount: contract.accounts.jurosNaoCirc,
      weight: totalWeight ? weights.non_current / totalWeight : 0.5,
    },
  ];
  if (scope === "both") return base;
  return base.filter((target) => target.scope === scope);
}

function draftRuleIssues({ contract, debit, credit, amount, rule }) {
  const issues = [];
  const resultAccount = resultAccountFor(contract);
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0.005) {
    issues.push("Valor invalido ou zerado");
  }
  if (debit && credit && debit === credit) {
    issues.push("Debito e credito iguais");
  }
  if (rule.includes("TRANSF-PASSIVO-NC-C") && (debit !== contract.accounts.naoCirc || credit !== contract.accounts.circ)) {
    issues.push("Transf. Passivo NC/C deve debitar N-CIRC e creditar CIRC");
  }
  if (rule.includes("TRANSF-JUROS-NC-C") && (debit !== contract.accounts.jurosNaoCirc || credit !== contract.accounts.jurosCirc)) {
    issues.push("Transf. Juros NC/C deve debitar juros N-CIRC e creditar juros CIRC");
  }
  if (rule.includes("ESTORNO-JUROS-DRE") && credit !== resultAccount) {
    issues.push("Estorno DRE deve creditar resultado financeiro");
  }
  if (rule.includes("COMP-JUROS-DRE") && debit !== resultAccount) {
    issues.push("Complemento DRE deve debitar resultado financeiro");
  }
  return issues;
}

function makeManualEntry({
  contract,
  date,
  debit,
  credit,
  amount,
  rule,
  description,
  issues = [],
  parcel = "",
  sourceColumn = "HTML",
  extra = {},
}) {
  const issueList = [...issues];
  issueList.push(...draftRuleIssues({ contract, debit, credit, amount, rule }));
  if (!accountIsReady(debit)) issueList.push(`Debito pendente: ${debit || "vazio"}`);
  if (!accountIsReady(credit)) issueList.push(`Credito pendente: ${credit || "vazio"}`);
  if (contract.status === "quitado") issueList.push("Contrato ja marcado como quitado na base");

  return {
    id: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    origin: "manual",
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    entity: contract.entity,
    contractType: contract.type,
    status: contract.status,
    parcel,
    date,
    year: Number(date.slice(0, 4)),
    month: date.slice(0, 7),
    debit,
    credit,
    amount,
    historyCode: "",
    description,
    rule,
    sourceColumn,
    sourceRow: "",
    reviewStatus: issueList.length ? "revisar" : "pronto",
    issues: issueList,
    ...extra,
  };
}

function transactionDescription(action, contract, target, note, settled) {
  const noteText = note ? ` - ${note}` : "";
  const settledText = settled === "S" ? " com quitacao informada" : "";
  const base = {
    payment: `Pagamento/amortizacao ${target.label}${settledText}`,
    interest_adjustment: `Ajuste de juros ${target.label}`,
    liability_adjustment: `Ajuste do passivo ${target.label}`,
    liability_transfer_nc_current: "Transf. Passivo NC/C",
    interest_transfer_nc_current: "Transf. Juros Passivo NC/C",
    interest_reversal_dre: `Estorno de juros (DRE) ${target.label}`,
    interest_complement_dre: `Complemento de juros (DRE) ${target.label}`,
    settlement: `Quitacao ${target.label}`,
    custom: "Lancamento manual",
  }[action];
  return `${base} ref. contrato ${contract.contractNumber} aba (${contract.id})${noteText}`;
}

function actionExplanation(action) {
  return {
    payment: "Registra pagamento ou amortizacao contra a conta do passivo e a conta 000. Se houver parcelas selecionadas, usa exatamente essas parcelas; sem selecao, usa o valor livre do formulario.",
    paid_installment_adjustment: "Ajusta uma parcela que ja consta como paga sem apagar o historico. Selecione parcelas pagas; direcao Aumenta estorna o pagamento e reabre saldo, direcao Reduz gera uma baixa complementar.",
    interest_adjustment: "Gera ajuste de juros contra a conta de resultado do contrato. Leasing usa 4773; os demais usam 375. A direcao define se aumenta ou reduz o juros/redutora.",
    liability_adjustment: "Gera ajuste no passivo circulante ou nao circulante. Usa a conta ponte AAA e por isso fica marcado como revisar antes da importacao.",
    liability_transfer_nc_current: "Transfere passivo do nao circulante para o circulante: debita a conta N-CIRC e credita a conta CIRC do contrato.",
    interest_transfer_nc_current: "Transfere juros do passivo nao circulante para o circulante: debita a redutora N-CIRC e credita a redutora CIRC.",
    interest_reversal_dre: "Estorna juros reconhecidos a maior ou que ja deveriam ter sido baixados: debita juros do passivo e credita resultado financeiro.",
    interest_complement_dre: "Complementa juros nao reconhecidos anteriormente: debita resultado financeiro e credita juros do passivo.",
    settlement: "Registra baixa/quitacao do contrato no alvo escolhido. Se houver parcelas selecionadas, baixa essas parcelas; se o valor ficar vazio, usa o saldo final do alvo quando existir.",
    custom: "Permite informar manualmente debito e credito. Use quando a operacao nao couber nas regras padrao.",
  }[action] || "";
}

function toggleTransactionFields() {
  const action = els.transactionActionSelect.value;
  const visible = {
    amount: true,
    installments: ["payment", "settlement"].includes(action),
    scope: ["payment", "settlement", "interest_adjustment", "liability_adjustment", "interest_reversal_dre", "interest_complement_dre"].includes(action),
    direction: ["paid_installment_adjustment", "interest_adjustment", "liability_adjustment"].includes(action),
    manual: action === "custom",
  };
  document.querySelectorAll("[data-field]").forEach((field) => {
    const key = field.dataset.field;
    field.classList.toggle("field-hidden", visible[key] === false);
  });
}

function simulateSelectedInstallmentPayments(contract, action, selectedInstallments, options = {}) {
  const paymentDate = options.date ?? els.transactionDateInput.value;
  const settled = options.settled ?? els.transactionSettledSelect.value;
  const note = options.note ?? els.transactionNoteInput.value.trim();
  const sourceColumn = options.sourceColumn || "HTML";
  const entries = [];
  selectedInstallments.forEach((installment) => {
    const date = paymentDate || installment.date;
    const baseDescription = `${action === "settlement" ? "Quitacao" : "Pagamento"} parcela ${installment.parcel} venc. ${fmtDateBr(installment.date)} ref. contrato ${contract.contractNumber} aba (${contract.id})`;
    const noteText = note ? ` - ${note}` : "";
    const issues = [];
    if (settled === "S") issues.push("Quitou = S; conferir se a baixa liquida o saldo do contrato");

    if (installment.principal > 0.005) {
      entries.push(makeManualEntry({
        contract,
        date,
        debit: contract.accounts.circ,
        credit: "000",
        amount: installment.principal,
        rule: action === "settlement" ? "TX-QUIT-PARC-PRINC" : "TX-PARC-PRINC",
        description: `${baseDescription} - principal${noteText}`,
        issues,
        parcel: installment.parcel,
        sourceColumn,
        extra: {
          installmentKey: installment.key,
          installmentDueDate: installment.date,
          installmentComponent: "principal",
        },
      }));
    }

    if (installment.interest > 0.005) {
      entries.push(makeManualEntry({
        contract,
        date,
        debit: contract.accounts.circ,
        credit: "000",
        amount: installment.interest,
        rule: action === "settlement" ? "TX-QUIT-PARC-JUROS" : "TX-PARC-JUROS",
        description: `${baseDescription} - juros${noteText}`,
        issues,
        parcel: installment.parcel,
        sourceColumn,
        extra: {
          installmentKey: installment.key,
          installmentDueDate: installment.date,
          installmentComponent: "juros",
        },
      }));
    }
  });
  return entries;
}

function simulatePaidInstallmentAdjustment(contract, selectedInstallments) {
  const adjustmentDate = els.transactionDateInput.value || todayIso();
  const direction = els.transactionDirectionSelect.value;
  const note = els.transactionNoteInput.value.trim();
  const amountInput = parseAmount(els.transactionAmountInput.value);
  const selectedTotal = sum(selectedInstallments, (item) => item.total);
  const noteText = note ? ` - ${note}` : "";
  const isReversal = direction === "increase";
  const entries = [];

  selectedInstallments.forEach((installment) => {
    const targetTotal = scaledInstallmentAmount(amountInput, installment, selectedTotal) || installment.total;
    const principal = installment.total > 0 ? targetTotal * (installment.principal / installment.total) : 0;
    const interest = installment.total > 0 ? targetTotal * (installment.interest / installment.total) : 0;
    const baseDescription = `${isReversal ? "Estorno" : "Complemento"} de parcela paga ${installment.parcel} venc. ${fmtDateBr(installment.date)} ref. contrato ${contract.contractNumber} aba (${contract.id})`;

    if (principal > 0.005) {
      entries.push(makeManualEntry({
        contract,
        date: adjustmentDate,
        debit: isReversal ? "000" : contract.accounts.circ,
        credit: isReversal ? contract.accounts.circ : "000",
        amount: principal,
        rule: isReversal ? "TX-ESTORNO-PARC-PRINC" : "TX-COMP-PARC-PRINC",
        description: `${baseDescription} - principal${noteText}`,
        parcel: installment.parcel,
        extra: {
          installmentKey: installment.key,
          installmentDueDate: installment.date,
          installmentComponent: "principal",
          installmentAdjustment: isReversal ? "reversal" : "complement",
        },
      }));
    }

    if (interest > 0.005) {
      entries.push(makeManualEntry({
        contract,
        date: adjustmentDate,
        debit: isReversal ? "000" : contract.accounts.circ,
        credit: isReversal ? contract.accounts.circ : "000",
        amount: interest,
        rule: isReversal ? "TX-ESTORNO-PARC-JUROS" : "TX-COMP-PARC-JUROS",
        description: `${baseDescription} - juros${noteText}`,
        parcel: installment.parcel,
        extra: {
          installmentKey: installment.key,
          installmentDueDate: installment.date,
          installmentComponent: "juros",
          installmentAdjustment: isReversal ? "reversal" : "complement",
        },
      }));
    }
  });

  return entries;
}

function simulateTransaction() {
  const contract = selectedTransactionContract();
  if (!contract) return [];

  const action = els.transactionActionSelect.value;
  const date = els.transactionDateInput.value;
  const amountInput = parseAmount(els.transactionAmountInput.value);
  const installments = Math.max(1, Number(els.transactionInstallmentsInput.value || 1));
  const scope = els.transactionScopeSelect.value;
  const direction = els.transactionDirectionSelect.value;
  const settled = els.transactionSettledSelect.value;
  const note = els.transactionNoteInput.value.trim();
  const resultAccount = resultAccountFor(contract);
  const targets = action === "custom"
    ? [{ scope: "custom", label: "Manual", weight: 1, principalAccount: "", interestAccount: "" }]
    : isFixedTransferAction(action)
      ? [{ scope: "transfer", label: "NC/C", weight: 1, principalAccount: "", interestAccount: "" }]
    : scopeTargets(contract, scope, action);
  const selectedInstallments = selectedPaymentInstallments(contract);
  const selectedByKey = selectedInstallmentsByKey(contract);

  if ((action === "payment" || action === "settlement") && selectedInstallments.length) {
    return simulateSelectedInstallmentPayments(contract, action, selectedInstallments);
  }

  if (action === "paid_installment_adjustment") {
    const paidSelected = selectedByKey.filter((item) => item.status === "paga");
    return paidSelected.length ? simulatePaidInstallmentAdjustment(contract, paidSelected) : [];
  }

  if (!date || (!amountInput && action !== "settlement")) {
    return [];
  }

  const entries = [];
  for (let index = 0; index < installments; index += 1) {
    const entryDate = addMonths(date, index);
    targets.forEach((target) => {
      let targetTotal = amountInput;
      if (targetTotal && targets.length > 1) {
        targetTotal *= target.weight;
      }
      if (!targetTotal && action === "settlement") {
        targetTotal = target.scope === "current"
          ? Math.max(0, contract.balances.currentFinal || 0)
          : Math.max(0, contract.balances.nonCurrentFinal || 0);
      }
      const targetAmount = targetTotal / installments;
      if (!targetAmount) return;

      let debit = "";
      let credit = "";
      let rule = "";
      const description = transactionDescription(action, contract, target, note, settled);
      const issues = [];

      if (settled === "S") issues.push("Quitou = S; conferir se a baixa liquida o saldo do contrato");

      if (action === "payment" || action === "settlement") {
        debit = target.principalAccount;
        credit = "000";
        rule = action === "settlement" ? "TX-QUITACAO" : "TX-PGTO";
      } else if (action === "interest_adjustment") {
        if (direction === "increase") {
          debit = resultAccount;
          credit = target.interestAccount;
          rule = "TX-JUROS+";
        } else {
          debit = target.interestAccount;
          credit = resultAccount;
          rule = "TX-JUROS-";
        }
      } else if (action === "liability_adjustment") {
        if (direction === "increase") {
          debit = "AAA";
          credit = target.principalAccount;
          rule = "TX-PASSIVO+";
        } else {
          debit = target.principalAccount;
          credit = "AAA";
          rule = "TX-PASSIVO-";
        }
      } else if (action === "liability_transfer_nc_current") {
        debit = contract.accounts.naoCirc;
        credit = contract.accounts.circ;
        rule = "TX-TRANSF-PASSIVO-NC-C";
      } else if (action === "interest_transfer_nc_current") {
        debit = contract.accounts.jurosNaoCirc;
        credit = contract.accounts.jurosCirc;
        rule = "TX-TRANSF-JUROS-NC-C";
      } else if (action === "interest_reversal_dre") {
        debit = target.interestAccount;
        credit = resultAccount;
        rule = "TX-ESTORNO-JUROS-DRE";
      } else if (action === "interest_complement_dre") {
        debit = resultAccount;
        credit = target.interestAccount;
        rule = "TX-COMP-JUROS-DRE";
      } else {
        debit = els.transactionDebitInput.value.trim();
        credit = els.transactionCreditInput.value.trim();
        rule = "TX-MANUAL";
      }

      entries.push(makeManualEntry({
        contract,
        date: entryDate,
        debit,
        credit,
        amount: targetAmount,
        rule,
        description,
        issues,
      }));
    });
  }
  return entries;
}

function renderTransactionPanel() {
  if (!state.data) return;
  const contract = selectedTransactionContract();
  const action = els.transactionActionSelect.value;
  toggleTransactionFields();
  els.transactionExplanation.innerHTML = `<p>${escapeHtml(actionExplanation(action))}</p>`;

  if (contract) {
    const stats = contractInstallmentStats(contract);
    els.transactionContractSnapshot.innerHTML = `
      <div><span>Contrato</span><strong>${escapeHtml(contract.contractNumber)}</strong></div>
      <div><span>Status</span><strong>${escapeHtml(contract.status)}</strong></div>
      <div><span>Tipo</span><strong>${escapeHtml(contract.type || "-")}</strong></div>
      <div><span>Resultado</span><strong>${resultAccountFor(contract)}</strong></div>
      <div><span>Parcelas</span><strong>${stats.paid}/${stats.total || stats.installments.length} pagas</strong></div>
      <div><span>Pendentes</span><strong>${stats.pendingAfterSelection} apos selecao</strong></div>
      <div><span>Circ.</span><strong>${escapeHtml(contract.accounts.circ || "-")}</strong></div>
      <div><span>N-Circ.</span><strong>${escapeHtml(contract.accounts.naoCirc || "-")}</strong></div>
      <div><span>Red. C</span><strong>${escapeHtml(contract.accounts.jurosCirc || "-")}</strong></div>
      <div><span>Red. NC</span><strong>${escapeHtml(contract.accounts.jurosNaoCirc || "-")}</strong></div>
    `;
  }

  renderPaymentInstallments();
  renderTransactionSimulation();
  renderManualTransactions();
  renderBatchImport();
}

function renderPaymentInstallments() {
  const contract = selectedTransactionContract();
  if (!contract) {
    els.paymentInstallmentSummary.innerHTML = "";
    els.paymentInstallmentsTable.innerHTML = "";
    return;
  }
  const action = els.transactionActionSelect.value;
  const stats = contractInstallmentStats(contract);
  const rows = stats.installments;
  const selectedRows = selectedInstallmentsByKey(contract);
  const selectedCount = action === "paid_installment_adjustment" ? selectedRows.length : stats.selected;
  const selectedAmount = action === "paid_installment_adjustment"
    ? sum(selectedRows, (item) => item.total)
    : stats.selectedAmount;
  els.paymentInstallmentSummary.innerHTML = `
    <div class="summary-metric"><span>Total parcelas</span><strong>${stats.total || rows.length}</strong></div>
    <div class="summary-metric"><span>Pagas</span><strong>${stats.paid}</strong></div>
    <div class="summary-metric"><span>Pendentes</span><strong>${stats.pending}</strong></div>
    <div class="summary-metric"><span>Selecionadas</span><strong>${selectedCount}</strong></div>
    <div class="summary-metric"><span>Ficarao pendentes</span><strong>${stats.pendingAfterSelection}</strong></div>
    <div class="summary-metric"><span>Total selecionado</span><strong>${fmtMoney(selectedAmount, true)}</strong></div>
  `;

  els.paymentInstallmentsTable.innerHTML = rows.map((item) => {
    const selectable = action === "paid_installment_adjustment"
      ? item.status === "paga"
      : item.status === "pendente" || item.status === "selecionada";
    const checked = state.selectedInstallmentKeys.has(item.key);
    return `
      <tr class="installment-row ${item.status.replace(/\s+/g, "-")}">
        <td><input class="installment-check" type="checkbox" data-key="${escapeHtml(item.key)}" ${checked ? "checked" : ""} ${selectable ? "" : "disabled"}></td>
        <td>${escapeHtml(item.parcel)}</td>
        <td>${fmtDateBr(item.date)}</td>
        <td>${fmtMoney(item.principal, true)}</td>
        <td>${fmtMoney(item.interest, true)}</td>
        <td>${fmtMoney(item.total, true)}</td>
        <td><span class="pill ${item.status === "paga" ? "pill-settled" : item.status === "na esteira" ? "pill-warning" : "pill-active"}">${escapeHtml(item.status)}</span></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="7" class="empty-cell">Sem parcelas com amortizacao para este contrato.</td></tr>`;

  els.paymentInstallmentsTable.querySelectorAll(".installment-check").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.selectedInstallmentKeys.add(checkbox.dataset.key);
      } else {
        state.selectedInstallmentKeys.delete(checkbox.dataset.key);
      }
      state.transactionDraftEntries = simulateTransaction();
      renderTransactionPanel();
      renderDetail();
    });
  });
}

function renderTransactionSimulation() {
  const rows = state.transactionDraftEntries;
  els.transactionSimulationCount.textContent = `${rows.length} lancamento(s) simulados`;
  els.transactionSimulationTable.innerHTML = rows.map((entry) => ledgerRowCells(entry, false)).join("")
    || `<tr><td colspan="9" class="empty-cell">Preencha os dados e clique em Simular.</td></tr>`;
}

function renderManualTransactions() {
  els.manualTransactionsTable.innerHTML = state.manualEntries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((entry) => ledgerRowCells(entry, false))
    .join("") || `<tr><td colspan="9" class="empty-cell">Nenhuma transacao adicionada nesta camada local.</td></tr>`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === "\"") {
      if (quoted && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ";" && !quoted) {
      row.push(field);
      field = "";
    } else if (char === "\n" && !quoted) {
      row.push(field);
      if (row.some((cell) => String(cell).trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => String(cell).trim())) rows.push(row);
  return rows;
}

function parseCsvObjects(text) {
  const rows = parseCsv(text);
  const headers = (rows.shift() || []).map((header) => normalizeKey(header));
  return rows.map((row, index) => ({
    line: index + 2,
    raw: headers.reduce((acc, header, colIndex) => {
      acc[header] = String(row[colIndex] ?? "").trim();
      return acc;
    }, {}),
  }));
}

function parseParcelSpec(spec) {
  const text = String(spec ?? "").trim();
  if (!text) return [];
  const result = new Set();
  text.split(",").map((item) => item.trim()).filter(Boolean).forEach((part) => {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let value = min; value <= max; value += 1) result.add(value);
    } else {
      const value = Number(part);
      if (Number.isFinite(value)) result.add(value);
    }
  });
  return [...result];
}

function targetFromScope(contract, scope, action) {
  const normalizedScope = normalizeScopeValue(scope, "current");
  return scopeTargets(contract, normalizedScope, action)[0] || scopeTargets(contract, "current", action)[0];
}

function makeBatchAdjustmentEntries(contract, row, type, date, amount, note) {
  const normalizedScope = normalizeScopeValue(row.alvo, "current");
  const direction = normalizeKey(row.direcao || "increase").includes("redu") ? "decrease" : "increase";
  const action = type === "ajuste_juros" ? "interest_adjustment" : "liability_adjustment";
  const targets = scopeTargets(contract, normalizedScope, action);
  const resultAccount = resultAccountFor(contract);
  const entries = [];
  targets.forEach((target) => {
    const value = targets.length > 1 ? amount * target.weight : amount;
    if (!value) return;
    let debit = "";
    let credit = "";
    let rule = "";
    if (action === "interest_adjustment") {
      if (direction === "increase") {
        debit = resultAccount;
        credit = target.interestAccount;
        rule = "CSV-JUROS+";
      } else {
        debit = target.interestAccount;
        credit = resultAccount;
        rule = "CSV-JUROS-";
      }
    } else if (direction === "increase") {
      debit = "AAA";
      credit = target.principalAccount;
      rule = "CSV-PASSIVO+";
    } else {
      debit = target.principalAccount;
      credit = "AAA";
      rule = "CSV-PASSIVO-";
    }
    entries.push(makeManualEntry({
      contract,
      date,
      debit,
      credit,
      amount: value,
      rule,
      description: `${type === "ajuste_juros" ? "Ajuste de juros" : "Ajuste do passivo"} ${target.label} via CSV ref. contrato ${contract.contractNumber} aba (${contract.id})${note ? ` - ${note}` : ""}`,
      sourceColumn: "CSV",
    }));
  });
  return entries;
}

function makeBatchTransferEntry(contract, typeKey, date, amount, note) {
  const isInterest = typeKey.includes("juros");
  return makeManualEntry({
    contract,
    date,
    debit: isInterest ? contract.accounts.jurosNaoCirc : contract.accounts.naoCirc,
    credit: isInterest ? contract.accounts.jurosCirc : contract.accounts.circ,
    amount,
    rule: isInterest ? "CSV-TRANSF-JUROS-NC-C" : "CSV-TRANSF-PASSIVO-NC-C",
    description: `${isInterest ? "Transf. Juros Passivo NC/C" : "Transf. Passivo NC/C"} via CSV ref. contrato ${contract.contractNumber} aba (${contract.id})${note ? ` - ${note}` : ""}`,
    sourceColumn: "CSV",
  });
}

function makeBatchDreInterestEntries(contract, typeKey, row, date, amount, note) {
  const normalizedScope = normalizeScopeValue(row.alvo, "both");
  const isReversal = typeKey.includes("estorno");
  const resultAccount = resultAccountFor(contract);
  const targets = scopeTargets(contract, normalizedScope, isReversal ? "interest_reversal_dre" : "interest_complement_dre");
  return targets.map((target) => {
    const value = targets.length > 1 ? amount * target.weight : amount;
    return makeManualEntry({
      contract,
      date,
      debit: isReversal ? target.interestAccount : resultAccount,
      credit: isReversal ? resultAccount : target.interestAccount,
      amount: value,
      rule: isReversal ? "CSV-ESTORNO-JUROS-DRE" : "CSV-COMP-JUROS-DRE",
      description: `${isReversal ? "Estorno de juros (DRE)" : "Complemento de juros (DRE)"} ${target.label} via CSV ref. contrato ${contract.contractNumber} aba (${contract.id})${note ? ` - ${note}` : ""}`,
      sourceColumn: "CSV",
    });
  }).filter((entry) => entry.amount > 0.005);
}

function buildBatchEntries(row) {
  const data = row.raw;
  const type = normalizeTypeKey(data.tipo || data.acao);
  const contract = contractByInput(data.contrato_id || data.contrato || data.id);
  const date = normalizeDate(data.data || data.data_pagamento);
  const note = data.observacao || data.historico || "";
  const settled = (data.quitou || "N").trim().toUpperCase() === "S" ? "S" : "N";
  const amount = parseAmount(data.valor || data.valor_total);
  const errors = [];
  let entries = [];

  if (!type) errors.push("Tipo/acao nao informado.");
  if (!contract) errors.push("Contrato nao encontrado.");
  if (!date) errors.push("Data invalida ou ausente.");

  if (errors.length || !contract) {
    return { ...row, type, contract, entries, status: "erro", message: errors.join(" ") };
  }

  if (["pagamento", "payment", "quitacao", "settlement"].includes(type)) {
    const action = ["quitacao", "settlement"].includes(type) ? "settlement" : "payment";
    const requestedParcels = parseParcelSpec(data.parcelas || data.parcela);
    if (requestedParcels.length) {
      const installments = contractInstallments(contract);
      const selected = requestedParcels
        .map((parcel) => installments.find((item) => Number(item.parcel) === parcel))
        .filter(Boolean);
      const missing = requestedParcels.filter((parcel) => !selected.some((item) => Number(item.parcel) === parcel));
      const blocked = selected.filter((item) => item.status === "paga" || item.status === "na esteira");
      if (missing.length) errors.push(`Parcela(s) inexistente(s): ${missing.join(", ")}.`);
      if (blocked.length) errors.push(`Parcela(s) indisponivel(is): ${blocked.map((item) => item.parcel).join(", ")}.`);
      entries = simulateSelectedInstallmentPayments(contract, action, selected.filter((item) => item.status === "pendente" || item.status === "selecionada"), {
        date,
        settled,
        note,
        sourceColumn: "CSV",
      });
    } else if (amount > 0) {
      const target = targetFromScope(contract, data.alvo, action);
      entries = [makeManualEntry({
        contract,
        date,
        debit: target.principalAccount,
        credit: "000",
        amount,
        rule: action === "settlement" ? "CSV-QUITACAO" : "CSV-PGTO",
        description: `${action === "settlement" ? "Quitacao" : "Pagamento"} via CSV ref. contrato ${contract.contractNumber} aba (${contract.id})${note ? ` - ${note}` : ""}`,
        issues: settled === "S" ? ["Quitou = S; conferir se a baixa liquida o saldo do contrato"] : [],
        sourceColumn: "CSV",
      })];
    } else {
      errors.push("Informe parcelas ou valor para pagamento/quitacao.");
    }
  } else if (["manual", "lancamento_manual"].includes(type)) {
    if (!data.debito) errors.push("Debito manual ausente.");
    if (!data.credito) errors.push("Credito manual ausente.");
    if (amount <= 0) errors.push("Valor manual invalido.");
    if (!errors.length) {
      entries = [makeManualEntry({
        contract,
        date,
        debit: data.debito,
        credit: data.credito,
        amount,
        rule: "CSV-MANUAL",
        description: `Lancamento manual via CSV ref. contrato ${contract.contractNumber} aba (${contract.id})${note ? ` - ${note}` : ""}`,
        sourceColumn: "CSV",
      })];
    }
  } else if (["ajuste_juros", "interest_adjustment", "ajuste_passivo", "liability_adjustment"].includes(type)) {
    if (amount <= 0) errors.push("Valor de ajuste invalido.");
    if (!errors.length) {
      const normalizedType = type.includes("juros") || type.includes("interest") ? "ajuste_juros" : "ajuste_passivo";
      entries = makeBatchAdjustmentEntries(contract, data, normalizedType, date, amount, note);
    }
  } else if (["transf_passivo_nc_c", "transferencia_passivo_nc_c", "transf_passivo"].includes(type)) {
    if (amount <= 0) errors.push("Valor da transferencia invalido.");
    if (!errors.length) entries = [makeBatchTransferEntry(contract, "transf_passivo_nc_c", date, amount, note)];
  } else if (["transf_juros_nc_c", "transferencia_juros_nc_c", "transf_juros_passivo_nc_c", "transf_juros"].includes(type)) {
    if (amount <= 0) errors.push("Valor da transferencia de juros invalido.");
    if (!errors.length) entries = [makeBatchTransferEntry(contract, "transf_juros_nc_c", date, amount, note)];
  } else if (["estorno_juros_dre", "estorno_de_juros_dre", "complemento_juros_dre", "complemento_de_juros_dre"].includes(type)) {
    if (amount <= 0) errors.push("Valor de juros DRE invalido.");
    if (!errors.length) entries = makeBatchDreInterestEntries(contract, type, data, date, amount, note);
  } else {
    errors.push(`Tipo nao reconhecido: ${type}.`);
  }

  if (!entries.length && !errors.length) errors.push("Nenhum lancamento gerado.");
  return {
    ...row,
    type,
    contract,
    entries,
    status: errors.length ? "erro" : entries.some((entry) => entry.reviewStatus === "revisar") ? "revisar" : "pronto",
    message: errors.join(" ") || "Pronto para adicionar.",
  };
}

function renderBatchImport() {
  const rows = state.batchImportRows;
  const validRows = rows.filter((row) => row.status !== "erro");
  const entries = validRows.flatMap((row) => row.entries);
  els.batchImportSummary.innerHTML = `
    <div class="summary-metric"><span>Linhas</span><strong>${rows.length}</strong></div>
    <div class="summary-metric"><span>Validas</span><strong>${validRows.length}</strong></div>
    <div class="summary-metric"><span>Com erro</span><strong>${rows.length - validRows.length}</strong></div>
    <div class="summary-metric"><span>Lancamentos</span><strong>${entries.length}</strong></div>
    <div class="summary-metric"><span>A revisar</span><strong>${entries.filter((entry) => entry.reviewStatus === "revisar").length}</strong></div>
    <div class="summary-metric"><span>Valor</span><strong>${fmtMoney(sum(entries, (entry) => entry.amount), true)}</strong></div>
  `;
  els.batchImportTable.innerHTML = rows.map((row) => `
    <tr class="${row.status === "erro" ? "batch-error" : ""}">
      <td>${row.line}</td>
      <td>${escapeHtml(row.type || "-")}</td>
      <td>${row.contract ? `${row.contract.id} - ${escapeHtml(row.contract.contractNumber)}` : "-"}</td>
      <td>${escapeHtml(row.raw.parcelas || row.raw.parcela || "-")}</td>
      <td>${row.entries.length ? fmtMoney(sum(row.entries, (entry) => entry.amount), true) : escapeHtml(row.raw.valor || row.raw.valor_total || "-")}</td>
      <td>${row.entries.length}</td>
      <td><span class="pill ${row.status === "erro" ? "pill-danger" : row.status === "revisar" ? "pill-warning" : "pill-active"}">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.message)}</td>
    </tr>
  `).join("") || `<tr><td colspan="8" class="empty-cell">Importe um CSV para validar os lancamentos em lote.</td></tr>`;
}

function ledgerRowCells(entry, withCheck = true) {
  const checkbox = withCheck
    ? `<td><input class="ledger-check" type="checkbox" data-id="${escapeHtml(entry.id)}" ${state.selectedLedgerIds.has(entry.id) ? "checked" : ""}></td>`
    : "";
  return `
    <tr class="${entry.origin === "manual" ? "manual-row" : ""}">
      ${checkbox}
      <td>${fmtDateBr(entry.date)}</td>
      <td>${escapeHtml(entry.parcel || "-")}</td>
      <td>${entry.contractId} - ${escapeHtml(entry.contractNumber)}</td>
      <td>${escapeHtml(entry.rule)} <span class="source-column">${escapeHtml(entry.sourceColumn)}</span></td>
      <td>${escapeHtml(entry.debit)}</td>
      <td>${escapeHtml(entry.credit)}</td>
      <td>${fmtMoney(entry.amount, true)}</td>
      <td>
        <span class="pill ${entry.reviewStatus === "pronto" ? "pill-active" : "pill-warning"}">${escapeHtml(entry.reviewStatus)}</span>
        ${entry.origin === "manual" ? `<span class="pill ${operationStatusClass(entry.operationStatus || "rascunho")} op-pill">${escapeHtml(entry.operationStatus || "rascunho")}</span>` : ""}
      </td>
      <td>${escapeHtml(entry.description)}</td>
    </tr>
  `;
}

function selectedLedgerForExport() {
  const selected = state.filteredLedger.filter((entry) => state.selectedLedgerIds.has(entry.id));
  return selected.length ? selected : state.filteredLedger;
}

function selectedManualEntries() {
  const selectedIds = new Set(state.filteredLedger
    .filter((entry) => state.selectedLedgerIds.has(entry.id))
    .map((entry) => entry.id));
  return state.manualEntries.filter((entry) => selectedIds.has(entry.id));
}

function operationStatusClass(status) {
  if (status === "exportado") return "pill-active";
  if (status === "aprovado") return "pill-approved";
  if (status === "revisar") return "pill-warning";
  return "pill-settled";
}

function postAuditEvent(eventType, refId, payload) {
  if (!window.location.protocol.startsWith("http")) return;
  apiJson("/audit", {
    method: "POST",
    body: JSON.stringify({ eventType, refId, ...payload }),
  }).catch(() => {});
}

function updateSelectedManualStatus(status) {
  const selected = selectedManualEntries();
  if (!selected.length) {
    els.status.textContent = "Selecione lancamentos HTML para alterar o status operacional.";
    return;
  }
  const timestamp = new Date().toISOString();
  const ids = new Set(selected.map((entry) => entry.id));
  state.manualEntries = state.manualEntries.map((entry) => {
    if (!ids.has(entry.id)) return entry;
    const history = Array.isArray(entry.statusHistory) ? entry.statusHistory : [];
    return {
      ...entry,
      operationStatus: status,
      approvedAt: status === "aprovado" ? timestamp : entry.approvedAt || "",
      reopenedAt: status === "revisar" ? timestamp : entry.reopenedAt || "",
      statusHistory: [
        ...history,
        { status, at: timestamp },
      ],
    };
  });
  postAuditEvent("ledger_status", status, {
    entryIds: [...ids],
    count: ids.size,
    changedAt: timestamp,
  });
  saveManualEntries();
  populateLedgerControls();
  applyFilters();
  els.status.textContent = `${ids.size} lancamento(s) HTML alterado(s) para ${status}.`;
}

function registerExportBatch(exportBatchId, entries) {
  if (!window.location.protocol.startsWith("http")) return;
  const payload = {
    id: exportBatchId,
    exportedAt: new Date().toISOString(),
    entryIds: entries.filter((entry) => entry.origin === "manual").map((entry) => entry.id),
    totalEntries: entries.length,
    totalAmount: sum(entries, (entry) => entry.amount),
    filters: {
      year: els.ledgerYearFilter.value,
      contract: els.ledgerContractFilter.value,
      rule: els.ledgerRuleFilter.value,
      status: els.ledgerReadyFilter.value,
    },
  };
  apiJson("/export-batches", {
    method: "POST",
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function exportLedgerCsv() {
  const entries = selectedLedgerForExport();
  const blocked = entries.filter((entry) => entry.origin === "manual" && entry.operationStatus !== "aprovado" && entry.operationStatus !== "exportado");
  if (blocked.length) {
    els.status.textContent = `${blocked.length} lancamento(s) HTML precisam ser aprovados antes da exportacao.`;
    return;
  }
  const exportBatchId = `exp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const header = [
    "Parcelamento",
    "Data",
    "Cod. Conta Debito",
    "Cod. Conta Credito",
    "Valor",
    "Cod. Historico",
    "Complemento Historico",
    "Inicia Lote",
    "Codigo Matriz/Filial",
    "Centro de Custo Debito",
    "Centro de Custo Credito",
  ];
  const lines = [
    header.join(";"),
    ...entries.map((entry) => [
      entry.contractId,
      fmtDateBr(entry.date),
      entry.debit,
      entry.credit,
      fmtValueBr(entry.amount),
      "",
      removeAccents(entry.description),
      "",
      "",
      "",
      "",
    ].map((field) => String(field).replaceAll(";", ",")).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const year = els.ledgerYearFilter.value === "all" ? "todos" : els.ledgerYearFilter.value;
  link.href = url;
  link.download = `cpl-translog-lancamentos-${year}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  registerExportBatch(exportBatchId, entries);

  const exportedManualIds = new Set(entries
    .filter((entry) => entry.origin === "manual")
    .map((entry) => entry.id));
  if (exportedManualIds.size) {
    const exportedAt = new Date().toISOString();
    state.manualEntries = state.manualEntries.map((entry) => (
      exportedManualIds.has(entry.id)
        ? { ...entry, operationStatus: "exportado", exportedAt, exportBatchId }
        : entry
    ));
    saveManualEntries();
    populatePanelControls();
    populateLedgerControls();
    applyFilters();
  }
}

function addDraftTransactionToLedger() {
  if (!state.transactionDraftEntries.length) {
    state.transactionDraftEntries = simulateTransaction();
  }
  if (!state.transactionDraftEntries.length) {
    renderTransactionPanel();
    return;
  }
  const operationId = `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const entries = state.transactionDraftEntries.map((entry) => ({
    ...entry,
    id: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    operationId,
    operationStatus: "rascunho",
    createdAt: new Date().toISOString(),
  }));
  entries.forEach((entry) => state.selectedLedgerIds.add(entry.id));
  state.manualEntries.push(...entries);
  saveManualEntries();
  state.transactionDraftEntries = [];
  state.selectedInstallmentKeys.clear();
  els.ledgerReadyFilter.value = "all";
  populatePanelControls();
  populateLedgerControls();
  applyFilters();
}

function exportManualLayer() {
  const payload = buildSystemStatePayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cpl-translog-estado-sistema.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildSystemStatePayload() {
  const contracts = adjustedContracts();
  const entries = state.manualEntries;
  const operationalModel = buildOperationalModel();
  return {
    schema: SYSTEM_STATE_SCHEMA,
    version: 2,
    exportedAt: new Date().toISOString(),
    source: {
      generatedAt: state.data?.metadata?.generatedAt || "",
      sourceFile: state.data?.metadata?.sourceFile || "",
      contracts: state.data?.contracts?.length || 0,
    },
    counts: {
      entries: entries.length,
      ready: entries.filter((entry) => entry.reviewStatus === "pronto").length,
      review: entries.filter((entry) => entry.reviewStatus !== "pronto").length,
      operations: new Set(entries.map((entry) => entry.operationId).filter(Boolean)).size,
      contractOverrides: Object.keys(state.contractOverrides).length,
    },
    entries,
    contractOverrides: state.contractOverrides,
    contractBalances: contracts.map((contract) => ({
      id: contract.id,
      contractNumber: contract.contractNumber,
      status: contract.status,
      finalDebt: contract.balances.finalDebt,
      currentFinal: contract.balances.currentFinal,
      nonCurrentFinal: contract.balances.nonCurrentFinal,
      interestTotal: contract.balances.interestTotal,
      interestCurrent: contract.balances.interestCurrent,
      interestNonCurrent: contract.balances.interestNonCurrent,
    })),
    auditTrail: entries.map((entry) => ({
      id: entry.id,
      operationId: entry.operationId || "",
      createdAt: entry.createdAt || "",
      date: entry.date,
      contractId: entry.contractId,
      contractNumber: entry.contractNumber,
      rule: entry.rule,
      debit: entry.debit,
      credit: entry.credit,
      amount: entry.amount,
      reviewStatus: entry.reviewStatus,
      description: entry.description,
    })),
    operationalControl: {
      summary: operationalModel.summary,
      findings: operationalModel.findings.slice(0, 200),
      reconciliation: operationalModel.accountRows.slice(0, 100),
    },
  };
}

function clearManualLayer() {
  state.manualEntries = [];
  state.contractOverrides = {};
  state.selectedLedgerIds.clear();
  saveManualEntries();
  populatePanelControls();
  populateLedgerControls();
  applyFilters();
}

function importSystemState(payload, options = {}) {
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  state.manualEntries = entries.map((entry) => ({
    ...entry,
    origin: entry.origin || "manual",
    operationStatus: entry.operationStatus === "pronto"
      ? "rascunho"
      : entry.operationStatus || "rascunho",
  }));
  state.contractOverrides = payload?.contractOverrides && typeof payload.contractOverrides === "object"
    ? payload.contractOverrides
    : {};
  state.selectedLedgerIds.clear();
  state.selectedInstallmentKeys.clear();
  state.transactionDraftEntries = [];
  state.batchImportRows = [];
  saveManualEntries({ sync: options.sync !== false });
  if (!state.data?.contracts?.length) {
    state.pendingSystemState = payload;
    els.status.textContent = `Estado importado com ${state.manualEntries.length} transacoes HTML. Carregue data/processed/dashboard.json para aplicar aos contratos.`;
    return;
  }
  populatePanelControls();
  populateLedgerControls();
  applyFilters();
  renderTransactionPanel();
  els.status.textContent = `${els.status.textContent} | estado ${options.source === "server" ? "SQLite" : "importado"}: ${state.manualEntries.length} transacoes HTML`;
}

async function handleSystemStateImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  if (looksLikeApplicationScript(text, file.name)) {
    els.status.textContent = importErrorMessage(file.name, null);
    event.target.value = "";
    return;
  }
  try {
    const payload = parseJsonLike(text);
    if (!isSystemStatePayload(payload)) {
      els.status.textContent = importErrorMessage(file.name, payload);
      return;
    }
    importSystemState(payload);
  } catch (error) {
    els.status.textContent = `Nao foi possivel importar o estado: ${error.message}`;
  }
  event.target.value = "";
}

function selectableInstallments(contract) {
  const action = els.transactionActionSelect.value;
  return contractInstallments(contract).filter((item) => (
    action === "paid_installment_adjustment"
      ? item.status === "paga"
      : item.status === "pendente" || item.status === "selecionada"
  ));
}

function selectNextInstallment() {
  const contract = selectedTransactionContract();
  const next = selectableInstallments(contract).find((item) => !state.selectedInstallmentKeys.has(item.key));
  if (next) {
    state.selectedInstallmentKeys.add(next.key);
  }
  state.transactionDraftEntries = simulateTransaction();
  renderTransactionPanel();
  renderDetail();
}

function selectAllPendingInstallments() {
  const contract = selectedTransactionContract();
  selectableInstallments(contract).forEach((item) => state.selectedInstallmentKeys.add(item.key));
  state.transactionDraftEntries = simulateTransaction();
  renderTransactionPanel();
  renderDetail();
}

function clearInstallmentSelection() {
  state.selectedInstallmentKeys.clear();
  state.transactionDraftEntries = simulateTransaction();
  renderTransactionPanel();
  renderDetail();
}

function downloadTextFile(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob(["\uFEFF" + content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadBatchTemplate() {
  const rows = [
    ["tipo", "contrato_id", "data", "parcelas", "valor", "debito", "credito", "quitou", "alvo", "direcao", "observacao"],
    ["pagamento", "2", "2026-06-20", "48", "", "", "", "N", "current", "", "Pagamento de parcela"],
    ["pagamento", "108", "2026-07-10", "45,46,47", "", "", "", "N", "current", "", "Pagamento de varias parcelas"],
    ["quitacao", "136", "2026-06-30", "41-45", "", "", "", "S", "current", "", "Quitacao por parcelas"],
    ["ajuste_juros", "157", "2026-06-30", "", "1500,00", "", "", "N", "both", "increase", "Ajuste de juros"],
    ["ajuste_passivo", "157", "2026-06-30", "", "1000,00", "", "", "N", "current", "decrease", "Ajuste do passivo"],
    ["transf_passivo_nc_c", "157", "2026-06-30", "", "1000,00", "", "", "N", "", "", "Transferencia de passivo NC/C"],
    ["transf_juros_nc_c", "157", "2026-06-30", "", "1000,00", "", "", "N", "", "", "Transferencia de juros NC/C"],
    ["estorno_juros_dre", "157", "2026-06-30", "", "1000,00", "", "", "N", "both", "", "Estorno de juros DRE"],
    ["complemento_juros_dre", "157", "2026-06-30", "", "1000,00", "", "", "N", "both", "", "Complemento de juros DRE"],
    ["manual", "2", "2026-06-20", "", "95316,10", "7543", "000", "N", "", "", "Lancamento manual"],
  ];
  downloadTextFile("cpl-translog-modelo-importacao-lote.csv", rows.map((row) => row.join(";")).join("\r\n"), "text/csv;charset=utf-8");
}

async function handleBatchCsvImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  state.batchImportRows = parseCsvObjects(text).map(buildBatchEntries);
  renderBatchImport();
}

function addBatchEntriesToLedger() {
  const operationId = `csv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const entries = state.batchImportRows
    .filter((row) => row.status !== "erro")
    .flatMap((row) => row.entries)
    .map((entry) => ({
      ...entry,
      id: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      operationId,
      operationStatus: "rascunho",
      createdAt: new Date().toISOString(),
    }));
  if (!entries.length) {
    renderBatchImport();
    return;
  }
  entries.forEach((entry) => state.selectedLedgerIds.add(entry.id));
  state.manualEntries.push(...entries);
  state.batchImportRows = [];
  if (els.batchCsvInput) els.batchCsvInput.value = "";
  saveManualEntries();
  els.ledgerReadyFilter.value = "all";
  populatePanelControls();
  populateLedgerControls();
  applyFilters();
}

function clearBatchImport() {
  state.batchImportRows = [];
  if (els.batchCsvInput) els.batchCsvInput.value = "";
  renderBatchImport();
}

function switchTab(tabName) {
  els.tabs.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabName));
  els.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === `${tabName}Tab`));
}

els.fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  if (looksLikeApplicationScript(text, file.name)) {
    els.status.textContent = importErrorMessage(file.name, null);
    event.target.value = "";
    return;
  }
  try {
    const payload = parseJsonLike(text);
    if (isSystemStatePayload(payload)) {
      importSystemState(payload);
    } else if (isDashboardPayload(payload)) {
      setData(payload, file.name);
    } else {
      els.status.textContent = importErrorMessage(file.name, payload);
    }
  } catch (error) {
    els.status.textContent = `Nao foi possivel carregar o arquivo: ${error.message}`;
  }
  event.target.value = "";
});

els.tabs.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

els.search.addEventListener("input", applyFilters);
els.statusFilter.addEventListener("change", applyFilters);
els.entityFilter.addEventListener("change", applyFilters);

[
  els.panelYearFilter,
  els.panelContractFilter,
].forEach((control) => {
  control.addEventListener("change", renderPanelCharts);
});

[
  els.ledgerYearFilter,
  els.ledgerDateFrom,
  els.ledgerDateTo,
  els.ledgerContractFilter,
  els.ledgerRuleFilter,
  els.ledgerReadyFilter,
  els.ledgerFlowFilter,
  els.ledgerSearch,
].forEach((control) => {
  control.addEventListener("input", () => {
    applyLedgerFilters();
    render();
  });
  control.addEventListener("change", () => {
    applyLedgerFilters();
    render();
  });
});

els.selectLedgerButton.addEventListener("click", () => {
  state.filteredLedger.forEach((entry) => state.selectedLedgerIds.add(entry.id));
  renderLedgerPanel();
});

els.clearLedgerButton.addEventListener("click", () => {
  state.selectedLedgerIds.clear();
  renderLedgerPanel();
});

els.approveLedgerButton.addEventListener("click", () => updateSelectedManualStatus("aprovado"));
els.reopenLedgerButton.addEventListener("click", () => updateSelectedManualStatus("revisar"));

els.toggleVisibleLedger.addEventListener("change", () => {
  const rows = state.filteredLedger.slice(0, 700);
  rows.forEach((entry) => {
    if (els.toggleVisibleLedger.checked) {
      state.selectedLedgerIds.add(entry.id);
    } else {
      state.selectedLedgerIds.delete(entry.id);
    }
  });
  renderLedgerPanel();
});

els.exportLedgerButton.addEventListener("click", exportLedgerCsv);
els.saveContractOverrideButton.addEventListener("click", saveContractOverride);
els.clearContractOverrideButton.addEventListener("click", clearContractOverride);

[
  els.transactionContractSelect,
  els.transactionActionSelect,
  els.transactionSettledSelect,
  els.transactionScopeSelect,
  els.transactionDirectionSelect,
].forEach((control) => {
  control.addEventListener("change", () => {
    if (control === els.transactionContractSelect) {
      state.selectedId = Number(control.value);
      state.selectedInstallmentKeys.clear();
      renderContractsTable();
      renderDetail();
      renderContractEditor();
      renderAudit();
    } else if (control === els.transactionActionSelect) {
      state.selectedInstallmentKeys.clear();
    }
    state.transactionDraftEntries = simulateTransaction();
    renderTransactionPanel();
  });
});

[
  els.transactionDateInput,
  els.transactionAmountInput,
  els.transactionInstallmentsInput,
  els.transactionDebitInput,
  els.transactionCreditInput,
  els.transactionNoteInput,
].forEach((control) => {
  control.addEventListener("input", () => {
    state.transactionDraftEntries = simulateTransaction();
    renderTransactionPanel();
  });
});

els.simulateTransactionButton.addEventListener("click", () => {
  state.transactionDraftEntries = simulateTransaction();
  renderTransactionPanel();
});

els.addTransactionButton.addEventListener("click", addDraftTransactionToLedger);
els.exportManualLayerButton.addEventListener("click", exportManualLayer);
els.systemStateInput.addEventListener("change", handleSystemStateImport);
els.clearManualLayerButton.addEventListener("click", clearManualLayer);
els.selectNextInstallmentButton.addEventListener("click", selectNextInstallment);
els.selectAllPendingInstallmentsButton.addEventListener("click", selectAllPendingInstallments);
els.clearInstallmentSelectionButton.addEventListener("click", clearInstallmentSelection);
els.downloadBatchTemplateButton.addEventListener("click", downloadBatchTemplate);
els.batchCsvInput.addEventListener("change", handleBatchCsvImport);
els.addBatchEntriesButton.addEventListener("click", addBatchEntriesToLedger);
els.clearBatchImportButton.addEventListener("click", clearBatchImport);

loadDefaultData();
