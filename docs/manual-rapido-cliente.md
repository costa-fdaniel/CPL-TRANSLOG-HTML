# CPL TRANSLOG HTML - Manual Rapido

## Abrir o sistema

1. Abra `CPL TRANSLOG HTML - Pacote.exe`.
2. O sistema sera aberto como aplicativo Windows.
3. Use a aba `Painel` para conferir a visao geral.

## Atualizar a base

1. Clique em `Carregar JSON`.
2. Selecione o arquivo `dashboard.json` atualizado.
3. Confira os filtros e os indicadores do painel.

## Fazer lancamentos

1. Acesse `Lancar`.
2. Selecione contrato, acao, data, parcelas e valor.
3. Clique em `Simular`.
4. Confira a previa contabil.
5. Clique em `Adicionar a esteira`.

## Aprovar e exportar CSV

1. Acesse `Esteira CSV`.
2. Filtre ano, contrato, regra ou situacao.
3. Selecione os lancamentos.
4. Clique em `Aprovar`.
5. Clique em `Exportar CSV`.

## Salvar e recuperar

O sistema salva a camada operacional no proprio aplicativo via IndexedDB/localStorage.

Use `Sistema > Camada HTML e recuperacao` para:

- salvar no navegador;
- restaurar estado salvo;
- exportar estado JSON;
- importar estado JSON;
- criar ponto de recuperacao;
- restaurar ultimo ponto.

## Pastas locais

O pacote cria estrutura em:

```text
%LOCALAPPDATA%\CPL TRANSLOG HTML\
├─ App
├─ Dados
├─ Backups
├─ Exportacoes
└─ Logs
```

## Cuidados

- Nao apague a pasta `%LOCALAPPDATA%\CPL TRANSLOG HTML` sem antes exportar backup.
- O arquivo `CPL TRANSLOG HTML - Pacote.exe` pode conter dados financeiros processados.
- Para enviar uma nova versao, gere novo pacote e substitua o executavel entregue.
