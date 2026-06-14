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
import android.webkit.ValueCallback;
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
 * OTIMIZADO PARA OPERAÇÃO 100% OFFLINE COM SINCRONIZAÇÃO DE DELTA.
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
    private static final int REQUEST_FILE_CHOOSER = 1004;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startTime = System.currentTimeMillis();
        Log.d(TAG, "Iniciando EunamanActivity em modo Offline-First...");
        
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
                webView.restoreState(savedInstanceState);
            } else {
                String url = getString(R.string.launch_url);
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
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        
        // ── CONFIGURAÇÃO DE PERSISTÊNCIA OFFLINE TOTAL ──
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); 
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        
        // Modo de Cache: Prefere sempre o que está no celular (Offline First)
        settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
        
        // Identidade de Desktop para evitar bloqueios do servidor
        settings.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");

        // Habilita Cookies persistentes (Sessão não expira offline)
        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
        
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
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
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
                // Garante que o LocalStorage seja persistido no Android
                view.loadUrl("javascript:(function(){ if(window.localStorage) localStorage.setItem('eunaman_last_sync', Date.now()); })();");

                if (splashScreen != null && splashScreen.getVisibility() == View.VISIBLE) {
                    splashScreen.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                }
                if (progressBar != null) progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    Log.w(TAG, "Offline ou erro de rede. Tentando carregar do cache...");
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progressBar != null) {
                    progressBar.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);
                    progressBar.setProgress(newProgress);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                EunamanActivity.this.filePathCallback = filePathCallback;
                Intent contentSelectionIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentSelectionIntent.setType("image/*");
                startActivityForResult(Intent.createChooser(contentSelectionIntent, "Selecionar Imagem"), REQUEST_FILE_CHOOSER);
                return true;
            }
        });

        webView.addJavascriptInterface(new EunamanJsBridge(), "EunamanApp");
        setupNetworkMonitoring();
    }

    private void setupNetworkMonitoring() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            cm.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(@NonNull Network network) {
                    runOnUiThread(() -> {
                        if (webView != null) {
                            // Quando a internet volta, avisa o site para sincronizar apenas os deltas
                            webView.loadUrl("javascript:(function(){ if(window.onNetworkSync) window.onNetworkSync(); })();");
                        }
                    });
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (filePathCallback != null) {
                Uri[] results = (resultCode == Activity.RESULT_OK && data != null) ? new Uri[]{data.getData()} : null;
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        }
    }

    private void performNativeLogout() {
        isLoggingOut = true;
        CookieManager.getInstance().removeAllCookies(success -> {
            WebStorage.getInstance().deleteAllData();
            runOnUiThread(() -> {
                webView.clearCache(true);
                webView.loadUrl(getString(R.string.launch_url));
                isLoggingOut = false;
            });
        });
    }

    private class EunamanJsBridge {
        @JavascriptInterface
        public void logout() { runOnUiThread(EunamanActivity.this::performNativeLogout); }
    }
}
