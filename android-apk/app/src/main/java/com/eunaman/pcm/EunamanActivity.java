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
import android.webkit.PermissionRequest;
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

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * EunamanActivity — Principal motor do EUNAMAN PCM.
 * Gerencia Sincronização em tempo real entre Vercel/Supabase e o APK.
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
    private PermissionRequest pendingPermissionRequest;
    private static final int REQUEST_CAMERA_WEBVIEW_PERM = 1003;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startTime = System.currentTimeMillis();
        Log.d(TAG, "Iniciando EunamanActivity...");
        
        if (savedInstanceState != null) {
            currentPhotoPath = savedInstanceState.getString("currentPhotoPath");
            photoUri = savedInstanceState.getParcelable("photoUri");
        }

        setContentView(R.layout.activity_main);

        webView      = findViewById(R.id.webview);
        progressBar  = findViewById(R.id.loading_progress);
        splashScreen = findViewById(R.id.splash_screen);

        if (webView != null) {
            configureWebView();
            
            if (savedInstanceState != null) {
                Log.d(TAG, "Restaurando estado do WebView...");
                webView.restoreState(savedInstanceState);
            } else {
                String url = getString(R.string.launch_url);
                Log.d(TAG, "Carregando URL inicial: " + url);
                webView.loadUrl(url);
            }
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
        outState.putString("currentPhotoPath", currentPhotoPath);
        outState.putParcelable("photoUri", photoUri);
        Log.d(TAG, "Estado da Activity salvo.");
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        
        // ── CONFIGURAÇÃO DE SINCRONIZAÇÃO TOTAL ──
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); 
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        
        // Permissões Universais (Crítico para Supabase/Realtime)
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setAllowFileAccessFromFileURLs(true);
        
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        
        // Renderização acelerada e persistência de dados
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        
        // Habilita Cookies para domínios cruzados (Vercel <-> Supabase)
        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
        
        // Identidade idêntica ao Chrome Desktop para sincronização perfeita
        settings.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");

        // Garante que o WebView permita rolagem e interação
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (progressBar != null) progressBar.setVisibility(View.VISIBLE);
                CookieManager.getInstance().flush();

                String lowerUrl = url.toLowerCase();
                if (!isLoggingOut && (lowerUrl.contains("logout") || lowerUrl.contains("/sair") || lowerUrl.contains("signout"))) {
                    performNativeLogout();
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
                
                // Força o LocalStorage a persistir no Android (Crítico para sincronização)
                view.loadUrl("javascript:(function(){ " +
                        "  if(window.localStorage) { " +
                        "    localStorage.setItem('eunaman_android_sync', Date.now()); " +
                        "  }" +
                        "})();");

                // CUSTOMIZAÇÕES VISUAIS
                String jsCustom = "javascript:(function(){" +
                        "  var elements = document.querySelectorAll('*');" +
                        "  for (var i = 0; i < elements.length; i++) {" +
                        "    var text = elements[i].innerText || '';" +
                        "    if (text === 'Ficha com fotos') { elements[i].innerText = 'HISTÓRICO DA FICHA'; }" +
                        "    if (text.toUpperCase().trim() === 'VISUALIZAR FICHA') {" +
                        "      elements[i].style.setProperty('display', 'none', 'important');" +
                        "      elements[i].style.setProperty('visibility', 'hidden', 'important');" +
                        "    }" +
                        "  }" +
                        "  var actionBtns = document.querySelectorAll('[class*=\"delete\"], [id*=\"delete\"], [aria-label*=\"excluir\"], [class*=\"edit\"], [id*=\"edit\"]');" +
                        "  actionBtns.forEach(btn => { " +
                        "    btn.style.setProperty('display', 'inline-block', 'important'); " +
                        "    btn.style.setProperty('visibility', 'visible', 'important'); " +
                        "  });" +
                        "})();";
                view.loadUrl(jsCustom);

                if (url.toLowerCase().contains("dashboard") || url.toLowerCase().contains("home")) {
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        finalizePageLoad(view, url);
                    }, 500);
                } else {
                    finalizePageLoad(view, url);
                }
            }

            private void finalizePageLoad(WebView view, String url) {
                if (progressBar != null) progressBar.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
                if (splashScreen != null && splashScreen.getVisibility() == View.VISIBLE) {
                    splashScreen.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
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
                        progressBar.setProgress(newProgress);
                    } else {
                        progressBar.setVisibility(View.GONE);
                    }
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "[JS] " + consoleMessage.message());
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                Log.d(TAG, "onPermissionRequest recebido para recursos: " + java.util.Arrays.toString(request.getResources()));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    boolean needsCamera = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            needsCamera = true;
                            break;
                        }
                    }
                    if (needsCamera) {
                        if (ContextCompat.checkSelfPermission(EunamanActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(request.getResources());
                        } else {
                            pendingPermissionRequest = request;
                            ActivityCompat.requestPermissions(EunamanActivity.this, new String[]{Manifest.permission.CAMERA}, REQUEST_CAMERA_WEBVIEW_PERM);
                        }
                    } else {
                        request.grant(request.getResources());
                    }
                }
            }
        });

        EunamanJsBridge bridge = new EunamanJsBridge();
        webView.addJavascriptInterface(bridge, "EunamanApp");
        webView.addJavascriptInterface(bridge, "EunamanCamera");
        
        setupNetworkMonitoring();
    }

    private void setupNetworkMonitoring() {
        ConnectivityManager connectivityManager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (connectivityManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            connectivityManager.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(@NonNull Network network) {
                    runOnUiThread(() -> {
                        if (webView != null) {
                            webView.loadUrl("javascript:(function(){"
                                    + "console.log('[Android] Internet detectada. Sincronizando...');"
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
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    @Override
    public void onConfigurationChanged(@NonNull android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        Log.d(TAG, "Configuração mudada (rotação/teclado), impedindo recarregamento.");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CAMERA && resultCode == Activity.RESULT_OK) {
            processAndSendPhoto();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_CAMERA_PERM && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            launchCamera();
        } else if (requestCode == REQUEST_CAMERA_WEBVIEW_PERM) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && pendingPermissionRequest != null) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                }
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && pendingPermissionRequest != null) {
                    pendingPermissionRequest.deny();
                }
                Toast.makeText(this, "Permissão de câmera negada.", Toast.LENGTH_SHORT).show();
            }
            pendingPermissionRequest = null;
        }
    }

    private void launchCamera() {
        try {
            File photoFile = createTempPhotoFile();
            currentPhotoPath = photoFile.getAbsolutePath();
            photoUri = FileProvider.getUriForFile(this, getPackageName() + ".provider", photoFile);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            startActivityForResult(intent, REQUEST_CAMERA);
        } catch (IOException e) {
            sendErrorToJs("Erro de câmera: " + e.getMessage());
        }
    }

    private File createTempPhotoFile() throws IOException {
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        return File.createTempFile("EUNAMAN_" + timestamp, ".jpg", storageDir);
    }

    private void processAndSendPhoto() {
        new Thread(() -> {
            try {
                BitmapFactory.Options opts = new BitmapFactory.Options();
                opts.inJustDecodeBounds = true;
                BitmapFactory.decodeFile(currentPhotoPath, opts);
                int scale = 1;
                while (opts.outWidth / scale > MAX_IMAGE_SIZE_PX || opts.outHeight / scale > MAX_IMAGE_SIZE_PX) { scale *= 2; }
                opts.inJustDecodeBounds = false;
                opts.inSampleSize = scale;
                Bitmap bitmap = BitmapFactory.decodeFile(currentPhotoPath, opts);
                bitmap = fixRotation(bitmap, currentPhotoPath);
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, baos);
                String base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                bitmap.recycle();
                sendPhotoToJs("data:image/jpeg;base64," + base64);
            } catch (Exception e) {
                sendErrorToJs("Erro foto: " + e.getMessage());
            }
        }).start();
    }

    private Bitmap fixRotation(Bitmap bitmap, String path) {
        try {
            ExifInterface exif = new ExifInterface(path);
            int orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            Matrix matrix = new Matrix();
            switch (orientation) {
                case ExifInterface.ORIENTATION_ROTATE_90:  matrix.postRotate(90);  break;
                case ExifInterface.ORIENTATION_ROTATE_180: matrix.postRotate(180); break;
                case ExifInterface.ORIENTATION_ROTATE_270: matrix.postRotate(270); break;
                default: return bitmap;
            }
            Bitmap rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
            bitmap.recycle();
            return rotated;
        } catch (IOException e) { return bitmap; }
    }

    private void sendPhotoToJs(String dataUrl) {
        String js = "javascript:(function(){ if(window.onEunamanCameraResult){ window.onEunamanCameraResult(JSON.stringify({success:true,dataUrl:\"" + dataUrl + "\"})); }})();";
        runOnUiThread(() -> { if (webView != null) webView.loadUrl(js); });
    }

    private void performNativeLogout() {
        if (isLoggingOut) return;
        isLoggingOut = true;
        runOnUiThread(() -> {
            if (webView != null) { webView.stopLoading(); webView.pauseTimers(); }
            CookieManager.getInstance().removeAllCookies(success -> {
                CookieManager.getInstance().flush();
                continueLogoutStep2();
            });
        });
    }

    private void continueLogoutStep2() {
        runOnUiThread(() -> {
            if (webView != null) { webView.clearCache(true); webView.clearHistory(); webView.clearFormData(); }
            WebStorage.getInstance().deleteAllData();
            if (webView != null) { webView.loadUrl("javascript:(function(){ localStorage.clear(); sessionStorage.clear(); })();"); }
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (webView != null) { webView.resumeTimers(); webView.loadUrl(getString(R.string.launch_url)); }
                isLoggingOut = false;
            }, 300);
        });
    }

    private class EunamanJsBridge {
        @JavascriptInterface
        public void openCamera() {
            runOnUiThread(() -> {
                if (ContextCompat.checkSelfPermission(EunamanActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    launchCamera();
                } else {
                    ActivityCompat.requestPermissions(EunamanActivity.this, new String[]{Manifest.permission.CAMERA}, REQUEST_CAMERA_PERM);
                }
            });
        }
        @JavascriptInterface
        public void logout() { runOnUiThread(EunamanActivity.this::performNativeLogout); }
        @JavascriptInterface
        public void logPerformance(String message) { Log.d(TAG, "[WEB PERF] " + message); }
    }

    private void sendErrorToJs(String message) {
        String js = "javascript:(function(){ if(window.onEunamanCameraResult){ window.onEunamanCameraResult(JSON.stringify({success:false,error:'" + message + "'})); }})();";
        runOnUiThread(() -> { if (webView != null) webView.loadUrl(js); });
    }
}
