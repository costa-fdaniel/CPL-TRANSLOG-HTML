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
- painel inicial com filtros proprios por ano e contrato, refletindo tambem lancamentos feitos no HTML.
- exportacao e importacao do estado operacional do sistema em JSON, incluindo transacoes HTML, saldos recalculados e trilha resumida.

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

### Modo sistema com SQLite

Para operar com persistencia central local, use o servidor do projeto em vez do `http.server` simples:

```powershell
python scripts/server.py --host 127.0.0.1 --port 8765
```

Esse modo serve o mesmo `index.html`, mas tambem habilita a API local em `/api` e grava o estado operacional em:

```text
data/system/translog.sqlite3
```

O banco guarda:

- estado operacional completo do HTML;
- transacoes manuais/importadas;
- ajustes locais de cadastro de contrato;
- trilha de auditoria;
- lotes de exportacao CSV.

Se o HTML for aberto fora desse servidor, o sistema continua funcionando com `localStorage` e arquivos JSON.

Os arquivos em `data/raw/` e `data/processed/` ficam fora do Git por conterem dados financeiros sensiveis.
O arquivo SQLite em `data/system/` tambem fica fora do Git.

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
8. Use a aba `Lancamentos` para filtrar e selecionar os lancamentos HTML.
9. Clique em `Aprovar` para liberar os lancamentos revisados.
10. Exporte o CSV contabil. Lancamentos HTML ainda em rascunho/revisao nao sao exportados.

Na esteira existem dois conceitos separados:

- `Situacao`: validacao contabil do lancamento (`pronto` ou `revisar`).
- `Fluxo`: etapa operacional (`rascunho`, `aprovado` ou `exportado`).

O botao `Reabrir` volta lancamentos HTML selecionados para revisao operacional. A exportacao marca os lancamentos HTML exportados com lote, data e status `exportado`.

## Auditoria operacional

A aba `Auditoria` tem duas camadas:

- `Diario do sistema`: eventos gravados no SQLite, como salvamentos de estado, aprovacoes/reaberturas de lancamentos e exportacoes CSV.
- `Validador operacional`: alertas calculados a partir dos lancamentos, regras, contas e contratos carregados.

Use o filtro do diario para isolar aprovacoes, exportacoes ou salvamentos. O botao `Atualizar` consulta novamente `/api/audit`, util quando outro processo ou navegador tiver gravado eventos no mesmo banco local.

## Leitura do painel

O `Painel` abre no ano corrente quando esse ano existe na base e permite trocar para qualquer ano ou contrato especifico. Os cartoes, composicao da divida, maiores contratos, carteira por tipo e fluxo mensal usam essa selecao. Quando uma transacao e adicionada ou um CSV em lote e importado, a visao do painel e recalculada junto com a esteira.

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
- `transf_passivo_nc_c`: debita passivo nao circulante e credita passivo circulante.
- `transf_juros_nc_c`: debita juros nao circulante e credita juros circulante.
- `estorno_juros_dre`: debita juros do passivo e credita resultado financeiro, usando `alvo` como `current`, `non_current` ou `both`.
- `complemento_juros_dre`: debita resultado financeiro e credita juros do passivo, usando `alvo` como `current`, `non_current` ou `both`.

O importador valida contrato, data, parcelas, valores e contas antes de adicionar na esteira. Linhas com erro ficam na previa e nao entram em `Adicionar validos`.

O dashboard gera uma previa com as colunas esperadas pelo arquivo de importacao contabil:

```text
Parcelamento;Data;Cod. Conta Debito;Cod. Conta Credito;Valor;Cod. Historico;Complemento Historico;Inicia Lote;Codigo Matriz/Filial;Centro de Custo Debito;Centro de Custo Credito
```

As transacoes feitas no HTML ficam salvas no navegador como camada local. Elas entram na previa, na exportacao contabil e recalculam os saldos apresentados no Painel/Contratos. Use `Exportar estado JSON` para salvar um backup dessas transacoes manuais e dos saldos atualizados por contrato.

O JSON extraido continua sendo a carga inicial historica. A operacao diaria pode acontecer no HTML por lancamento manual ou importacao CSV; quando o servidor `scripts/server.py` estiver ativo, essa camada passa a ser gravada tambem no SQLite local.

## Estado do sistema

Na aba `Transacoes`, use `Exportar estado JSON` para gerar um backup operacional completo da camada HTML. Esse arquivo inclui:

- transacoes feitas ou importadas no HTML;
- status de revisao dos lancamentos;
- saldos recalculados por contrato;
- trilha resumida com data, contrato, regra, debito, credito, valor e historico.

Use `Importar estado JSON` para restaurar esse arquivo em outro navegador ou em outro momento. O botao `Carregar JSON` tambem reconhece esse arquivo de estado; quando ele for importado, a camada local e os saldos exibidos sao atualizados.

## Backend local

O backend em `scripts/server.py` foi criado para ser leve e auditavel, sem dependencias extras alem da biblioteca padrao do Python. Endpoints principais:

- `GET /api/health`: verifica servidor e caminho do banco.
- `GET /api/state`: retorna o ultimo estado operacional salvo.
- `PUT /api/state`: salva estado operacional completo.
- `POST /api/export-batches`: registra um lote exportado.
- `GET /api/audit`: lista eventos recentes de auditoria.
- `POST /api/audit`: registra eventos operacionais pontuais.

Esse backend ainda nao e multiusuario com login. Ele e o primeiro passo para substituir a planilha com persistencia real; a proxima evolucao natural e adicionar usuarios, permissoes, identificacao de aprovador e motor financeiro completo para recalcular contratos sem depender das formulas do XLSB.
