package com.eunaman.pcm;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.google.androidbrowserhelper.trusted.TwaLauncher;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * EunamanActivity — Activity principal do EUNAMAN PCM TWA.
 *
 * Injeta uma ponte JavaScript (EunamanCamera) que permite ao site web
 * abrir a câmera nativa sem sair do contexto da página, resolvendo o
 * problema de recarregamento ao tirar fotos na Ordem de Serviço.
 */
public class EunamanActivity extends AppCompatActivity {

    private static final String TAG = "EunamanPCM";
    private static final int REQUEST_CAMERA        = 1001;
    private static final int REQUEST_CAMERA_PERM   = 1002;
    private static final int MAX_IMAGE_SIZE_PX     = 1280;
    private static final int JPEG_QUALITY          = 80;

    private WebView     webView;
    private ProgressBar progressBar;
    private ImageView   splashScreen;
    private String      currentPhotoPath;
    private Uri         photoUri;
    private long        startTime;

    private boolean isLoggingOut = false;

    // ── Ciclo de vida ────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startTime = System.currentTimeMillis();
        Log.d(TAG, "Iniciando EunamanActivity...");
        
        setContentView(R.layout.activity_main);

        webView      = findViewById(R.id.webview);
        progressBar  = findViewById(R.id.loading_progress);
        splashScreen = findViewById(R.id.splash_screen);

