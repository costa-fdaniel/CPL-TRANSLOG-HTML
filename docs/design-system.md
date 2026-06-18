# Design system CPL TRANSLOG HTML

Este projeto usa um design system interno em CSS para manter o dashboard financeiro consistente, leve e auditavel.

## Principios

- Densidade controlada: telas financeiras podem ter muita informacao, mas cada bloco precisa respirar.
- Hierarquia clara: uma tela deve mostrar primeiro decisao, depois detalhe, depois auditoria.
- Sem dependencia visual pesada: a interface deve continuar abrindo como HTML/CSS/JS simples.
- Estados previsiveis: azul informa/seleciona, verde confirma, amarelo alerta, vermelho bloqueia/erro.
- Regra contábil acima de ornamento: nenhum visual deve esconder debito, credito, valor, contrato ou status.

## Tokens principais

Os tokens ficam em `src/styles.css`, no bloco `:root`.

- Cores base: `--bg`, `--surface`, `--text`, `--muted`, `--ink`.
- Cores semanticas: `--blue`, `--green`, `--amber`, `--red` e suas versoes `*-soft`.
- Superficies: `--surface-glass`, `--surface-raised`, `--surface-section`.
- Bordas: `--border-soft`, `--border-strong`.
- Espacamentos: `--space-1` ate `--space-14`.
- Raios: `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-pill`.
- Sombras: `--shadow`, `--shadow-soft`, `--shadow-button`, `--shadow-hover`.

## Componentes

- `workspace-shell`: divide controle lateral e conteudo principal.
- `workspace-sidebar`: status, navegacao e filtros globais.
- `view-header`: cabecalho explicativo de cada area.
- `section-group`: bloco dobravel para reduzir pagina infinita.
- `panel`: card operacional ou analitico.
- `kpi-grid` e `panel-summary`: indicadores financeiros.
- `action-catalog` e `action-card`: escolha visual de operacao de lancamento.
- `table-wrap`: tabelas com rolagem controlada.

## Regras de uso

- Preferir tokens a valores soltos em novos estilos.
- Evitar mais de duas colunas em formularios operacionais sensiveis.
- Manter filtros globais na lateral; filtros especificos ficam dentro da area correspondente.
- Usar `section-group` para detalhes, historico, auditoria e analises secundarias.
- Nao esconder validacoes, status ou avisos em elementos puramente visuais.

