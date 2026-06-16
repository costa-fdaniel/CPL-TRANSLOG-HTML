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
};

const MANUAL_STORAGE_KEY = "cpl-translog-html-manual-entries";

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
  panelSummary: document.querySelector("#panelSummary"),
  monthlyChart: document.querySelector("#monthlyChart"),
  debtSplitChart: document.querySelector("#debtSplitChart"),
  topContractsChart: document.querySelector("#topContractsChart"),
  typeChart: document.querySelector("#typeChart"),
  contractsTable: document.querySelector("#contractsTable tbody"),
  detail: document.querySelector("#contractDetail"),
  audit: document.querySelector("#auditList"),
  rules: document.querySelector("#rulesTable tbody"),
  ledgerKpis: document.querySelector("#ledgerKpis"),
  ledgerYearFilter: document.querySelector("#ledgerYearFilter"),
  ledgerDateFrom: document.querySelector("#ledgerDateFrom"),
  ledgerDateTo: document.querySelector("#ledgerDateTo"),
  ledgerContractFilter: document.querySelector("#ledgerContractFilter"),
  ledgerRuleFilter: document.querySelector("#ledgerRuleFilter"),
  ledgerReadyFilter: document.querySelector("#ledgerReadyFilter"),
  ledgerSearch: document.querySelector("#ledgerSearchInput"),
  selectLedgerButton: document.querySelector("#selectLedgerButton"),
  clearLedgerButton: document.querySelector("#clearLedgerButton"),
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

