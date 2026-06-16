# CPL TRANSLOG HTML

Dashboard HTML para acompanhamento dos contratos financeiros da TRANSLOG/SAGA/TLOG, com foco em:

- contratos ativos e quitados;
- financiamentos, leasing e parcelamentos;
- saldos circulante e nao circulante;
- juros do ano;
- movimentos que alimentam lancamentos contabeis;
- auditoria de regras e alertas de atualizacao.

## Como atualizar os dados

1. Coloque a planilha `.xlsb` em `data/raw/`.
2. Instale as dependencias:

```powershell
python -m pip install -r requirements.txt
```

3. Gere o JSON do dashboard:

```powershell
python scripts/extract_dashboard_data.py "data/raw/CPL SAGA - Financiamentos 2024—2026 (shared) 3.xlsb"
```

4. Abra `index.html` no navegador.

Os arquivos em `data/raw/` e `data/processed/` ficam fora do Git por conterem dados financeiros sensiveis.
