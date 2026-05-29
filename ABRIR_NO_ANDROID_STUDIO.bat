@echo off
title Abrindo EUNAMAN PCM no Android Studio...
color 0B

echo.
echo  ============================================
echo   EUNAMAN PCM - Abrindo no Android Studio
echo  ============================================
echo.

:: Caminho do projeto
set PROJECT_DIR=%~dp0android-apk

:: Procurar Android Studio nos locais comuns
set STUDIO_EXE=

if exist "C:\Program Files\Android\Android Studio\bin\studio64.exe" (
    set STUDIO_EXE="C:\Program Files\Android\Android Studio\bin\studio64.exe"
    goto :abrir
)

if exist "C:\Program Files\Android Studio\bin\studio64.exe" (
    set STUDIO_EXE="C:\Program Files\Android Studio\bin\studio64.exe"
    goto :abrir
)

if exist "%LOCALAPPDATA%\Programs\Android Studio\bin\studio64.exe" (
    set STUDIO_EXE="%LOCALAPPDATA%\Programs\Android Studio\bin\studio64.exe"
    goto :abrir
)

:: Tentar pelo registro do Windows
for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Android Studio" /v Path 2^>nul') do (
    if exist "%%b\bin\studio64.exe" (
        set STUDIO_EXE="%%b\bin\studio64.exe"
        goto :abrir
    )
)

:: Se não encontrou automaticamente, pedir ao usuario
echo  Android Studio nao encontrado automaticamente.
echo.
echo  Por favor abra o Android Studio manualmente e:
echo    1. Clique em "File" - "Open"
echo    2. Navegue ate: %PROJECT_DIR%
echo    3. Clique em "OK"
echo.
pause
goto :fim

:abrir
echo  Encontrado: %STUDIO_EXE%
echo  Projeto: %PROJECT_DIR%
echo.
echo  Abrindo Android Studio...
echo.
start "" %STUDIO_EXE% "%PROJECT_DIR%"
echo  Android Studio esta sendo aberto com o projeto EUNAMAN PCM.
echo.
echo  Aguarde o Gradle sincronizar (barra de progresso no rodape).
echo.
echo  Depois de carregar:
echo    - Para gerar APK debug:   Build ^> Build APK(s)
echo    - Para gerar APK release: Build ^> Generate Signed Bundle / APK
echo.
timeout /t 5 /nobreak >nul

:fim
