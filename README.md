# CPL TRANSLOG HTML

Dashboard HTML para acompanhamento dos contratos financeiros da TRANSLOG/SAGA/TLOG, com foco em:

- contratos ativos e quitados;
- financiamentos, leasing e parcelamentos;
- saldos circulante e nao circulante;
- juros do ano;
- movimentos que alimentam lancamentos contabeis;
- auditoria de regras e alertas de atualizacao;
- esteira de lancamentos com filtros por ano, periodo, contrato, regra, empresa e situacao;
- exportacao CSV dos lancamentos selecionados ou filtrados;
- simulacao e registro de transacoes no HTML, com acoes de pagamento, ajuste de juros, ajuste de passivo, quitacao e lancamento manual;
- atualizacao visual dos saldos dos contratos a partir dos lancamentos feitos/importados no proprio sistema.

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

## Atencao as formulas do XLSB

O extrator usa a planilha como fonte dos calculos: ele le os valores calculados das formulas do `.xlsb` e transforma esses resultados em JSON/lancamentos. Por isso, antes de gerar o JSON, a planilha deve estar salva/recalculada no Excel.

As colunas de lancamento sao identificadas pelo cabecalho de cada aba. Quando uma aba desloca o layout padrao, como aconteceu na aba `108`, o extrator usa a coluna detectada e registra o alerta na auditoria. Marcadores textuais como `D/C`, `D-Passivo, C-Resultado` e observacoes em `BB/BC` tambem ficam guardados para revisao.

## Fluxo de lancamento no sistema

1. Use a aba `Transacoes` para simular eventos novos sobre um contrato.
2. Para pagamentos, confira as parcelas do contrato, selecione a proxima parcela ou marque varias parcelas pendentes.
3. Confira quantas parcelas ficam pendentes apos a selecao e o total selecionado.
4. Para ajustes sem parcela especifica, escolha acao, data, valor, alvo, direcao e se quitou.
5. Confira a explicacao e a simulacao dos debitos/creditos.
6. Clique em `Adicionar a esteira`.
7. O Painel, a aba Contratos e o detalhe do contrato passam a refletir o saldo ajustado pela camada HTML.
8. Use a aba `Lancamentos` para filtrar, selecionar e exportar o CSV contabil.

## Importacao em lote

Na aba `Transacoes`, use `Baixar modelo CSV` para gerar o arquivo padrao de importacao em lote. Depois preencha e importe o CSV em `Importar CSV`.

Colunas aceitas:

```text
tipo;contrato_id;data;parcelas;valor;debito;credito;quitou;alvo;direcao;observacao
```

Tipos aceitos em `tipo`:

- `pagamento`: paga uma ou mais parcelas, usando `parcelas` como `48`, `45,46,47` ou `41-45`.
- `quitacao`: baixa parcelas selecionadas e marca a linha como quitacao para conferencia.
- `manual`: usa `debito`, `credito` e `valor` informados no CSV.
- `ajuste_juros`: gera ajuste de juros por `valor`, `alvo` e `direcao`.
- `ajuste_passivo`: gera ajuste do passivo por `valor`, `alvo` e `direcao`.

O importador valida contrato, data, parcelas, valores e contas antes de adicionar na esteira. Linhas com erro ficam na previa e nao entram em `Adicionar validos`.

O dashboard gera uma previa com as colunas esperadas pelo arquivo de importacao contabil:

```text
Parcelamento;Data;Cod. Conta Debito;Cod. Conta Credito;Valor;Cod. Historico;Complemento Historico;Inicia Lote;Codigo Matriz/Filial;Centro de Custo Debito;Centro de Custo Credito
```

As transacoes feitas no HTML ficam salvas no navegador como camada local. Elas entram na previa, na exportacao contabil e recalculam os saldos apresentados no Painel/Contratos. Use `Exportar camada JSON` para salvar um backup dessas transacoes manuais e dos saldos atualizados por contrato.

O JSON extraido continua sendo a carga inicial historica. A operacao diaria pode acontecer no HTML por lancamento manual ou importacao CSV; para uma substituicao completa da planilha, a proxima evolucao natural e persistir essa camada em arquivo/base de dados compartilhada e transformar as formulas de juros/amortizacao em um motor financeiro versionado no proprio projeto.
