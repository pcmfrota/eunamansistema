package com.eunaman.pcm;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

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

    private static final int REQUEST_CAMERA        = 1001;
    private static final int REQUEST_CAMERA_PERM   = 1002;
    private static final int MAX_IMAGE_SIZE_PX     = 1280;
    private static final int JPEG_QUALITY          = 80;

    private WebView webView;
    private Uri     photoUri;

    // ── Ciclo de vida ────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Delega a maior parte do trabalho ao TWA normal;
        // esta activity apenas registra a ponte JS.
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        if (webView != null) {
            webView.addJavascriptInterface(new CameraJsBridge(), "EunamanCamera");
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
                // 1. Decodifica com amostragem para evitar OOM
                BitmapFactory.Options opts = new BitmapFactory.Options();
                opts.inJustDecodeBounds = true;
                BitmapFactory.decodeFile(photoUri.getPath(), opts);

                int scale = 1;
                while (opts.outWidth / scale > MAX_IMAGE_SIZE_PX
                        || opts.outHeight / scale > MAX_IMAGE_SIZE_PX) {
                    scale *= 2;
                }

                opts.inJustDecodeBounds = false;
                opts.inSampleSize = scale;
                Bitmap bitmap = BitmapFactory.decodeFile(photoUri.getPath(), opts);

                if (bitmap == null) {
                    sendErrorToJs("Não foi possível ler a imagem.");
                    return;
                }

                // 2. Corrige rotação EXIF
                bitmap = fixRotation(bitmap, photoUri.getPath());

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

    private void sendErrorToJs(String message) {
        String js = "javascript:(function(){"
                + "if(window.onEunamanCameraResult){"
                + "window.onEunamanCameraResult(JSON.stringify({success:false,error:'" + message + "'}));"
                + "}})();";
        runOnUiThread(() -> {
            if (webView != null) webView.loadUrl(js);
        });
    }

    // ── Ponte JavaScript ─────────────────────────────────────────────────────

    private class CameraJsBridge {

        /**
         * Chamado pelo site web via: EunamanCamera.openCamera()
         * Abre a câmera nativa sem navegar para fora do contexto da página.
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
    }
}
