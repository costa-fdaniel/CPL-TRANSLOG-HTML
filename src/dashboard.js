const state = {
  data: null,
  filteredContracts: [],
  selectedId: null,
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
  kpis: document.querySelector("#kpis"),
  monthlyChart: document.querySelector("#monthlyChart"),
  contractsTable: document.querySelector("#contractsTable tbody"),
  detail: document.querySelector("#contractDetail"),
  audit: document.querySelector("#auditList"),
  rules: document.querySelector("#rulesTable tbody"),
};

function fmtMoney(value, precise = false) {
  return (precise ? preciseCurrency : currency).format(value || 0);
}

function byFinalDebt(a, b) {
  return b.balances.finalDebt - a.balances.finalDebt;
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
  state.data = data;
  state.selectedId = data.contracts?.[0]?.id ?? null;
  els.status.textContent = `${sourceLabel} | ${data.totals.contracts} contratos | gerado em ${data.metadata.generatedAt}`;
  applyFilters();
  renderRules();
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

  render();
}

function renderEmpty() {
  els.kpis.innerHTML = "";
  els.monthlyChart.innerHTML = `<div class="empty-state">Aguardando dados processados.</div>`;
  els.contractsTable.innerHTML = "";
  els.detail.innerHTML = `<div class="empty-state">Selecione ou carregue uma base.</div>`;
  els.audit.innerHTML = "";
  els.rules.innerHTML = "";
}

function render() {
  renderKpis();
  renderMonthlyChart();
  renderContractsTable();
  renderDetail();
  renderAudit();
}

function renderKpis() {
  const totals = state.data.totals;
  const items = [
    ["Contratos", totals.contracts],
    ["Ativos", totals.activeContracts],
    ["Quitados", totals.settledContracts],
    ["Divida final", fmtMoney(totals.finalDebt)],
    ["Juros no ano", fmtMoney(totals.interestTotal)],
    ["Circ. / N-Circ.", `${fmtMoney(totals.currentFinal)} / ${fmtMoney(totals.nonCurrentFinal)}`],
  ];
  els.kpis.innerHTML = items.map(([label, value]) => `
    <section class="kpi">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
    </section>
  `).join("");
}

function renderMonthlyChart() {
  const series = state.data.monthlySeries || [];
  const max = Math.max(...series.map((item) => item.amount), 1);
  els.monthlyChart.innerHTML = series.map((item) => {
    const height = Math.max(2, (item.amount / max) * 180);
    return `
      <div class="bar-wrap" title="${item.label}: ${fmtMoney(item.amount, true)}">
        <div class="bar" style="height:${height}px"></div>
        <div class="bar-label">${item.label.slice(0, 2)}</div>
      </div>
    `;
  }).join("");
}

function renderContractsTable() {
  els.contractsTable.innerHTML = state.filteredContracts.map((contract) => `
    <tr data-id="${contract.id}" data-selected="${contract.id === state.selectedId}">
      <td>${contract.id}</td>
      <td>${contract.contractNumber}</td>
      <td>${contract.entity}</td>
      <td><span class="pill ${contract.status === "ativo" ? "pill-active" : "pill-settled"}">${contract.status}</span></td>
      <td>${contract.type || "-"}</td>
      <td>${fmtMoney(contract.balances.finalDebt)}</td>
      <td>${fmtMoney(contract.balances.interestTotal)}</td>
      <td>${contract.comments || "-"}</td>
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
  const flags = contract.flags.length
    ? contract.flags.map((flag) => `<span class="pill pill-warning">${flag}</span>`).join(" ")
    : "-";

  els.detail.innerHTML = `
    <div class="detail-list">
      <div class="detail-row"><span class="detail-label">Contrato</span><span class="detail-value">${contract.contractNumber}</span></div>
      <div class="detail-row"><span class="detail-label">Empresa / tipo</span><span class="detail-value">${contract.entity} / ${contract.type || "-"}</span></div>
      <div class="detail-row"><span class="detail-label">Contas</span><span class="detail-value">C ${contract.accounts.circ || "-"} | NC ${contract.accounts.naoCirc || "-"} | Red. C ${contract.accounts.jurosCirc || "-"} | Red. NC ${contract.accounts.jurosNaoCirc || "-"}</span></div>
      <div class="detail-row"><span class="detail-label">Divida final</span><span class="detail-value">${fmtMoney(contract.balances.finalDebt, true)}</span></div>
      <div class="detail-row"><span class="detail-label">Juros totais</span><span class="detail-value">${fmtMoney(contract.balances.interestTotal, true)}</span></div>
      <div class="detail-row"><span class="detail-label">Movimentos identificados</span><span class="detail-value">${movementCount}</span></div>
      <div class="detail-row"><span class="detail-label">Marcadores</span><span class="detail-value">${flags}</span></div>
      <div class="detail-row"><span class="detail-label">Comentarios</span><span class="detail-value">${contract.comments || "-"}</span></div>
    </div>
  `;
}

function renderAudit() {
  const selectedOnly = state.data.audit.filter((item) => item.contractId === state.selectedId);
  const items = selectedOnly.length ? selectedOnly : state.data.audit.slice(0, 30);
  els.audit.innerHTML = items.map((item) => `
    <div class="audit-item ${item.severity}">
      <div class="audit-message"><strong>${item.contractId || "-"}</strong> ${item.message}</div>
    </div>
  `).join("") || `<div class="empty-state">Sem alertas para o contrato selecionado.</div>`;
}

function renderRules() {
  els.rules.innerHTML = (state.data.rules || []).map((rule) => `
    <tr>
      <td>${rule.column}</td>
      <td>${rule.name}</td>
    </tr>
  `).join("");
}

els.fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  setData(JSON.parse(text), file.name);
});

els.search.addEventListener("input", applyFilters);
els.statusFilter.addEventListener("change", applyFilters);
els.entityFilter.addEventListener("change", applyFilters);

loadDefaultData();

