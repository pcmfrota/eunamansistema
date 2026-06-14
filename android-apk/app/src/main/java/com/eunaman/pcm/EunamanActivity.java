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
 * EunamanActivity — Motor Ultra-Robusto EUNAMAN PCM.
 * OTIMIZADO PARA 100% OFFLINE COM ZERO TRAVAMENTOS.
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

    private boolean isLoggingOut = false;
    private static final int REQUEST_FILE_CHOOSER = 1004;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
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
                webView.loadUrl(getString(R.string.launch_url));
            }
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
        outState.putString("currentPhotoPath", currentPhotoPath);
        outState.putParcelable("photoUri", photoUri);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        
        // ── CONFIGURAÇÃO DE ALTA PERFORMANCE OFFLINE ──
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); 
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        
        // Aceleração e Prioridade
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        
        // Localização física para persistência
        String databasePath = this.getApplicationContext().getDir("databases", android.content.Context.MODE_PRIVATE).getPath();
        settings.setDatabasePath(databasePath);
        
        settings.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");

        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
        
        // Ativa aceleração de hardware nativa
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (progressBar != null) progressBar.setVisibility(View.VISIBLE);
                
                // Força o modo cache se a rede estiver instável ou offline
                if (!isNetworkAvailable()) {
                    view.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ONLY);
                } else {
                    view.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // Sincronização em background sem travar a UI
                new Thread(() -> CookieManager.getInstance().flush()).start();

                if (splashScreen != null && splashScreen.getVisibility() == View.VISIBLE) {
                    splashScreen.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                }
                if (progressBar != null) progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    // Se falhar, tenta carregar instantaneamente do que está salvo no celular
                    view.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ONLY);
                    view.loadUrl(request.getUrl().toString());
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
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("image/*");
                startActivityForResult(Intent.createChooser(i, "Selecionar Imagem"), REQUEST_FILE_CHOOSER);
                return true;
            }
        });

        webView.addJavascriptInterface(new EunamanJsBridge(), "EunamanApp");
        setupNetworkMonitoring();
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities capabilities = cm.getNetworkCapabilities(network);
            return capabilities != null && (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && 
                   capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED));
        }
        return cm.getActiveNetworkInfo() != null && cm.getActiveNetworkInfo().isConnected();
    }

    private void setupNetworkMonitoring() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            cm.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(@NonNull Network network) {
                    runOnUiThread(() -> {
                        if (webView != null) {
                            webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
                            // Sincroniza dados novos sem recarregar a página
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
        if (requestCode == REQUEST_FILE_CHOOSER && filePathCallback != null) {
            Uri[] results = (resultCode == Activity.RESULT_OK && data != null) ? new Uri[]{data.getData()} : null;
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
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
