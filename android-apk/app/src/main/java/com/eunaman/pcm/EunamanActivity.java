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
import android.webkit.ValueCallback;
import android.webkit.PermissionRequest;
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
 * EunamanActivity — Motor Ultra-Robusto de Alta Disponibilidade.
 * CONFIGURADO PARA OPERAÇÃO 100% OFFLINE E SINCRONIZAÇÃO AUTOMÁTICA.
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
                // Carregamento inteligente: se houver cache, ele abre instantaneamente mesmo offline
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
        
        // ── CONFIGURAÇÕES PARA OFFLINE TOTAL (100% FUNCIONAL) ──
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); 
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        
        // Caminho para armazenamento de banco de dados e LocalStorage
        String databasePath = this.getApplicationContext().getDir("databases", android.content.Context.MODE_PRIVATE).getPath();
        settings.setDatabasePath(databasePath);
        
        // Estratégia de Cache Mestra: Prefere cache, busca rede em segundo plano
        settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
        
        settings.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");

        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (progressBar != null) progressBar.setVisibility(View.VISIBLE);
                
                // Se a rede estiver instável, trava no modo cache para não dar erro
                if (!isNetworkAvailable()) {
                    view.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ONLY);
                } else {
                    view.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // Sincronização agressiva de cookies (Grava a sessão no disco físico)
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
                    // Se falhar a rede, força a carga do que está salvo localmente (Elimina tela de erro)
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

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.getResources());
                }
            }
        });

        webView.addJavascriptInterface(new EunamanJsBridge(), "EunamanApp");
        webView.addJavascriptInterface(new EunamanCameraBridge(), "EunamanCamera");
        setupNetworkMonitoring();
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities capabilities = cm.getNetworkCapabilities(network);
            return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
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
                            // Avisa o site para sincronizar apenas as atualizações offline
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
        } else if (requestCode == REQUEST_CAMERA) {
            if (resultCode == Activity.RESULT_OK) {
                new Thread(this::processAndSendPhoto).start();
            } else {
                sendCameraResultError("Captura de foto cancelada ou falhou.");
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_CAMERA_PERM) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                launchCameraIntent();
            } else {
                Toast.makeText(this, "Permissão de câmera negada", Toast.LENGTH_SHORT).show();
                sendCameraResultError("Permissão de câmera negada");
            }
        }
    }

    private void checkCameraPermissionAndOpen() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, REQUEST_CAMERA_PERM);
        } else {
            launchCameraIntent();
        }
    }

    private void launchCameraIntent() {
        Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        File photoFile = null;
        try {
            photoFile = createImageFile();
        } catch (IOException ex) {
            Log.e(TAG, "Erro ao criar arquivo de imagem", ex);
            sendCameraResultError("Erro ao criar arquivo para salvar a foto.");
            return;
        }
        if (photoFile != null) {
            try {
                String authority = getPackageName() + ".provider";
                photoUri = FileProvider.getUriForFile(this, authority, photoFile);
                takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
                takePictureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                startActivityForResult(takePictureIntent, REQUEST_CAMERA);
            } catch (Exception e) {
                Log.e(TAG, "Erro ao iniciar camera intent", e);
                sendCameraResultError("Não foi possível abrir a câmera: " + e.getMessage());
            }
        }
    }

    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        String imageFileName = "JPEG_" + timeStamp + "_";
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        File image = File.createTempFile(
            imageFileName,  /* prefix */
            ".jpg",         /* suffix */
            storageDir      /* directory */
        );
        currentPhotoPath = image.getAbsolutePath();
        return image;
    }

    private void processAndSendPhoto() {
        if (currentPhotoPath == null) {
            sendCameraResultError("Caminho da foto não encontrado.");
            return;
        }

        File file = new File(currentPhotoPath);
        if (!file.exists()) {
            sendCameraResultError("Arquivo de foto não encontrado.");
            return;
        }

        Bitmap bitmap = null;
        try {
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(currentPhotoPath, options);

            int srcWidth = options.outWidth;
            int srcHeight = options.outHeight;

            int inSampleSize = 1;
            if (srcWidth > MAX_IMAGE_SIZE_PX || srcHeight > MAX_IMAGE_SIZE_PX) {
                int halfWidth = srcWidth / 2;
                int halfHeight = srcHeight / 2;
                while ((halfWidth / inSampleSize) >= MAX_IMAGE_SIZE_PX && (halfHeight / inSampleSize) >= MAX_IMAGE_SIZE_PX) {
                    inSampleSize *= 2;
                }
            }

            options.inJustDecodeBounds = false;
            options.inSampleSize = inSampleSize;
            bitmap = BitmapFactory.decodeFile(currentPhotoPath, options);

            if (bitmap == null) {
                sendCameraResultError("Erro ao decodificar a foto.");
                return;
            }

            bitmap = rotateImageIfRequired(bitmap, currentPhotoPath);
            bitmap = scaleBitmapIfRequired(bitmap);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, baos);
            byte[] imageBytes = baos.toByteArray();
            String base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP);

            String dataUrl = "data:image/jpeg;base64," + base64Image;

            String jsonResponse = "{\"success\":true,\"dataUrl\":\"" + dataUrl + "\"}";
            sendCameraResultToWeb(jsonResponse);

        } catch (Exception e) {
            Log.e(TAG, "Erro ao processar imagem", e);
            sendCameraResultError("Erro ao processar imagem: " + e.getMessage());
        } finally {
            if (bitmap != null && !bitmap.isRecycled()) {
                bitmap.recycle();
            }
            try {
                if (file.exists()) {
                    file.delete();
                }
            } catch (Exception e) {
                Log.w(TAG, "Erro ao deletar arquivo temporario", e);
            }
        }
    }

    private Bitmap rotateImageIfRequired(Bitmap img, String imagePath) throws IOException {
        ExifInterface ei = new ExifInterface(imagePath);
        int orientation = ei.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);

        switch (orientation) {
            case ExifInterface.ORIENTATION_ROTATE_90:
                return rotateImage(img, 90);
            case ExifInterface.ORIENTATION_ROTATE_180:
                return rotateImage(img, 180);
            case ExifInterface.ORIENTATION_ROTATE_270:
                return rotateImage(img, 270);
            default:
                return img;
        }
    }

    private static Bitmap rotateImage(Bitmap img, int degree) {
        Matrix matrix = new Matrix();
        matrix.postRotate(degree);
        Bitmap rotatedImg = Bitmap.createBitmap(img, 0, 0, img.getWidth(), img.getHeight(), matrix, true);
        if (rotatedImg != img) {
            img.recycle();
        }
        return rotatedImg;
    }

    private Bitmap scaleBitmapIfRequired(Bitmap img) {
        int width = img.getWidth();
        int height = img.getHeight();

        if (width <= MAX_IMAGE_SIZE_PX && height <= MAX_IMAGE_SIZE_PX) {
            return img;
        }

        int newWidth, newHeight;
        if (width > height) {
            newWidth = MAX_IMAGE_SIZE_PX;
            newHeight = (height * MAX_IMAGE_SIZE_PX) / width;
        } else {
            newHeight = MAX_IMAGE_SIZE_PX;
            newWidth = (width * MAX_IMAGE_SIZE_PX) / height;
        }

        Bitmap scaledImg = Bitmap.createScaledBitmap(img, newWidth, newHeight, true);
        if (scaledImg != img) {
            img.recycle();
        }
        return scaledImg;
    }

    private void sendCameraResultToWeb(final String jsonString) {
        runOnUiThread(() -> {
            if (webView != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    webView.evaluateJavascript("javascript:if(window.onEunamanCameraResult) { window.onEunamanCameraResult('" + jsonString.replace("\\", "\\\\").replace("'", "\\'") + "'); }", null);
                } else {
                    webView.loadUrl("javascript:if(window.onEunamanCameraResult) { window.onEunamanCameraResult('" + jsonString.replace("\\", "\\\\").replace("'", "\\'") + "'); }");
                }
            }
        });
    }

    private void sendCameraResultError(String errorMessage) {
        String jsonResponse = "{\"success\":false,\"error\":\"" + errorMessage.replace("\"", "\\\"") + "\"}";
        sendCameraResultToWeb(jsonResponse);
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

    private class EunamanCameraBridge {
        @JavascriptInterface
        public void openCamera() {
            runOnUiThread(EunamanActivity.this::checkCameraPermissionAndOpen);
        }
    }
}
