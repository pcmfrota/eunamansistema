# 📱 EUNAMAN PCM — Guia de Compilação do APK

## Estrutura do Projeto Android

O projeto TWA (Trusted Web Activity) foi criado em `android-apk/`. 
O APK vai abrir o site **https://eunamansistema.vercel.app** como um app nativo Android.

---

## 🚀 Opção 1: Compilar pelo Android Studio (Recomendado)

### Passo 1 — Abrir o projeto
1. Abra o **Android Studio**
2. Clique em **"Open"** (não "New Project")
3. Navegue até: `C:\Users\jessi\OneDrive\Área de Trabalho\EUNAMAN SISTEMA\eunamansistema\android-apk`
4. Clique **OK** e aguarde o Gradle sync (pode demorar 2-5 min na primeira vez)

### Passo 2 — Gerar o Keystore (Assinatura do App)
1. No menu: **Build → Generate Signed Bundle / APK**
2. Selecione **APK** → Next
3. Clique em **"Create new..."**
4. Preencha:
   - **Key store path**: Escolha onde salvar (ex: `android-apk/eunaman.keystore`)
   - **Password**: `eunaman2024` (ou sua senha)
   - **Key alias**: `eunaman`
   - **Key password**: `eunaman2024`
   - **Validity**: `25` years
   - **First and Last Name**: EUNAMAN PCM
   - **Organization**: EUNAMAN
   - **Country Code**: BR
5. Clique **OK**

### Passo 3 — Compilar o APK
1. Selecione **release** como Build Variant
2. Marque **V1 (Jar Signature)** e **V2 (Full APK Signature)**
3. Clique **Finish**
4. O APK ficará em: `android-apk/app/build/outputs/apk/release/app-release.apk`

---

## 🔧 Opção 2: Compilar pelo Script PowerShell

Execute no PowerShell (como Administrador):

```powershell
cd "C:\Users\jessi\OneDrive\Área de Trabalho\EUNAMAN SISTEMA\eunamansistema"
.\build-apk.ps1
```

O script:
- ✅ Gera o keystore automaticamente
- ✅ Extrai o SHA-256 e atualiza o `assetlinks.json`
- ✅ Compila e assina o APK
- ✅ Copia o APK final para a raiz do projeto

---

## 🔑 Passo Crítico: Digital Asset Links (DAL)

Para que o app funcione **sem barra de endereço** (como app nativo), você precisa:

### 1. Obter o SHA-256 do seu keystore
```powershell
keytool -list -v -keystore android-apk\eunaman.keystore -alias eunaman
```
Copie o valor de `SHA256:` (formato: `AA:BB:CC:...`)

### 2. Atualizar o arquivo assetlinks.json
Edite `public/.well-known/assetlinks.json` e substitua `SUBSTITUIR_COM_SHA256_DO_KEYSTORE` pelo SHA-256 real.

### 3. Fazer deploy com o assetlinks.json
O arquivo já está em `public/.well-known/assetlinks.json`. 
Quando você fizer deploy no Vercel, ele ficará disponível em:
```
https://eunamansistema.vercel.app/.well-known/assetlinks.json
```

Verifique em: https://developers.google.com/digital-asset-links/tools/generator

---

## 📋 Pré-requisitos

| Ferramenta | Versão | Download |
|-----------|--------|----------|
| Android Studio | Hedgehog+ | https://developer.android.com/studio |
| JDK | 17+ | https://adoptium.net/ |
| Android SDK | API 34 | Via Android Studio |

---

## 🏪 Publicar na Play Store

1. Em vez de APK, gere um **AAB (Android App Bundle)**:
   - Build → Generate Signed Bundle → **Android App Bundle**
2. Acesse o [Google Play Console](https://play.google.com/console)
3. Crie um novo app → Upload o AAB
4. Preencha os metadados e envie para revisão

---

## 📱 Instalar Direto no Celular (Teste)

1. No Android: **Configurações → Segurança → Fontes Desconhecidas** (ativar)
2. Copie o APK para o celular via USB ou Google Drive
3. Abra o arquivo APK no celular para instalar

---

## ⚠️ Notas Importantes

- O app requer **Android 5.0+** (API 21)
- O app usa **Chrome Custom Tabs** como fallback em dispositivos sem suporte a TWA
- Para funcionar offline, o **Service Worker** já está configurado no projeto web
- O DAL (assetlinks.json) deve estar publicado ANTES de enviar para a Play Store

