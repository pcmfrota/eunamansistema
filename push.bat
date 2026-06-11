@echo off
echo ===================================================
echo   EUNAMAN SISTEMA - ENVIAR ATUALIZACOES (PUSH)
echo ===================================================
echo.
echo 1. Adicionando modificacoes ao Git...
git add .
echo.
echo 2. Criando commit com as correcoes...
git commit -m "fix: resolve erro JSX, ajusta layouts mobile retrato/paisagem e insere modal com zoom"
echo.
echo 3. Enviando para o repositorio (iniciando deploy)...
git push
echo.
echo ===================================================
echo   PROCESSO CONCLUIDO COM SUCESSO!
echo ===================================================
echo.
pause
