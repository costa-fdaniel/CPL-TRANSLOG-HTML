$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $root ("Execut" + [char]0x00E1 + "vel")
$output = Join-Path $outputDir "CPL TRANSLOG HTML - Pacote.exe"
$source = Join-Path $PSScriptRoot "windows_packaged_app.cs"
$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$staging = Join-Path $env:TEMP ("cpl-translog-package-" + [guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $env:TEMP ("cpl-translog-app-" + [guid]::NewGuid().ToString("N") + ".zip")

if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (-not (Test-Path -LiteralPath $compiler)) {
  throw "Compilador C# do Windows nao encontrado."
}

try {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  New-Item -ItemType Directory -Force -Path $staging | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $staging "src") | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $staging "data\processed") | Out-Null

  Copy-Item -LiteralPath (Join-Path $root "index.html") -Destination (Join-Path $staging "index.html")
  Copy-Item -LiteralPath (Join-Path $root "app-manifest.json") -Destination (Join-Path $staging "app-manifest.json")
  Copy-Item -LiteralPath (Join-Path $root "src\dashboard.js") -Destination (Join-Path $staging "src\dashboard.js")
  Copy-Item -LiteralPath (Join-Path $root "src\styles.css") -Destination (Join-Path $staging "src\styles.css")

  $dashboardJson = Join-Path $root "data\processed\dashboard.json"
  if (Test-Path -LiteralPath $dashboardJson) {
    Copy-Item -LiteralPath $dashboardJson -Destination (Join-Path $staging "data\processed\dashboard.json")
    $json = Get-Content -LiteralPath $dashboardJson -Raw
    Set-Content -LiteralPath (Join-Path $staging "data\processed\dashboard.embedded.js") -Encoding UTF8 -Value ("window.TRANSLOG_DASHBOARD_DATA = " + $json + ";")
    $indexPath = Join-Path $staging "index.html"
    $index = Get-Content -LiteralPath $indexPath -Raw
    $embeddedScript = '<script src="data/processed/dashboard.embedded.js"></script>' + [Environment]::NewLine + '    <script src="src/dashboard.js'
    $index = $index -replace '<script src="src/dashboard.js', $embeddedScript
    Set-Content -LiteralPath $indexPath -Encoding UTF8 -Value $index
  }

  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force

  & $compiler `
    /nologo `
    /target:winexe `
    /out:$output `
    /resource:$zipPath,TranslogAppPackage `
    /reference:System.IO.Compression.dll `
    /reference:System.IO.Compression.FileSystem.dll `
    $source

  Write-Host "Executavel empacotado criado em: $output"
  Get-Item -LiteralPath $output | Select-Object FullName,Length,LastWriteTime
}
finally {
  if (Test-Path -LiteralPath $staging) {
    Remove-Item -LiteralPath $staging -Recurse -Force
  }
  if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }
}
