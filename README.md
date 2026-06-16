# CPL TRANSLOG HTML

Dashboard HTML para acompanhamento dos contratos financeiros da TRANSLOG/SAGA/TLOG, com foco em:

- contratos ativos e quitados;
- financiamentos, leasing e parcelamentos;
- saldos circulante e nao circulante;
- juros do ano;
- movimentos que alimentam lancamentos contabeis;
- auditoria de regras e alertas de atualizacao.
- esteira de lancamentos com filtros por ano, periodo, contrato, regra, empresa e situacao;
- exportacao CSV dos lancamentos selecionados ou filtrados.

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

Para usar com carregamento automatico do JSON, rode um servidor local na pasta do projeto:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Depois acesse:

```text
http://127.0.0.1:8765
```

Os arquivos em `data/raw/` e `data/processed/` ficam fora do Git por conterem dados financeiros sensiveis.

## Fluxo de lancamento

1. Use a aba `Lancamentos`.
2. Filtre por ano, periodo, contrato, regra ou situacao.
3. Confira os lancamentos `prontos` e os itens `revisar`.
4. Marque os lancamentos desejados ou deixe sem selecao para exportar tudo que esta filtrado.
5. Clique em `Exportar CSV`.

O dashboard gera uma previa com as colunas esperadas pelo arquivo de importacao contabil:

```text
Parcelamento;Data;Cod. Conta Debito;Cod. Conta Credito;Valor;Cod. Historico;Complemento Historico;Inicia Lote;Codigo Matriz/Filial;Centro de Custo Debito;Centro de Custo Credito
```
