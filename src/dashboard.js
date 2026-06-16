const state = {
  data: null,
  filteredContracts: [],
  filteredLedger: [],
  selectedId: null,
  selectedLedgerIds: new Set(),
};

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
  els.status.textContent = `${sourceLabel} | ${data.totals.contracts} contratos | gerado em ${data.metadata.generatedAt}`;
  populateLedgerControls();
  applyFilters();
  renderRules();
}

function populateLedgerControls() {
  const years = [...new Set(state.data.ledgerEntries.map((entry) => entry.year))].sort();
  els.ledgerYearFilter.innerHTML = `<option value="all">Todos os anos</option>`
    + years.map((year) => `<option value="${year}">${year}</option>`).join("");
  if (years.includes(2025)) {
    els.ledgerYearFilter.value = "2025";
  }

  const contracts = [...state.data.contracts].sort((a, b) => a.id - b.id);
  els.ledgerContractFilter.innerHTML = `<option value="all">Todos os contratos</option>`
    + contracts.map((contract) => (
      `<option value="${contract.id}">${contract.id} - ${escapeHtml(contract.contractNumber)}</option>`
    )).join("");

  const rules = [...new Set(state.data.ledgerEntries.map((entry) => entry.rule))].sort();
  els.ledgerRuleFilter.innerHTML = `<option value="all">Todas as regras</option>`
    + rules.map((rule) => `<option value="${rule}">${rule}</option>`).join("");
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

  state.filteredLedger = state.data.ledgerEntries
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
}

function render() {
  renderKpis();
  renderPanelCharts();
  renderContractsTable();
  renderDetail();
  renderAudit();
  renderLedgerPanel();
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
  const ledgerCount = state.data.ledgerEntries.filter((entry) => entry.contractId === contract.id).length;
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

  els.ledgerTable.innerHTML = rows.map((entry) => `
    <tr>
      <td><input class="ledger-check" type="checkbox" data-id="${escapeHtml(entry.id)}" ${state.selectedLedgerIds.has(entry.id) ? "checked" : ""}></td>
      <td>${fmtDateBr(entry.date)}</td>
      <td>${entry.contractId} - ${escapeHtml(entry.contractNumber)}</td>
      <td>${escapeHtml(entry.rule)} <span class="source-column">${escapeHtml(entry.sourceColumn)}</span></td>
      <td>${escapeHtml(entry.debit)}</td>
      <td>${escapeHtml(entry.credit)}</td>
      <td>${fmtMoney(entry.amount, true)}</td>
      <td><span class="pill ${entry.reviewStatus === "pronto" ? "pill-active" : "pill-warning"}">${escapeHtml(entry.reviewStatus)}</span></td>
      <td>${escapeHtml(entry.description)}</td>
    </tr>
  `).join("");

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

loadDefaultData();
