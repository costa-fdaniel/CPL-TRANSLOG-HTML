# Checklist de release do cliente

## Antes de gerar

- [ ] `app-manifest.json` com versao correta.
- [ ] `data/processed/dashboard.json` atualizado, quando a base deve ir embutida.
- [ ] `node --check src/dashboard.js` sem erro.
- [ ] `python -m py_compile scripts/server.py scripts/extract_dashboard_data.py` sem erro.
- [ ] `git diff --check` sem erro.

## Geracao

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build_client_release.ps1
```

## Conferencia da pasta

- [ ] `CPL TRANSLOG HTML.exe`.
- [ ] `LEIA-ME.txt`.
- [ ] `manifesto.json`.
- [ ] `CHANGELOG.txt`.
- [ ] `CHECKSUMS-SHA256.txt`.
- [ ] `Documentacao/Manual Rapido.md`.
- [ ] `Modelos/Modelo Importacao Lote.csv`.
- [ ] `Suporte/Orientacoes de Suporte.txt`.

## Teste funcional

- [ ] Abrir o `.exe`.
- [ ] Confirmar abertura como aplicativo Windows.
- [ ] Confirmar carregamento do painel.
- [ ] Testar filtros principais.
- [ ] Abrir aba `Contratos`.
- [ ] Abrir aba `Lancar`.
- [ ] Simular um lancamento.
- [ ] Verificar `Sistema > Camada HTML e recuperacao`.
- [ ] Exportar estado JSON de teste.

## Suporte

- [ ] Confirmar existencia de `%LOCALAPPDATA%\CPL TRANSLOG HTML\Logs\startup.log`.
- [ ] Confirmar pastas `App`, `Dados`, `Backups`, `Exportacoes` e `Logs`.
- [ ] Conferir `CHECKSUMS-SHA256.txt`.
