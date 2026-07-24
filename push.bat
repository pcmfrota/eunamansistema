@echo off
echo ===================================================
echo   EUNAMAN SISTEMA - ENVIAR ATUALIZACOES (PUSH)
echo ===================================================
echo.
set GIT_CMD=git
where git >nul 2>nul
if %errorlevel% neq 0 (
  if exist "C:\Program Files\Git\cmd\git.exe" set GIT_CMD="C:\Program Files\Git\cmd\git.exe"
)

echo 1. Adicionando modificacoes ao Git...
%GIT_CMD% add .
echo.
echo 2. Criando commit com as correcoes...
%GIT_CMD% commit -m "fix: sincronizacao da DM por mes com card DM do dashboard"
echo.
echo 3. Enviando para o repositorio (iniciando deploy)...
%GIT_CMD% push
echo.
echo ===================================================
echo   PROCESSO CONCLUIDO COM SUCESSO!
echo ===================================================
echo.
pause

