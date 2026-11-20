# Creates or fixes the "ITDarts" shortcut on the user's desktop (start.bat calls it on every start).
# The desktop can be redirected (OneDrive), so its path comes from the shell. No admin rights needed.
$ErrorActionPreference = 'Stop'
try {
  $root = Split-Path -Parent $PSScriptRoot
  $lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'ITDarts.lnk'
  $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
  $s.TargetPath = Join-Path $root 'start.bat'
  $s.WorkingDirectory = $root
  $s.IconLocation = (Join-Path $root 'assets\itdarts.ico') + ',0'
  $s.Description = 'ITDarts'
  $s.WindowStyle = 7
  $s.Save()
} catch {
  Write-Host "Desktop shortcut not updated: $($_.Exception.Message)"
}