function fmtValueBr(value) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function removeAccents(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(value) {
  return removeAccents(value).trim().toLowerCase();
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
        impact.currentPrincipal -= amount;
      } else if (entry.installmentComponent === "juros") {
        impact.currentInterest -= amount;
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
  const impact = manualImpactFor(contract);
  const currentFinal = Math.max(0, (contract.balances.currentFinal || 0) + impact.currentPrincipal);
  const nonCurrentFinal = Math.max(0, (contract.balances.nonCurrentFinal || 0) + impact.nonCurrentPrincipal);
  const interestCurrent = Math.max(0, (contract.balances.interestCurrent || 0) + impact.currentInterest);
  const interestNonCurrent = Math.max(0, (contract.balances.interestNonCurrent || 0) + impact.nonCurrentInterest);
  return {
    ...contract,
    status: contract.status === "quitado" || (currentFinal + nonCurrentFinal <= 0.005 && contractInstallments(contract).every((item) => item.status !== "pendente"))
      ? "quitado"
      : contract.status,
    balances: {
      ...contract.balances,
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

function saveManualEntries() {
  localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(state.manualEntries));
}

function loadManualEntries() {
  try {
    const stored = JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEY) || "[]");
    state.manualEntries = Array.isArray(stored) ? stored : [];
  } catch {
    state.manualEntries = [];
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

function selectedPaymentInstallments(contract) {
  return contractInstallments(contract).filter((item) => item.status === "selecionada");
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
  loadManualEntries();
  els.status.textContent = `${sourceLabel} | ${data.totals.contracts} contratos | gerado em ${data.metadata.generatedAt}`;
  populateLedgerControls();
  populateTransactionControls();
  applyFilters();
  renderRules();
  renderTransactionPanel();
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
  const contracts = [...state.data.contracts].sort((a, b) => a.id - b.id);
  els.transactionContractSelect.innerHTML = contracts.map((contract) => (
    `<option value="${contract.id}">${contract.id} - ${escapeHtml(contract.contractNumber)} (${escapeHtml(contract.entity)})</option>`
  )).join("");
  if (state.selectedId && contracts.some((contract) => contract.id === state.selectedId)) {
    els.transactionContractSelect.value = String(state.selectedId);
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
    syncTransactionContractToSelected();
    state.transactionDraftEntries = simulateTransaction();
  }

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
  els.contractsTable.innerHTML = "";
  els.detail.innerHTML = `<div class="empty-state">Selecione ou carregue uma base.</div>`;
  els.audit.innerHTML = "";
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
}

function renderPanelSummary() {
  const contracts = state.filteredContracts;
  const entries = state.manualEntries;
  const finalDebt = sum(contracts, (contract) => contract.balances.finalDebt);
  const originalDebt = sum(
    state.data.contracts.filter((contract) => contracts.some((item) => item.id === contract.id)),
    (contract) => contract.balances.finalDebt,
  );
  const principalImpact = finalDebt - originalDebt;
  const pendingInstallments = sum(contracts, (contract) => contractInstallmentStats(contract).pendingAfterSelection);
  const reviewCount = entries.filter((entry) => entry.reviewStatus === "revisar").length;
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
      <span>Lancamentos HTML</span>
      <strong>${entries.length}</strong>
    </div>
    <div class="summary-tile">
      <span>A revisar</span>
      <strong>${reviewCount}</strong>
    </div>
  `;
}

function renderMonthlyChart() {
  const series = entriesFromGroup(groupSum(
    allLedgerEntries(),
    (entry) => entry.month,
    (entry) => entry.amount,
  ))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((item) => ({ label: item.label, amount: item.value }));
  const max = Math.max(...series.map((item) => item.amount), 1);
  els.monthlyChart.innerHTML = series.map((item) => {
    const height = Math.max(2, (item.amount / max) * 180);
    return `
      <div class="bar-wrap" title="${escapeHtml(item.label)}: ${fmtMoney(item.amount, true)}">
        <div class="bar" style="height:${height}px"></div>
        <div class="bar-label">${escapeHtml(item.label.slice(0, 2))}</div>
      </div>
    `;
  }).join("");
}

function renderDebtSplit() {
  const contracts = state.filteredContracts;
  const current = sum(contracts, (contract) => Math.max(0, contract.balances.currentFinal));
  const nonCurrent = sum(contracts, (contract) => Math.max(0, contract.balances.nonCurrentFinal));
  const total = Math.max(current + nonCurrent, 1);
  const currentPct = (current / total) * 100;
  const nonCurrentPct = (nonCurrent / total) * 100;

  els.debtSplitChart.innerHTML = `
    <div class="split-track">
      <div class="split-segment current" style="width:${currentPct}%"></div>
      <div class="split-segment non-current" style="width:${nonCurrentPct}%"></div>
    </div>
    <div class="split-legend">
      <div><span class="dot current"></span> Circulante <strong>${fmtMoney(current, true)}</strong></div>
      <div><span class="dot non-current"></span> Nao circulante <strong>${fmtMoney(nonCurrent, true)}</strong></div>
    </div>
  `;
}

function renderTopContractsChart() {
  const items = state.filteredContracts
    .filter((contract) => contract.balances.finalDebt > 0)
    .slice(0, 10)
    .map((contract) => ({
      label: `${contract.id} - ${contract.contractNumber}`,
      value: contract.balances.finalDebt,
    }));
  renderRankChart(els.topContractsChart, items);
}

function renderTypeChart() {
  const items = entriesFromGroup(groupSum(
    state.filteredContracts,
    (contract) => contract.type || "Sem tipo",
    (contract) => contract.balances.finalDebt,
  )).slice(0, 10);
  renderRankChart(els.typeChart, items);
}

function renderRankChart(container, items) {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">Sem dados no filtro atual.</div>`;
    return;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  container.innerHTML = items.map((item) => `
    <div class="rank-row">
      <div class="rank-label">${escapeHtml(item.label)}</div>
      <div class="rank-track">
        <div class="rank-bar" style="width:${Math.max(2, (item.value / max) * 100)}%"></div>
      </div>
      <div class="rank-value">${fmtMoney(item.value)}</div>
    </div>
  `).join("");
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

function renderAudit() {
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
  const selectedAmount = sum(selectedEntries, (entry) => entry.amount);
  const items = [
    ["Lancamentos", entries.length],
    ["Prontos", ready],
    ["A revisar", review],
    ["Total filtrado", fmtMoney(sum(entries, (entry) => entry.amount))],
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
  const byMonth = Object.entries(groupSum(
    state.filteredLedger,
    (entry) => entry.month,
    (entry) => entry.amount,
  ))
    .map(([date, amount]) => ({ date, label: date.slice(5), amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const maxMonth = Math.max(...byMonth.map((item) => item.amount), 1);
  els.ledgerMonthChart.innerHTML = byMonth.map((item) => {
    const height = Math.max(2, (item.amount / maxMonth) * 150);
    return `
      <div class="bar-wrap narrow" title="${escapeHtml(item.date)}: ${fmtMoney(item.amount, true)}">
        <div class="bar ledger" style="height:${height}px"></div>
        <div class="bar-label">${escapeHtml(item.label)}</div>
      </div>
    `;
  }).join("") || `<div class="empty-state">Sem lancamentos no filtro.</div>`;

  const byRule = entriesFromGroup(groupSum(
    state.filteredLedger,
    (entry) => entry.rule,
    (entry) => entry.amount,
  ));
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
  const weights = action === "interest_adjustment" ? interestWeights : principalWeights;
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
    settlement: `Quitacao ${target.label}`,
    custom: "Lancamento manual",
  }[action];
  return `${base} ref. contrato ${contract.contractNumber} aba (${contract.id})${noteText}`;
}

function actionExplanation(action) {
  return {
    payment: "Registra pagamento ou amortizacao contra a conta do passivo e a conta 000. Se houver parcelas selecionadas, usa exatamente essas parcelas; sem selecao, usa o valor livre do formulario.",
    interest_adjustment: "Gera ajuste de juros contra a conta de resultado do contrato. Leasing usa 4773; os demais usam 375. A direcao define se aumenta ou reduz o juros/redutora.",
    liability_adjustment: "Gera ajuste no passivo circulante ou nao circulante. Usa a conta ponte AAA e por isso fica marcado como revisar antes da importacao.",
    settlement: "Registra baixa/quitacao do contrato no alvo escolhido. Se houver parcelas selecionadas, baixa essas parcelas; se o valor ficar vazio, usa o saldo final do alvo quando existir.",
    custom: "Permite informar manualmente debito e credito. Use quando a operacao nao couber nas regras padrao.",
  }[action] || "";
}

function toggleTransactionFields() {
  const action = els.transactionActionSelect.value;
  const visible = {
    amount: true,
    installments: ["payment", "settlement"].includes(action),
    scope: ["payment", "settlement", "interest_adjustment", "liability_adjustment"].includes(action),
    direction: ["interest_adjustment", "liability_adjustment"].includes(action),
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
    : scopeTargets(contract, scope, action);
  const selectedInstallments = selectedPaymentInstallments(contract);

  if ((action === "payment" || action === "settlement") && selectedInstallments.length) {
    return simulateSelectedInstallmentPayments(contract, action, selectedInstallments);
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
  const stats = contractInstallmentStats(contract);
  const rows = stats.installments;
  els.paymentInstallmentSummary.innerHTML = `
    <div class="summary-metric"><span>Total parcelas</span><strong>${stats.total || rows.length}</strong></div>
    <div class="summary-metric"><span>Pagas</span><strong>${stats.paid}</strong></div>
    <div class="summary-metric"><span>Pendentes</span><strong>${stats.pending}</strong></div>
    <div class="summary-metric"><span>Selecionadas</span><strong>${stats.selected}</strong></div>
    <div class="summary-metric"><span>Ficarao pendentes</span><strong>${stats.pendingAfterSelection}</strong></div>
    <div class="summary-metric"><span>Total selecionado</span><strong>${fmtMoney(stats.selectedAmount, true)}</strong></div>
  `;

  els.paymentInstallmentsTable.innerHTML = rows.map((item) => {
    const selectable = item.status === "pendente" || item.status === "selecionada";
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
  return scopeTargets(contract, scope || "current", action)[0] || scopeTargets(contract, "current", action)[0];
}

function makeBatchAdjustmentEntries(contract, row, type, date, amount, note) {
  const scope = normalizeKey(row.alvo || "current").replace("circulante", "current").replace("nao current", "non_current").replace("nao_circulante", "non_current");
  const normalizedScope = ["current", "non_current", "both"].includes(scope) ? scope : "current";
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

function buildBatchEntries(row) {
  const data = row.raw;
  const type = normalizeKey(data.tipo || data.acao);
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
      <td><span class="pill ${entry.reviewStatus === "pronto" ? "pill-active" : "pill-warning"}">${escapeHtml(entry.reviewStatus)}</span></td>
      <td>${escapeHtml(entry.description)}</td>
    </tr>
  `;
}

function selectedLedgerForExport() {
  const selected = state.filteredLedger.filter((entry) => state.selectedLedgerIds.has(entry.id));
  return selected.length ? selected : state.filteredLedger;
}

function exportLedgerCsv() {
  const entries = selectedLedgerForExport();
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
}

function addDraftTransactionToLedger() {
  if (!state.transactionDraftEntries.length) {
    state.transactionDraftEntries = simulateTransaction();
  }
  if (!state.transactionDraftEntries.length) {
    renderTransactionPanel();
    return;
  }
  const entries = state.transactionDraftEntries.map((entry) => ({
    ...entry,
    id: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  }));
  entries.forEach((entry) => state.selectedLedgerIds.add(entry.id));
  state.manualEntries.push(...entries);
  saveManualEntries();
  state.transactionDraftEntries = [];
  state.selectedInstallmentKeys.clear();
  els.ledgerReadyFilter.value = "all";
  populateLedgerControls();
  applyFilters();
}

function exportManualLayer() {
  const contracts = adjustedContracts();
  const payload = {
    exportedAt: new Date().toISOString(),
    count: state.manualEntries.length,
    entries: state.manualEntries,
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
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cpl-translog-transacoes-html.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clearManualLayer() {
  state.manualEntries = [];
  state.selectedLedgerIds.clear();
  saveManualEntries();
  populateLedgerControls();
  applyFilters();
}

function selectableInstallments(contract) {
  return contractInstallments(contract).filter((item) => item.status === "pendente" || item.status === "selecionada");
}

function selectNextInstallment() {
  const contract = selectedTransactionContract();
  const next = selectableInstallments(contract).find((item) => item.status === "pendente");
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
  const entries = state.batchImportRows
    .filter((row) => row.status !== "erro")
    .flatMap((row) => row.entries)
    .map((entry) => ({
      ...entry,
      id: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
  setData(JSON.parse(text), file.name);
});

els.tabs.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

els.search.addEventListener("input", applyFilters);
els.statusFilter.addEventListener("change", applyFilters);
els.entityFilter.addEventListener("change", applyFilters);

[
  els.ledgerYearFilter,
  els.ledgerDateFrom,
  els.ledgerDateTo,
  els.ledgerContractFilter,
  els.ledgerRuleFilter,
  els.ledgerReadyFilter,
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
      renderAudit();
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
els.clearManualLayerButton.addEventListener("click", clearManualLayer);
els.selectNextInstallmentButton.addEventListener("click", selectNextInstallment);
els.selectAllPendingInstallmentsButton.addEventListener("click", selectAllPendingInstallments);
els.clearInstallmentSelectionButton.addEventListener("click", clearInstallmentSelection);
els.downloadBatchTemplateButton.addEventListener("click", downloadBatchTemplate);
els.batchCsvInput.addEventListener("change", handleBatchCsvImport);
els.addBatchEntriesButton.addEventListener("click", addBatchEntriesToLedger);
els.clearBatchImportButton.addEventListener("click", clearBatchImport);

loadDefaultData();