        if (webView != null) {
            configureWebView();
            String url = getString(R.string.launch_url);
            Log.d(TAG, "Carregando URL: " + url);
            webView.loadUrl(url);
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        
        // ── Otimização de Performance ──
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        
        // Identificação como Navegador Mobile para evitar bloqueios de Login
        String originalUA = settings.getUserAgentString();
        settings.setUserAgentString(originalUA + " EunamanApp/1.1.0");
        
        // Renderização acelerada
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        
        // Estratégia de Cache Inteligente
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Sessão e Cookies
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (progressBar != null) progressBar.setVisibility(View.VISIBLE);
                Log.d(TAG, "Carregamento iniciado: " + url);

                // Detecta URLs de logout (sair) para limpar a sessão nativa
                if (!isLoggingOut && (url.toLowerCase().contains("logout") || url.toLowerCase().contains("/sair"))) {
                    Log.d(TAG, "Detectada URL de Logout. Executando limpeza nativa...");
                    performNativeLogout();
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (progressBar != null) progressBar.setVisibility(View.GONE);
                
                // Remove o Splash Screen após o primeiro carregamento completo
                if (splashScreen != null && splashScreen.getVisibility() == View.VISIBLE) {
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        splashScreen.setVisibility(View.GONE);
                        webView.setVisibility(View.VISIBLE);
                        long loadTime = System.currentTimeMillis() - startTime;
                        Log.d(TAG, "App pronto em: " + loadTime + "ms");
                    }, 500);
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    CookieManager.getInstance().flush();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    Log.e(TAG, "Erro de carregamento: " + error.toString());
                    Toast.makeText(EunamanActivity.this, "Erro de conexão. Verifique sua internet.", Toast.LENGTH_LONG).show();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progressBar != null) {
                    if (newProgress < 100) {
                        progressBar.setVisibility(View.VISIBLE);
                        progressBar.setIndeterminate(false);
                        progressBar.setProgress(newProgress);
                    } else {
                        progressBar.setVisibility(View.GONE);
                    }
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "[JS CONSOLE] " + consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of "
                        + consoleMessage.sourceId());
                return true;
            }
        });

        // Injeta a Ponte JS (Câmera + Logout + Sincronização)
        EunamanJsBridge bridge = new EunamanJsBridge();
        webView.addJavascriptInterface(bridge, "EunamanApp");
        webView.addJavascriptInterface(bridge, "EunamanCamera"); // Alias para compatibilidade
        
        setupNetworkMonitoring();
    }

    private void setupNetworkMonitoring() {
        ConnectivityManager connectivityManager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (connectivityManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            connectivityManager.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(@NonNull Network network) {
                    runOnUiThread(() -> {
                        // Quando a internet volta, avisa o site para sincronizar dados (ex: novos cargos)
                        if (webView != null) {
                            webView.loadUrl("javascript:(function(){"
                                    + "if(window.onNetworkSync){ window.onNetworkSync(); }"
                                    + "})();");
                        }
                    });
                }
            });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // ── Resultado da câmera ──────────────────────────────────────────────────

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_CAMERA && resultCode == Activity.RESULT_OK) {
            processAndSendPhoto();
        }
    }

    // ── Permissões ───────────────────────────────────────────────────────────

    @Override
    public void onRequestPermissionsResult(int requestCode,
                                           @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_CAMERA_PERM
                && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            launchCamera();
        } else {
            sendErrorToJs("Permissão de câmera negada.");
        }
    }

    // ── Lógica interna ───────────────────────────────────────────────────────

    private void launchCamera() {
        try {
            File photoFile = createTempPhotoFile();
            currentPhotoPath = photoFile.getAbsolutePath();
            photoUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".provider",
                    photoFile
            );

            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            startActivityForResult(intent, REQUEST_CAMERA);

        } catch (IOException e) {
            sendErrorToJs("Erro ao criar arquivo para foto: " + e.getMessage());
        }
    }

    private File createTempPhotoFile() throws IOException {
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault())
                .format(new Date());
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        return File.createTempFile("EUNAMAN_" + timestamp, ".jpg", storageDir);
    }

    private void processAndSendPhoto() {
        new Thread(() -> {
            try {
                if (currentPhotoPath == null) {
                    sendErrorToJs("Caminho do arquivo não encontrado.");
                    return;
                }

                // 1. Decodifica com amostragem para evitar OOM
                BitmapFactory.Options opts = new BitmapFactory.Options();
                opts.inJustDecodeBounds = true;
                BitmapFactory.decodeFile(currentPhotoPath, opts);

                int scale = 1;
                while (opts.outWidth / scale > MAX_IMAGE_SIZE_PX
                        || opts.outHeight / scale > MAX_IMAGE_SIZE_PX) {
                    scale *= 2;
                }

                opts.inJustDecodeBounds = false;
                opts.inSampleSize = scale;
                Bitmap bitmap = BitmapFactory.decodeFile(currentPhotoPath, opts);

                if (bitmap == null) {
                    sendErrorToJs("Não foi possível ler a imagem.");
                    return;
                }

                // 2. Corrige rotação EXIF
                bitmap = fixRotation(bitmap, currentPhotoPath);

                // 3. Comprime para JPEG Base64
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, baos);
                String base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);

                bitmap.recycle();

                // 4. Envia para o WebView via JS
                String dataUrl = "data:image/jpeg;base64," + base64;
                sendPhotoToJs(dataUrl);

            } catch (Exception e) {
                sendErrorToJs("Erro ao processar foto: " + e.getMessage());
            }
        }).start();
    }

    private Bitmap fixRotation(Bitmap bitmap, String path) {
        try {
            ExifInterface exif = new ExifInterface(path);
            int orientation = exif.getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL
            );
            Matrix matrix = new Matrix();
            switch (orientation) {
                case ExifInterface.ORIENTATION_ROTATE_90:  matrix.postRotate(90);  break;
                case ExifInterface.ORIENTATION_ROTATE_180: matrix.postRotate(180); break;
                case ExifInterface.ORIENTATION_ROTATE_270: matrix.postRotate(270); break;
                default: return bitmap;
            }
            Bitmap rotated = Bitmap.createBitmap(
                    bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true
            );
            bitmap.recycle();
            return rotated;
        } catch (IOException e) {
            return bitmap;
        }
    }

    private void sendPhotoToJs(String dataUrl) {
        String js = "javascript:(function(){"
                + "if(window.onEunamanCameraResult){"
                + "window.onEunamanCameraResult(" + "JSON.stringify({success:true,dataUrl:" + "\"" + dataUrl + "\"" + "})" + ");"
                + "}})();";
        runOnUiThread(() -> {
            if (webView != null) webView.loadUrl(js);
        });
    }

    private void performNativeLogout() {
        if (isLoggingOut) return;
        isLoggingOut = true;
        
        Log.d(TAG, "Iniciando processo de Logout Nativo...");
        runOnUiThread(() -> {
            if (webView != null) webView.stopLoading();

            // 1. Limpa Cookies e Sessão
            CookieManager cookieManager = CookieManager.getInstance();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                cookieManager.removeAllCookies(success -> {
                    cookieManager.flush();
                    finalizeLogout();
                });
            } else {
                cookieManager.removeAllCookie();
                cookieManager.removeSessionCookie();
                finalizeLogout();
            }
        });
    }

    private void finalizeLogout() {
        runOnUiThread(() -> {
            if (webView != null) {
                // 2. Limpa Cache e Armazenamento Nativo
                webView.clearCache(true);
                webView.clearHistory();
                webView.clearFormData();
                WebStorage.getInstance().deleteAllData();
                
                // 3. Limpa LocalStorage via JS (Garante que tokens sumam)
                webView.loadUrl("javascript:(function(){ localStorage.clear(); sessionStorage.clear(); })();");
                
                // 4. Redireciona para a Home/Login
                String loginUrl = getString(R.string.launch_url);
                webView.loadUrl(loginUrl);
                Log.d(TAG, "Logout Nativo finalizado. Redirecionado para: " + loginUrl);
            }
            
            isLoggingOut = false;
            Toast.makeText(this, "Sessão encerrada com sucesso.", Toast.LENGTH_SHORT).show();
        });
    }

    // ── Ponte JavaScript Integrada ───────────────────────────────────────────

    private class EunamanJsBridge {

        /**
         * Abre a câmera nativa.
         * Chamado via: EunamanApp.openCamera()
         */
        @JavascriptInterface
        public void openCamera() {
            runOnUiThread(() -> {
                boolean hasPerm = ContextCompat.checkSelfPermission(
                        EunamanActivity.this, Manifest.permission.CAMERA
                ) == PackageManager.PERMISSION_GRANTED;

                if (hasPerm) {
                    launchCamera();
                } else {
                    ActivityCompat.requestPermissions(
                            EunamanActivity.this,
                            new String[]{Manifest.permission.CAMERA},
                            REQUEST_CAMERA_PERM
                    );
                }
            });
        }

        /**
         * Logout Funcional: Limpa TUDO e reinicia.
         * Chamado via: EunamanApp.logout()
         */
        @JavascriptInterface
        public void logout() {
            runOnUiThread(EunamanActivity.this::performNativeLogout);
        }
        
        /**
         * Log de Performance vindo da Web
         */
        @JavascriptInterface
        public void logPerformance(String message) {
            Log.d(TAG, "[WEB PERFORMANCE] " + message);
        }
    }

    private void sendErrorToJs(String message) {
        String js = "javascript:(function(){"
                + "if(window.onEunamanCameraResult){"
                + "window.onEunamanCameraResult(JSON.stringify({success:false,error:'" + message + "'}));"
                + "}})();";
        runOnUiThread(() -> {
            if (webView != null) webView.loadUrl(js);
        });
    }
}
