; Make one-click upgrades reliable even when an older Savewave build does not
; respond to NSIS's graceful close request. The installer executable has a
; different filename, so this targets only running application processes.
!macro customInit
  nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  Pop $1
  Sleep 500

  ; Earlier Savewave Electron uninstallers can return code 2 during an update.
  ; Bypass the old uninstaller and replace only Savewave's fixed per-user
  ; program directory. User data lives elsewhere and is intentionally retained.
  ReadRegStr $R9 SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  ${If} $R9 != ""
    DetailPrint "Replacing the existing Savewave installation"
    ${If} $INSTDIR == "$LOCALAPPDATA\Programs\savewave"
      RMDir /r "$LOCALAPPDATA\Programs\savewave"
    ${EndIf}
    DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
  ${EndIf}
!macroend
