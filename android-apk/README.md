# 📱 EUNAMAN PCM — Guia Android Studio

## Estrutura do Projeto

```
android-apk/
├── app/
│   ├── build.gradle              ← Configurações do app
│   ├── proguard-rules.pro        ← Regras de ofuscação
│   └── src/main/
│       ├── AndroidManifest.xml   ← Manifesto do app
│       └── res/
│           ├── drawable/         ← Ícones vetoriais
│           ├── mipmap-anydpi-v26/ ← Ícone adaptativo (Android 8+)
│           ├── mipmap-mdpi/      ← 48x48px
│           ├── mipmap-hdpi/      ← 72x72px
│           ├── mipmap-xhdpi/     ← 96x96px
│           ├── mipmap-xxhdpi/    ← 144x144px
│           ├── mipmap-xxxhdpi/   ← 192x192px
│           ├── xml/              ← Configuração de segurança de rede
│           └── values/
│               ├── colors.xml
│               ├── strings.xml
│               └── styles.xml
├── gradle/wrapper/
│   └── gradle-wrapper.properties
├── build.gradle                  ← Configurações raiz
├── gradlew.bat                   ← Gradle Wrapper (Windows)
└── settings.gradle
```

## Como Abrir no Android Studio

1. **Abrir Android Studio**
2. **File → Open**
3. Navegar até: `EUNAMAN SISTEMA\eunamansistema\android-apk`
4. Clicar em **OK**
5. Aguardar o **Gradle sync** terminar (pode demorar na primeira vez)

## Gerar APK Debug (para testar)

1. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. O APK será gerado em: `app/build/outputs/apk/debug/app-debug.apk`
3. Clique em **"locate"** no aviso que aparecer

## Gerar APK Release (para distribuir)

1. Menu **Build → Generate Signed Bundle / APK**
2. Escolha **APK**
3. **Criar nova keystore** (primeira vez):
   - Key store path: Escolha onde salvar (ex: `minha-chave.jks`)
   - Password: Use uma senha forte
   - Key alias: `eunaman-key`
   - Validity: 25 anos
   - Preencha os campos de certificado
4. Escolha **release** como build variant
5. Clique em **Finish**

> ⚠️ **IMPORTANTE**: Guarde a keystore em lugar seguro! Se perder, não poderá atualizar o app na Play Store.

## Gerar Ícones PNG (se necessário)

Execute o script PowerShell na pasta raiz do projeto:

```powershell
.\gerar_icones.ps1
```

Ou use o **Image Asset Studio** do Android Studio:
1. Clique direito na pasta `res` → **New → Image Asset**
2. Escolha o tipo **Launcher Icons (Adaptive and Legacy)**
3. Configure o ícone como desejar

## Configurações do App

| Configuração | Valor |
|---|---|
| Package Name | `com.eunaman.pcm` |
| Min SDK | Android 5.0 (API 21) |
| Target SDK | Android 14 (API 34) |
| URL do App | `https://eunaman-pcm.vercel.app/` |
| Versão | 1.0.0 (versionCode: 1) |

## Atualizar a URL do App

Edite o arquivo `app/src/main/res/values/strings.xml`:

```xml
<string name="launch_url">https://SEU-DOMINIO.com/</string>
<string name="asset_host">SEU-DOMINIO.com</string>
```

## Digital Asset Links (Verificação de domínio)

Para que o TWA funcione sem barra do Chrome, adicione o arquivo em:

```
https://eunaman-pcm.vercel.app/.well-known/assetlinks.json
```

Conteúdo (substitua SHA256 pelo fingerprint da sua keystore):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.eunaman.pcm",
    "sha256_cert_fingerprints": ["SEU_SHA256_AQUI"]
  }
}]
```

Para obter o SHA256:
```
keytool -list -v -keystore minha-chave.jks -alias eunaman-key
```
