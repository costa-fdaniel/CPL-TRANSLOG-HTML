$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $PSScriptRoot "windows_launcher.cs"
$outputDir = Join-Path $root ("Execut" + [char]0x00E1 + "vel")
$output = Join-Path $outputDir "CPL TRANSLOG HTML.exe"
$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (-not (Test-Path -LiteralPath $compiler)) {
  throw "Compilador C# do Windows nao encontrado."
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
& $compiler /nologo /target:winexe /out:$output $source
Write-Host "Executavel criado em: $output"
