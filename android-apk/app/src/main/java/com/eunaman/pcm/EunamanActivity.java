package com.eunaman.pcm;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
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
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
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
import java.io.OutputStream;
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
    private static final long PAGE_LOAD_TIMEOUT_MS = 12000;

    private WebView     webView;
    private ProgressBar progressBar;
    private ImageView   splashScreen;
    private String      currentPhotoPath;
    private Uri         photoUri;

    private boolean isLoggingOut = false;
    private static final int REQUEST_FILE_CHOOSER = 1004;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingPhotoDataUrl = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        if (savedInstanceState != null) {
            currentPhotoPath = savedInstanceState.getString("currentPhotoPath");
            photoUri = savedInstanceState.getParcelable("photoUri");
            pendingPhotoDataUrl = savedInstanceState.getString("pendingPhotoDataUrl");
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
                // Se o app foi aberto por um link externo (ex: e-mail de redefinição de senha,
                // que usa App Links para abrir direto no app), carrega essa URL específica.
                // Caso contrário (abertura normal pelo ícone), carrega a tela inicial padrão.
                String deepLinkUrl = extractDeepLinkUrl(getIntent());
                webView.loadUrl(deepLinkUrl != null ? deepLinkUrl : getString(R.string.launch_url));
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        // Como a activity usa launchMode="singleTask", se o app já estiver aberto (em segundo
        // plano) e o usuário tocar em um link (ex: e-mail de redefinição de senha), o Android
        // entrega esse link aqui em vez de recriar a activity via onCreate(). Sem este método,
        // o link era descartado silenciosamente e o app apenas voltava para o primeiro plano
        // na tela em que já estava.
        String deepLinkUrl = extractDeepLinkUrl(intent);
        if (deepLinkUrl != null && webView != null) {
            webView.loadUrl(deepLinkUrl);
        }
    }


    /** Extrai a URL de um Intent de deep link (ACTION_VIEW), ou null se não for um. */
    private String extractDeepLinkUrl(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return null;
        }
        Uri data = intent.getData();
        return data != null ? data.toString() : null;
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
        outState.putString("currentPhotoPath", currentPhotoPath);
        outState.putParcelable("photoUri", photoUri);
        outState.putString("pendingPhotoDataUrl", pendingPhotoDataUrl);
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
        
        // ── PERSISTÊNCIA DE DADOS ──
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        
        // Caminho para armazenamento de banco de dados e LocalStorage
        String databasePath = this.getApplicationContext().getDir("databases", android.content.Context.MODE_PRIVATE).getPath();
        settings.setDatabasePath(databasePath);
        
        // ── ADAPTAÇÃO PARA TABLETS E TELAS GRANDES ──
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(false); // Mantém limpo, usa zoom do site
        
        // Estratégia de Cache Mestra: Prefere cache, busca rede em segundo plano
        settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
        
        // Detecta o User Agent padrão e adiciona identificador do app
        String defaultUA = settings.getUserAgentString();
        settings.setUserAgentString(defaultUA + " EunamanApp/1.1 (Android; Tablet/Mobile)");

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
                
                // Sempre usa o modo padrão: o Service Worker cuidará da inteligência offline.
                // Forçar LOAD_CACHE_ONLY aqui estava impedindo o carregamento de arquivos novos.
                view.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
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
                    // Se falhar a rede no frame principal, mostra tela de erro com opção de limpar cache.
                    String errorHtml = "<html><body style='display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;text-align:center;padding:20px;'>"
                            + "<h2 style='color:#333;'>Erro de Carregamento</h2>"
                            + "<p style='color:#666;'>O sistema não conseguiu carregar os arquivos necessários.</p>"
                            + "<div style='display:flex;gap:10px;flex-direction:column;width:100%;max-width:300px;'>"
                            + "<button onclick='window.location.reload()' style='padding:15px;background:#22c55e;color:white;border:none;border-radius:12px;font-size:16px;font-weight:bold;'>Tentar Novamente</button>"
                            + "<button onclick='EunamanApp.clearCache()' style='padding:12px;background:#f4f4f5;color:#71717a;border:1px solid #e4e4e7;border-radius:12px;font-size:14px;'>Limpar Lixo e Reiniciar</button>"
                            + "</div>"
                            + "</body></html>";
                    view.loadDataWithBaseURL(null, errorHtml, "text/html", "UTF-8", null);
                    
                    if (splashScreen != null) splashScreen.setVisibility(View.GONE);
                    if (progressBar != null) progressBar.setVisibility(View.GONE);
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
                
                // Se chegar a 90% e ainda estiver splash, libera a visão para evitar travas
                if (newProgress > 90 && splashScreen != null && splashScreen.getVisibility() == View.VISIBLE) {
                    splashScreen.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
                Log.d(TAG, "JS_CONSOLE: " + consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of "
                        + consoleMessage.sourceId());
                return true;
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
            
            // Salva na galeria pública antes de redimensionar
            saveImageToGallery(bitmap);

            bitmap = scaleBitmapIfRequired(bitmap);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, baos);
            byte[] imageBytes = baos.toByteArray();
            String base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP);

            String dataUrl = "data:image/jpeg;base64," + base64Image;
            pendingPhotoDataUrl = dataUrl;

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

    private void saveImageToGallery(Bitmap bitmap) {
        try {
            String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            String imageFileName = "EUNAMAN_" + timeStamp + ".jpg";
            
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, imageFileName);
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_DCIM + "/Eunaman");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }
            
            Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri != null) {
                OutputStream out = getContentResolver().openOutputStream(uri);
                if (out != null) {
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 95, out);
                    out.close();
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.clear();
                    values.put(MediaStore.Images.Media.IS_PENDING, 0);
                    getContentResolver().update(uri, values, null, null);
                }
                Log.d(TAG, "Foto salva com sucesso na galeria publica.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao salvar imagem na galeria publica", e);
        }
    }

    private void openDownloadedFile(Uri uri, String mimeType) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao abrir o arquivo", e);
            Toast.makeText(this, "Arquivo salvo. Instale um aplicativo para abrir arquivos do tipo " + mimeType, Toast.LENGTH_LONG).show();
        }
    }

    private class EunamanJsBridge {
        @JavascriptInterface
        public void logout() { runOnUiThread(EunamanActivity.this::performNativeLogout); }

        @JavascriptInterface
        public void clearCache() {
            runOnUiThread(() -> {
                webView.clearCache(true);
                WebStorage.getInstance().deleteAllData();
                CookieManager.getInstance().removeAllCookies(null);
                Toast.makeText(EunamanActivity.this, "Lixo de sistema removido. Reiniciando...", Toast.LENGTH_LONG).show();
                webView.loadUrl(getString(R.string.launch_url));
            });
        }

        @JavascriptInterface
        public void saveBase64File(String base64Data, String filename, String mimeType) {
            runOnUiThread(() -> {
                try {
                    String cleanBase64 = base64Data;
                    if (base64Data.contains(",")) {
                        cleanBase64 = base64Data.split(",")[1];
                    }
                    byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                        values.put(MediaStore.Downloads.IS_PENDING, 1);
                    }

                    String formatName = (mimeType != null && mimeType.contains("pdf")) ? "PDF" : 
                                      ((mimeType != null && (mimeType.contains("excel") || mimeType.contains("sheet"))) || filename.endsWith(".xlsx")) ? "Excel" : "Arquivo";

                    Uri uri = null;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri != null) {
                            OutputStream out = getContentResolver().openOutputStream(uri);
                            if (out != null) {
                                out.write(fileBytes);
                                out.close();
                            }
                            values.clear();
                            values.put(MediaStore.Downloads.IS_PENDING, 0);
                            getContentResolver().update(uri, values, null, null);
                            Toast.makeText(EunamanActivity.this, formatName + " salvo na pasta Downloads: " + filename, Toast.LENGTH_LONG).show();
                            openDownloadedFile(uri, mimeType);
                        } else {
                            Toast.makeText(EunamanActivity.this, "Erro ao salvar arquivo", Toast.LENGTH_SHORT).show();
                        }
                    } else {
                        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        if (!downloadsDir.exists()) {
                            downloadsDir.mkdirs();
                        }
                        File file = new File(downloadsDir, filename);
                        java.io.FileOutputStream fos = new java.io.FileOutputStream(file);
                        fos.write(fileBytes);
                        fos.close();
                        
                        Intent mediaScanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                        mediaScanIntent.setData(Uri.fromFile(file));
                        sendBroadcast(mediaScanIntent);

                        Toast.makeText(EunamanActivity.this, formatName + " salvo na pasta Downloads: " + filename, Toast.LENGTH_LONG).show();
                        
                        try {
                            String authority = getPackageName() + ".provider";
                            Uri contentUri = FileProvider.getUriForFile(EunamanActivity.this, authority, file);
                            openDownloadedFile(contentUri, mimeType);
                        } catch (Exception e) {
                            Log.e(TAG, "Erro ao obter URI do FileProvider para abrir o arquivo", e);
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Erro ao salvar arquivo base64", e);
                    Toast.makeText(EunamanActivity.this, "Erro ao salvar arquivo: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    private class EunamanCameraBridge {
        @JavascriptInterface
        public void openCamera() {
            runOnUiThread(EunamanActivity.this::checkCameraPermissionAndOpen);
        }

        @JavascriptInterface
        public String getPendingPhoto() {
            String photo = pendingPhotoDataUrl;
            pendingPhotoDataUrl = null; // consome
            if (photo != null) {
                return "{\"success\":true,\"dataUrl\":\"" + photo + "\"}";
            }
            return "";
        }
    }
}
