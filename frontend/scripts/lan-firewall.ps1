[CmdletBinding()]
param(
    [string]$InterfaceAlias,
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$ruleName = 'RutaSV-Frontend-LAN-5173'
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as Administrator, then run this script again. No firewall settings were changed.'
}

if ($Remove) {
    Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Write-Output 'Removed only the RutaSV LAN rule. Other rules were not changed.'
    exit 0
}

if ([string]::IsNullOrWhiteSpace($InterfaceAlias)) {
    throw 'Specify the LAN adapter, for example: -InterfaceAlias "Ethernet" or -InterfaceAlias "Wi-Fi".'
}
Get-NetAdapter -Name $InterfaceAlias -ErrorAction Stop | Out-Null
$nodePath = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source

# A new allow cannot override an explicit block. Report it instead of modifying
# another application's rules or changing the network's Public/Private category.
$blocks = @(Get-NetFirewallApplicationFilter | Where-Object { $_.Program -ieq $nodePath } | Get-NetFirewallRule | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq 'Block' })
if ($blocks.Count) {
    throw 'Existing inbound Node block rules require manual review in Windows Firewall. No rules were changed.'
}

Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -Name $ruleName -DisplayName 'RutaSV frontend LAN TCP 5173' -Direction Inbound -Action Allow -Enabled True -Protocol TCP -LocalPort 5173 -Program $nodePath -RemoteAddress LocalSubnet -InterfaceAlias $InterfaceAlias -Profile Any -EdgeTraversalPolicy Block | Out-Null
Write-Output ('Ready: TCP 5173 for Node, LocalSubnet only, adapter ' + $InterfaceAlias + '. Other firewall rules and network profiles were not changed.')
