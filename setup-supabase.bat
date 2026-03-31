@echo off
echo Iniciando configuracao do Supabase localmente...

echo.
echo [1/4] Fazendo login no Supabase CLI
call npx supabase login --token sbp_1b355c5423953ba9ebee614e6374ce2dfb85b8e4

echo.
echo [2/4] Inicializando pastas do Supabase
call npx supabase init

echo.
echo [3/4] Linkando projeto remoto
call npx supabase link --project-ref ffvwappomyuhyyeylpgt --password Pcmeunaman123

echo.
echo [4/4] Enviando Banco de Dados e Triggers para o servidor
call npx supabase db push

echo.
echo ✅ Sucesso! Banco de Dados e Variaveis configurados.
echo Verifique seu painel em https://supabase.com
pause
