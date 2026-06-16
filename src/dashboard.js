const state = {
  data: null,
  filteredContracts: [],
  filteredLedger: [],
  selectedId: null,
  selectedLedgerIds: new Set(),
  manualEntries: [],
  transactionDraftEntries: [],
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
  transactionSimulationTable: document.querySelector("#transactionSimulationTable tbody"),
  transactionSimulationCount: document.querySelector("#transactionSimulationCount"),
  manualTransactionsTable: document.querySelector("#manualTransactionsTable tbody"),
  exportManualLayerButton: document.querySelector("#exportManualLayerButton"),
  clearManualLayerButton: document.querySelector("#clearManualLayerButton"),
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

function fmtValueBr(value) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function removeAccents(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
  return state.data?.contracts.find((contract) => contract.id === id) || null;
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

  state.filteredContracts = state.data.contracts
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
  renderMonthlyChart();
  renderDebtSplit();
  renderTopContractsChart();
  renderTypeChart();
}

function renderMonthlyChart() {
  const series = state.data.monthlySeries || [];
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
      renderContractsTable();
      renderDetail();
      renderAudit();
    });
  });
}

function selectedContract() {
  return state.data.contracts.find((contract) => contract.id === state.selectedId);
}

function selectedDetail() {
  return state.data.contractDetails.find((detail) => detail.sheetId === state.selectedId && !detail.replacedSheet)
    || state.data.contractDetails.find((detail) => detail.sheetId === state.selectedId);
}

function renderDetail() {
  const contract = selectedContract();
  if (!contract) {
    els.detail.innerHTML = `<div class="empty-state">Nenhum contrato na selecao atual.</div>`;
    return;
  }
  const detail = selectedDetail();
  const movementCount = detail?.movements?.length || 0;
  const ledgerCount = allLedgerEntries().filter((entry) => entry.contractId === contract.id).length;
  const flags = contract.flags.length
    ? contract.flags.map((flag) => `<span class="pill pill-warning">${escapeHtml(flag)}</span>`).join(" ")
    : "-";

  els.detail.innerHTML = `
    <div class="detail-list">
      <div class="detail-row"><span class="detail-label">Contrato</span><span class="detail-value">${escapeHtml(contract.contractNumber)}</span></div>
      <div class="detail-row"><span class="detail-label">Empresa / tipo</span><span class="detail-value">${escapeHtml(contract.entity)} / ${escapeHtml(contract.type || "-")}</span></div>
      <div class="detail-row"><span class="detail-label">Contas</span><span class="detail-value">C ${escapeHtml(contract.accounts.circ || "-")} | NC ${escapeHtml(contract.accounts.naoCirc || "-")} | Red. C ${escapeHtml(contract.accounts.jurosCirc || "-")} | Red. NC ${escapeHtml(contract.accounts.jurosNaoCirc || "-")}</span></div>
      <div class="detail-row"><span class="detail-label">Divida final</span><span class="detail-value">${fmtMoney(contract.balances.finalDebt, true)}</span></div>
      <div class="detail-row"><span class="detail-label">Juros totais</span><span class="detail-value">${fmtMoney(contract.balances.interestTotal, true)}</span></div>
      <div class="detail-row"><span class="detail-label">Movimentos / lancamentos</span><span class="detail-value">${movementCount} / ${ledgerCount}</span></div>
      <div class="detail-row"><span class="detail-label">Marcadores</span><span class="detail-value">${flags}</span></div>
      <div class="detail-row"><span class="detail-label">Comentarios</span><span class="detail-value">${escapeHtml(contract.comments || "-")}</span></div>
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

function makeManualEntry({ contract, date, debit, credit, amount, rule, description, issues = [] }) {
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
    parcel: "",
    date,
    year: Number(date.slice(0, 4)),
    month: date.slice(0, 7),
    debit,
    credit,
    amount,
    historyCode: "",
    description,
    rule,
    sourceColumn: "HTML",
    sourceRow: "",
    reviewStatus: issueList.length ? "revisar" : "pronto",
    issues: issueList,
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
    payment: "Registra pagamento ou amortizacao contra a conta do passivo selecionada e a conta 000. Use N parcelas para dividir o valor em vencimentos mensais.",
    interest_adjustment: "Gera ajuste de juros contra a conta de resultado do contrato. Leasing usa 4773; os demais usam 375. A direcao define se aumenta ou reduz o juros/redutora.",
    liability_adjustment: "Gera ajuste no passivo circulante ou nao circulante. Usa a conta ponte AAA e por isso fica marcado como revisar antes da importacao.",
    settlement: "Registra baixa/quitacao do contrato no alvo escolhido. Se o valor ficar vazio, usa o saldo final do alvo quando existir.",
    custom: "Permite informar manualmente debito e credito. Use quando a operacao nao couber nas regras padrao.",
  }[action] || "";
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
  els.transactionExplanation.innerHTML = `<p>${escapeHtml(actionExplanation(action))}</p>`;

  if (contract) {
    els.transactionContractSnapshot.innerHTML = `
      <div><span>Contrato</span><strong>${escapeHtml(contract.contractNumber)}</strong></div>
      <div><span>Status</span><strong>${escapeHtml(contract.status)}</strong></div>
      <div><span>Tipo</span><strong>${escapeHtml(contract.type || "-")}</strong></div>
      <div><span>Resultado</span><strong>${resultAccountFor(contract)}</strong></div>
      <div><span>Circ.</span><strong>${escapeHtml(contract.accounts.circ || "-")}</strong></div>
      <div><span>N-Circ.</span><strong>${escapeHtml(contract.accounts.naoCirc || "-")}</strong></div>
      <div><span>Red. C</span><strong>${escapeHtml(contract.accounts.jurosCirc || "-")}</strong></div>
      <div><span>Red. NC</span><strong>${escapeHtml(contract.accounts.jurosNaoCirc || "-")}</strong></div>
    `;
  }

  renderTransactionSimulation();
  renderManualTransactions();
}

function renderTransactionSimulation() {
  const rows = state.transactionDraftEntries;
  els.transactionSimulationCount.textContent = `${rows.length} lancamento(s) simulados`;
  els.transactionSimulationTable.innerHTML = rows.map((entry) => ledgerRowCells(entry, false)).join("")
    || `<tr><td colspan="8" class="empty-cell">Preencha os dados e clique em Simular.</td></tr>`;
}

function renderManualTransactions() {
  els.manualTransactionsTable.innerHTML = state.manualEntries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((entry) => ledgerRowCells(entry, false))
    .join("") || `<tr><td colspan="8" class="empty-cell">Nenhuma transacao adicionada nesta camada local.</td></tr>`;
}

function ledgerRowCells(entry, withCheck = true) {
  const checkbox = withCheck
    ? `<td><input class="ledger-check" type="checkbox" data-id="${escapeHtml(entry.id)}" ${state.selectedLedgerIds.has(entry.id) ? "checked" : ""}></td>`
    : "";
  return `
    <tr class="${entry.origin === "manual" ? "manual-row" : ""}">
      ${checkbox}
      <td>${fmtDateBr(entry.date)}</td>
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
  els.ledgerReadyFilter.value = "all";
  populateLedgerControls();
  applyLedgerFilters();
  render();
}

function exportManualLayer() {
  const payload = {
    exportedAt: new Date().toISOString(),
    count: state.manualEntries.length,
    entries: state.manualEntries,
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
  applyLedgerFilters();
  render();
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

loadDefaultData();
