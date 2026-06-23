# CPL TRANSLOG HTML v1.1.0 - Refinamento estrutural

## Objetivo

Esta versao organiza a apresentacao visual e a estrutura de entrega para um padrao mais corporativo, mantendo a compatibilidade com o `dashboard.js` e com os pontos de preenchimento por `#id`.

## Padronizacao global

- Escala global baseada em Slate para base, texto, bordas e superficies.
- Indigo como cor primaria de acao, foco e selecao.
- Variaveis CSS centralizadas em `:root`.
- Reducao de contrastes acidentais por uso direto de azuis/tons soltos.

## Robustez estrutural

- Tabelas continuam dentro de `.table-wrap`.
- `.table-wrap` recebeu `max-width: 100%`, `width: 100%` e `overflow: auto`.
- Tabelas mantem densidade corporativa com `font-size: 0.813rem`.
- Cabecalhos continuam fixos com `position: sticky`.
- Linhas selecionadas usam Indigo, preservando leitura e hierarquia.

## Resiliencia do front-end

- Nenhum `#id` estrutural usado por `dashboard.js` foi removido.
- A versao preserva os containers de graficos, tabelas, filtros, contratos, lancamentos, auditoria e camada HTML.
- O refinamento foi feito por CSS, manifestos, documentacao e release scripts.

## Entrega

O pacote final deve ser gerado por:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build_client_release.ps1
```

Saida esperada:

```text
release/CPL TRANSLOG HTML - Cliente v1.1.0/
release/CPL TRANSLOG HTML - Cliente v1.1.0.zip
```
