# Repro: git for Windows hands merge.<name>.driver to its bundled sh, which eats
# backslashes as escapes. The driver never runs and git reports a plain conflict.
# Run: pwsh -NoProfile -File devlog/260911_windows-round/repro-merge-driver.ps1
$ErrorActionPreference = 'Stop'

function Remove-Fixture {
  param([string]$Root)
  Get-ChildItem -LiteralPath $Root -Recurse -Force -File |
    ForEach-Object { $_.Attributes = 'Normal' }
  [System.IO.Directory]::Delete($Root, $true)
}

function New-Fixture {
  param([string]$Root)
  if (Test-Path -LiteralPath $Root) { Remove-Fixture $Root }
  New-Item -ItemType Directory -Path $Root | Out-Null
  Push-Location -LiteralPath $Root
  git init -q -b main
  git config user.email t@example.com
  git config user.name  t
  Set-Content -LiteralPath (Join-Path $Root 'mydriver') -Encoding utf8 -Value @(
    '#!/usr/bin/env python3',
    'import sys',
    "open(sys.argv[2], 'w').write('MERGED-BY-DRIVER')"
  )
  Set-Content -LiteralPath (Join-Path $Root '.gitattributes') -Encoding utf8 -Value '*.md merge=mine'
  git config merge.mine.name 'test driver'
  Set-Content -LiteralPath (Join-Path $Root 'f.md') -Encoding utf8 -Value 'base'
  git add -A
  git commit -qm base
  git checkout -q -b other
  Set-Content -LiteralPath (Join-Path $Root 'f.md') -Encoding utf8 -Value 'other'
  git commit -qam other
  git checkout -q main
  Set-Content -LiteralPath (Join-Path $Root 'f.md') -Encoding utf8 -Value 'mine'
  git commit -qam mine
  Pop-Location
}

function Test-Driver {
  param([string]$Label, [string]$DriverCommand)
  $root = Join-Path $env:TEMP 'fp-mergedriver'
  New-Fixture $root
  Push-Location -LiteralPath $root
  try {
    git config merge.mine.driver $DriverCommand
    '=== ' + $Label
    '  driver : ' + (git config merge.mine.driver)
    $out = git merge other 2>&1
    $code = $LASTEXITCODE
    foreach ($line in $out) { '  git    : ' + $line }
    '  exit   : ' + $code
    '  f.md   : ' + ((Get-Content -LiteralPath (Join-Path $root 'f.md')) -join ' / ')
  }
  finally {
    Pop-Location
    Remove-Fixture $root
  }
}

$drvBack = (Join-Path $env:TEMP 'fp-mergedriver') + '\mydriver'
$drvFwd  = $drvBack -replace '\\', '/'
$py      = Join-Path $env:USERPROFILE '.aside\runtime\bin\python3.cmd'
$pyFwd   = $py -replace '\\', '/'
'python : ' + $py + '  exists=' + (Test-Path -LiteralPath $py)
''

Test-Driver 'A. extensionless shebang script, BACKSLASH path' ($drvBack + ' %O %A %B %P')
''
Test-Driver 'B. extensionless shebang script, FORWARD-slash path' ($drvFwd + ' %O %A %B %P')
''
Test-Driver 'C. explicit interpreter, forward slashes, quoted' ('"' + $pyFwd + '" "' + $drvFwd + '" %O %A %B %P')
