$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "app-manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version
$releaseRoot = Join-Path $root "release"
$releaseName = "CPL TRANSLOG HTML - Cliente v$version"
$releaseDir = Join-Path $releaseRoot $releaseName
$exeSource = Join-Path $root ("Execut" + [char]0x00E1 + "vel\CPL TRANSLOG HTML - Pacote.exe")
$exeTarget = Join-Path $releaseDir "CPL TRANSLOG HTML.exe"

& (Join-Path $PSScriptRoot "build_packaged_windows_app.ps1")

if (Test-Path -LiteralPath $releaseDir) {
  Remove-Item -LiteralPath $releaseDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $releaseDir "Documentacao") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $releaseDir "Modelos") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $releaseDir "Suporte") | Out-Null

Copy-Item -LiteralPath $exeSource -Destination $exeTarget
Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $releaseDir "manifesto.json")
Copy-Item -LiteralPath (Join-Path $root "docs\manual-rapido-cliente.md") -Destination (Join-Path $releaseDir "Documentacao\Manual Rapido.md")
Copy-Item -LiteralPath (Join-Path $root ("Execut" + [char]0x00E1 + "vel\LEIA-ME.txt")) -Destination (Join-Path $releaseDir "LEIA-ME.txt")
Copy-Item -LiteralPath (Join-Path $root "templates\modelo-importacao-lote.csv") -Destination (Join-Path $releaseDir "Modelos\Modelo Importacao Lote.csv")

$changelog = @"
CPL TRANSLOG HTML v$version

Build: $($manifest.buildDate)

Conteudo da entrega:
- Aplicativo Windows empacotado
- Base processada embutida quando data/processed/dashboard.json existir
- CRUD local via IndexedDB/localStorage
- Importacao JSON
- Exportacao CSV contabil
- Pontos de recuperacao
- Manual rapido e modelo CSV

Observacao:
Este pacote pode conter dados financeiros processados. Trate como arquivo confidencial.
"@

Set-Content -LiteralPath (Join-Path $releaseDir "CHANGELOG.txt") -Encoding UTF8 -Value $changelog

$support = @"
Pastas criadas no computador do cliente:

%LOCALAPPDATA%\CPL TRANSLOG HTML\App
%LOCALAPPDATA%\CPL TRANSLOG HTML\Dados
%LOCALAPPDATA%\CPL TRANSLOG HTML\Backups
%LOCALAPPDATA%\CPL TRANSLOG HTML\Exportacoes
%LOCALAPPDATA%\CPL TRANSLOG HTML\Logs

Em caso de suporte, solicitar:
- print da tela;
- arquivo de backup JSON exportado na aba Sistema;
- arquivo %LOCALAPPDATA%\CPL TRANSLOG HTML\Logs\startup.log.
"@

Set-Content -LiteralPath (Join-Path $releaseDir "Suporte\Orientacoes de Suporte.txt") -Encoding UTF8 -Value $support

$hashes = Get-ChildItem -LiteralPath $releaseDir -Recurse -File |
  Sort-Object FullName |
  ForEach-Object {
    $hash = Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
    [PSCustomObject]@{
      SHA256 = $hash.Hash
      Length = $_.Length
      File = $_.FullName.Substring($releaseDir.Length + 1)
    }
  }

$hashLines = $hashes | ForEach-Object { "$($_.SHA256)  $($_.Length)  $($_.File)" }
Set-Content -LiteralPath (Join-Path $releaseDir "CHECKSUMS-SHA256.txt") -Encoding UTF8 -Value $hashLines

$zip = Join-Path $releaseRoot "$releaseName.zip"
if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}
Compress-Archive -Path (Join-Path $releaseDir "*") -DestinationPath $zip -Force

Write-Host "Release criada em: $releaseDir"
Write-Host "ZIP criado em: $zip"
Get-Item -LiteralPath $exeTarget,$zip | Select-Object FullName,Length,LastWriteTime
