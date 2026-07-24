@echo off
echo ===================================================
echo   EUNAMAN SISTEMA - ENVIAR ATUALIZACOES (PUSH)
echo ===================================================
echo.
echo 1. Adicionando modificacoes ao Git...
git add .
echo.
echo 2. Criando commit com as correcoes...
git commit -m "fix: sincronizacao da DM por mes com card DM do dashboard"
echo.
echo 3. Enviando para o repositorio (iniciando deploy)...
git push
echo.
echo ===================================================
echo   PROCESSO CONCLUIDO COM SUCESSO!
echo ===================================================
echo.
pause
