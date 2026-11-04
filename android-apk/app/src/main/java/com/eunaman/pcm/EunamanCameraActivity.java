package com.eunaman.pcm;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;

import java.io.File;
import java.util.concurrent.ExecutionException;

/**
 * Câmera embutida DENTRO do próprio app (CameraX), no mesmo processo da EunamanActivity —
 * ver nota em app/build.gradle sobre por que isso substitui o antigo ACTION_IMAGE_CAPTURE
 * (abria o app de Câmera do sistema, um processo separado que o Android podia encerrar em
 * segundo plano junto com o nosso pra liberar memória, fazendo a WebView recarregar do zero
 * ao voltar). Recebe o caminho de destino do arquivo via EXTRA_OUTPUT_PATH e grava a foto
 * direto lá — EunamanActivity.onActivityResult/processAndSendPhoto continuam iguais, porque
 * só se importam que o arquivo exista em currentPhotoPath ao final, não em como foi criado.
 */
public class EunamanCameraActivity extends AppCompatActivity {

    private static final String TAG = "EunamanCamera";
    public static final String EXTRA_OUTPUT_PATH = "output_path";

    private ImageCapture imageCapture;
    private boolean capturando = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_camera);

        String outputPath = getIntent().getStringExtra(EXTRA_OUTPUT_PATH);
        if (outputPath == null) {
            Log.e(TAG, "EXTRA_OUTPUT_PATH ausente — não há onde salvar a foto.");
            setResult(Activity.RESULT_CANCELED);
            finish();
            return;
        }

        PreviewView previewView = findViewById(R.id.previewView);
        View btnCapturar = findViewById(R.id.btnCapturar);
        View btnFechar = findViewById(R.id.btnFechar);

        btnFechar.setOnClickListener(v -> {
            setResult(Activity.RESULT_CANCELED);
            finish();
        });

        iniciarCamera(previewView);

        btnCapturar.setOnClickListener(v -> capturarFoto(new File(outputPath)));
    }

    private void iniciarCamera(PreviewView previewView) {
        ListenableFuture<ProcessCameraProvider> cameraProviderFuture = ProcessCameraProvider.getInstance(this);
        cameraProviderFuture.addListener(() -> {
            try {
                ProcessCameraProvider cameraProvider = cameraProviderFuture.get();

                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());

                imageCapture = new ImageCapture.Builder()
                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                        .build();

                CameraSelector cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA;

                cameraProvider.unbindAll();
                Camera camera = cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCapture);
                if (camera == null) {
                    throw new IllegalStateException("bindToLifecycle retornou null");
                }
            } catch (ExecutionException | InterruptedException | IllegalStateException e) {
                Log.e(TAG, "Erro ao iniciar a câmera", e);
                Toast.makeText(this, "Não foi possível abrir a câmera.", Toast.LENGTH_SHORT).show();
                setResult(Activity.RESULT_CANCELED);
                finish();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void capturarFoto(File outputFile) {
        if (imageCapture == null || capturando) return;
        capturando = true;

        ImageCapture.OutputFileOptions outputOptions = new ImageCapture.OutputFileOptions.Builder(outputFile).build();

        imageCapture.takePicture(
                outputOptions,
                ContextCompat.getMainExecutor(this),
                new ImageCapture.OnImageSavedCallback() {
                    @Override
                    public void onImageSaved(@NonNull ImageCapture.OutputFileResults outputFileResults) {
                        setResult(Activity.RESULT_OK);
                        finish();
                    }

                    @Override
                    public void onError(@NonNull ImageCaptureException exc) {
                        Log.e(TAG, "Erro ao capturar foto", exc);
                        Toast.makeText(EunamanCameraActivity.this, "Erro ao capturar a foto. Tente de novo.", Toast.LENGTH_SHORT).show();
                        capturando = false;
                    }
                }
        );
    }
}
