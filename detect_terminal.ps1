$ErrorActionPreference='SilentlyContinue'
Write-Host 'Processes:'
Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and ($_.ProcessName -match 'WindowsTerminal|wt|Code|cmd|powershell|pwsh|conhost|wezterm|alacritty') } | Select-Object ProcessName,Id,MainWindowTitle,Path | Format-List
Write-Host 'Settings files:'
$paths = @(
  "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json",
  "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\settings.json",
  "$env:LOCALAPPDATA\Microsoft\Windows Terminal\settings.json",
  "$env:APPDATA\alacritty\alacritty.toml",
  "$env:USERPROFILE\.wezterm.lua"
)
foreach($p in $paths){ if(Test-Path $p){ Write-Host $p } }
