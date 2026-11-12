package com.eunaman.pcm;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.Preview;
import androidx.camera.core.ZoomState;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.exifinterface.media.ExifInterface;

import com.google.common.util.concurrent.ListenableFuture;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Câmera embutida no próprio app (CameraX), no mesmo processo da EunamanActivity — ver
 * nota em app/build.gradle sobre por que isso substitui o antigo ACTION_IMAGE_CAPTURE.
 *
 * Fluxo: preview ao vivo → várias capturas seguidas (miniaturas embaixo) e/ou fotos da
 * galeria (seletor de fotos do Android, sem pedir permissão de armazenamento) → tela de
 * revisão (ampliar, excluir, adicionar mais) → confirmar. Devolve a lista de arquivos em
 * EXTRA_RESULT_PATHS; quem processa/comprime e entrega ao WebView é a EunamanActivity.
 *
 * A permissão de câmera é pedida aqui dentro (não antes de abrir a tela): se negada, a
 * galeria continua funcionando normalmente.
 */
public class EunamanCameraActivity extends AppCompatActivity {

    private static final String TAG = "EunamanCamera";
    public static final String EXTRA_OUTPUT_DIR = "output_dir";
    public static final String EXTRA_MAX_FOTOS = "max_fotos";
    public static final String EXTRA_RESULT_PATHS = "result_paths";
    public static final String EXTRA_RESULT_FROM_CAMERA = "result_from_camera";
    private static final int REQUEST_CAMERA_PERM = 2001;

    private static class Foto {
        final File arquivo;
        final boolean daCamera;

        Foto(File arquivo, boolean daCamera) {
            this.arquivo = arquivo;
            this.daCamera = daCamera;
        }
    }

    private final List<Foto> fotos = new ArrayList<>();
    private final Map<String, Bitmap> cacheMiniaturas = new HashMap<>();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private int maxFotos = 1;
    private File pastaSaida;

    private PreviewView previewView;
    private ProcessCameraProvider cameraProvider;
    private ImageCapture imageCapture;
    private Camera camera;
    private int lente = CameraSelector.LENS_FACING_BACK;
    private int flashMode = ImageCapture.FLASH_MODE_OFF;
    private boolean capturando = false;
    private boolean cameraAtiva = false;
    private boolean pinchando = false;

    private View flashCaptura, btnCapturar, painelRevisao;
    private ImageView btnFlash, btnTrocarCamera, imgRevisao;
    private TextView txtSemCamera, txtZoom, txtDica, btnContinuar, txtTituloRevisao, btnAdicionarMais, btnConfirmar;
    private LinearLayout containerMiniaturas, containerMiniaturasRevisao;
    private int indiceRevisao = 0;

    private ActivityResultLauncher<PickVisualMediaRequest> pickUma;
    private ActivityResultLauncher<PickVisualMediaRequest> pickVarias;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        setContentView(R.layout.activity_camera);

        String dir = getIntent().getStringExtra(EXTRA_OUTPUT_DIR);
        maxFotos = Math.max(1, getIntent().getIntExtra(EXTRA_MAX_FOTOS, 1));
        if (dir == null) {
            Log.e(TAG, "EXTRA_OUTPUT_DIR ausente — não há onde salvar as fotos.");
            setResult(Activity.RESULT_CANCELED);
            finish();
            return;
        }
        pastaSaida = new File(dir);
        //noinspection ResultOfMethodCallIgnored
        pastaSaida.mkdirs();

        // Precisam ser registrados antes do onStart — por isso aqui, com o limite já lido.
        pickUma = registerForActivityResult(new ActivityResultContracts.PickVisualMedia(), uri -> {
            if (uri != null) importarDaGaleria(java.util.Collections.singletonList(uri));
        });
        if (maxFotos >= 2) {
            pickVarias = registerForActivityResult(new ActivityResultContracts.PickMultipleVisualMedia(maxFotos), uris -> {
                if (uris != null && !uris.isEmpty()) importarDaGaleria(uris);
            });
        }

        ligarViews();
        aplicarInsets();
        configurarGestos();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (painelRevisao.getVisibility() == View.VISIBLE) fecharRevisao();
                else pedirCancelamento();
            }
        });

        atualizarInterface();

        if (temPermissaoCamera()) {
            iniciarCamera();
        } else {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, REQUEST_CAMERA_PERM);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Voltou das configurações do Android depois de liberar a permissão manualmente.
        if (!cameraAtiva && cameraProvider == null && temPermissaoCamera()) iniciarCamera();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdown();
    }

    private boolean temPermissaoCamera() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_CAMERA_PERM) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            iniciarCamera();
        } else {
            mostrarSemCamera("Sem permissão para usar a câmera.\nVocê ainda pode escolher fotos da galeria.\n\nToque aqui para liberar nas configurações.", true);
        }
    }

    // ── Views / layout ──

    private void ligarViews() {
        previewView = findViewById(R.id.previewView);
        flashCaptura = findViewById(R.id.flashCaptura);
        txtSemCamera = findViewById(R.id.txtSemCamera);
        txtZoom = findViewById(R.id.txtZoom);
        txtDica = findViewById(R.id.txtDica);
        btnFlash = findViewById(R.id.btnFlash);
        btnTrocarCamera = findViewById(R.id.btnTrocarCamera);
        btnCapturar = findViewById(R.id.btnCapturar);
        btnContinuar = findViewById(R.id.btnContinuar);
        containerMiniaturas = findViewById(R.id.containerMiniaturas);
        painelRevisao = findViewById(R.id.painelRevisao);
        imgRevisao = findViewById(R.id.imgRevisao);
        txtTituloRevisao = findViewById(R.id.txtTituloRevisao);
        containerMiniaturasRevisao = findViewById(R.id.containerMiniaturasRevisao);
        btnAdicionarMais = findViewById(R.id.btnAdicionarMais);
        btnConfirmar = findViewById(R.id.btnConfirmar);

        findViewById(R.id.btnFechar).setOnClickListener(v -> pedirCancelamento());
        findViewById(R.id.btnGaleria).setOnClickListener(v -> abrirGaleria());
        btnCapturar.setOnClickListener(v -> capturar());
        btnFlash.setOnClickListener(v -> alternarFlash());
        btnTrocarCamera.setOnClickListener(v -> trocarCamera());
        btnContinuar.setOnClickListener(v -> abrirRevisao(0));

        findViewById(R.id.btnVoltarCamera).setOnClickListener(v -> fecharRevisao());
        findViewById(R.id.btnExcluirFoto).setOnClickListener(v -> excluirFotoAtual());
        btnAdicionarMais.setOnClickListener(v -> {
            if (maxFotos == 1) {
                // "Tirar outra": descarta a atual e volta pra câmera.
                excluirFotoAtual();
            } else {
                fecharRevisao();
            }
        });
        btnConfirmar.setOnClickListener(v -> finalizar());
    }

    private void aplicarInsets() {
        View raiz = findViewById(R.id.raiz);
        View barraTopo = findViewById(R.id.barraTopo);
        View barraBase = findViewById(R.id.barraBase);
        int p16 = dp(16), p10 = dp(10), p24 = dp(24);
        ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            barraTopo.setPadding(p16, p16 + b.top, p16, p16);
            barraBase.setPadding(0, p10, 0, p24 + b.bottom);
            painelRevisao.setPadding(0, b.top, 0, b.bottom);
            return insets;
        });
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    // ── Câmera ──

    private void iniciarCamera() {
        txtSemCamera.setVisibility(View.GONE);
        ListenableFuture<ProcessCameraProvider> futuro = ProcessCameraProvider.getInstance(this);
        futuro.addListener(() -> {
            try {
                cameraProvider = futuro.get();
                vincularCamera();
            } catch (Exception e) {
                Log.e(TAG, "Erro ao iniciar a câmera", e);
                mostrarSemCamera("Não foi possível abrir a câmera.\nVocê ainda pode escolher fotos da galeria.", false);
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void vincularCamera() {
        if (cameraProvider == null) return;
        try {
            CameraSelector seletor = new CameraSelector.Builder().requireLensFacing(lente).build();
            if (!cameraProvider.hasCamera(seletor)) {
                lente = CameraSelector.LENS_FACING_BACK;
                seletor = CameraSelector.DEFAULT_BACK_CAMERA;
            }

            Preview preview = new Preview.Builder().build();
            preview.setSurfaceProvider(previewView.getSurfaceProvider());

            // MINIMIZE_LATENCY: capturas seguidas mais rápidas — a foto final é reduzida pra
            // 1600px de qualquer jeito na EunamanActivity, então não se perde nitidez útil.
            imageCapture = new ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                    .setFlashMode(flashMode)
                    .build();

            cameraProvider.unbindAll();
            camera = cameraProvider.bindToLifecycle(this, seletor, preview, imageCapture);
            cameraAtiva = true;
        } catch (Exception e) {
            Log.e(TAG, "Erro ao vincular a câmera", e);
            cameraAtiva = false;
            mostrarSemCamera("Não foi possível abrir a câmera.\nVocê ainda pode escolher fotos da galeria.", false);
        }
        atualizarInterface();
    }

    private void mostrarSemCamera(String mensagem, boolean linkConfiguracoes) {
        cameraAtiva = false;
        txtSemCamera.setText(mensagem);
        txtSemCamera.setVisibility(View.VISIBLE);
        txtSemCamera.setOnClickListener(linkConfiguracoes ? v -> {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getPackageName(), null));
            startActivity(i);
        } : null);
        atualizarInterface();
    }

    private boolean temFrontal() {
        try {
            return cameraProvider != null && cameraProvider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA);
        } catch (Exception e) {
            return false;
        }
    }

    private void trocarCamera() {
        if (!cameraAtiva) return;
        lente = (lente == CameraSelector.LENS_FACING_BACK) ? CameraSelector.LENS_FACING_FRONT : CameraSelector.LENS_FACING_BACK;
        vincularCamera();
    }

    private void alternarFlash() {
        if (imageCapture == null) return;
        flashMode = (flashMode == ImageCapture.FLASH_MODE_OFF) ? ImageCapture.FLASH_MODE_ON : ImageCapture.FLASH_MODE_OFF;
        imageCapture.setFlashMode(flashMode);
        atualizarInterface();
        Toast.makeText(this, flashMode == ImageCapture.FLASH_MODE_ON ? "Flash ligado" : "Flash desligado", Toast.LENGTH_SHORT).show();
    }

    private void configurarGestos() {
        ScaleGestureDetector escala = new ScaleGestureDetector(this, new ScaleGestureDetector.SimpleOnScaleGestureListener() {
            @Override
            public boolean onScale(@NonNull ScaleGestureDetector detector) {
                if (camera == null) return false;
                pinchando = true;
                ZoomState z = camera.getCameraInfo().getZoomState().getValue();
                float atual = z != null ? z.getZoomRatio() : 1f;
                float novo = atual * detector.getScaleFactor();
                if (z != null) novo = Math.max(z.getMinZoomRatio(), Math.min(novo, z.getMaxZoomRatio()));
                camera.getCameraControl().setZoomRatio(novo);
                mostrarZoom(novo);
                return true;
            }
        });

        previewView.setOnTouchListener((v, ev) -> {
            escala.onTouchEvent(ev);
            if (ev.getActionMasked() == MotionEvent.ACTION_DOWN) pinchando = false;
            if (ev.getActionMasked() == MotionEvent.ACTION_UP && !pinchando && camera != null) {
                // Toque simples: foco/exposição no ponto tocado.
                MeteringPoint ponto = previewView.getMeteringPointFactory().createPoint(ev.getX(), ev.getY());
                camera.getCameraControl().startFocusAndMetering(new FocusMeteringAction.Builder(ponto).build());
                v.performClick();
            }
            return true;
        });
    }

    private void mostrarZoom(float valor) {
        txtZoom.setText(String.format(Locale.US, "%.1fx", valor));
        txtZoom.setVisibility(View.VISIBLE);
        txtZoom.removeCallbacks(esconderZoom);
        txtZoom.postDelayed(esconderZoom, 900);
    }

    private final Runnable esconderZoom = () -> txtZoom.setVisibility(View.GONE);

    // ── Captura ──

    private void capturar() {
        if (!cameraAtiva || imageCapture == null || capturando) return;
        if (fotos.size() >= maxFotos) {
            Toast.makeText(this, limiteTexto(), Toast.LENGTH_SHORT).show();
            abrirRevisao(fotos.size() - 1);
            return;
        }
        capturando = true;
        flashCaptura.setAlpha(0.8f);
        flashCaptura.animate().alpha(0f).setDuration(220).start();

        File arquivo = new File(pastaSaida, "cam_" + System.currentTimeMillis() + ".jpg");
        ImageCapture.OutputFileOptions opcoes = new ImageCapture.OutputFileOptions.Builder(arquivo).build();
        imageCapture.takePicture(opcoes, ContextCompat.getMainExecutor(this), new ImageCapture.OnImageSavedCallback() {
            @Override
            public void onImageSaved(@NonNull ImageCapture.OutputFileResults results) {
                capturando = false;
                fotos.add(new Foto(arquivo, true));
                atualizarInterface();
                if (maxFotos == 1 || fotos.size() >= maxFotos) abrirRevisao(fotos.size() - 1);
            }

            @Override
            public void onError(@NonNull ImageCaptureException exc) {
                Log.e(TAG, "Erro ao capturar foto", exc);
                capturando = false;
                Toast.makeText(EunamanCameraActivity.this, "Erro ao capturar a foto. Tente de novo.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private String limiteTexto() {
        return maxFotos == 1 ? "Só 1 foto neste campo." : "Limite de " + maxFotos + " fotos neste campo.";
    }

    // ── Galeria ──

    private void abrirGaleria() {
        int restantes = maxFotos - fotos.size();
        if (restantes <= 0) {
            Toast.makeText(this, limiteTexto(), Toast.LENGTH_SHORT).show();
            return;
        }
        PickVisualMediaRequest req = new PickVisualMediaRequest.Builder()
                .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE)
                .build();
        try {
            if (restantes == 1 || pickVarias == null) pickUma.launch(req);
            else pickVarias.launch(req);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao abrir a galeria", e);
            Toast.makeText(this, "Não foi possível abrir a galeria.", Toast.LENGTH_SHORT).show();
        }
    }

    /** Copia as imagens escolhidas pra pasta temporária (a permissão da URI é passageira). */
    private void importarDaGaleria(List<Uri> uris) {
        int restantes = maxFotos - fotos.size();
        if (restantes <= 0) return;
        List<Uri> aceitas = uris.size() > restantes ? uris.subList(0, restantes) : uris;
        if (uris.size() > restantes) {
            Toast.makeText(this, "Só " + restantes + " foto(s) adicionada(s) — " + limiteTexto(), Toast.LENGTH_LONG).show();
        }
        txtDica.setText("Importando " + aceitas.size() + " foto(s)...");
        List<Uri> copia = new ArrayList<>(aceitas);
        executor.execute(() -> {
            List<File> copiados = new ArrayList<>();
            for (Uri uri : copia) {
                File destino = new File(pastaSaida, "gal_" + System.nanoTime() + ".jpg");
                try (InputStream in = getContentResolver().openInputStream(uri);
                     OutputStream out = new FileOutputStream(destino)) {
                    if (in == null) continue;
                    byte[] buf = new byte[16 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    copiados.add(destino);
                } catch (Exception e) {
                    Log.e(TAG, "Erro ao copiar imagem da galeria", e);
                }
            }
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                int primeiraNova = fotos.size();
                for (File f : copiados) {
                    if (fotos.size() < maxFotos) fotos.add(new Foto(f, false));
                }
                atualizarInterface();
                if (copiados.size() < copia.size()) {
                    Toast.makeText(this, "Algumas fotos não puderam ser abertas.", Toast.LENGTH_SHORT).show();
                }
                if (fotos.size() > primeiraNova) abrirRevisao(primeiraNova);
            });
        });
    }

    // ── Interface ──

    private void atualizarInterface() {
        boolean podeCapturar = cameraAtiva && fotos.size() < maxFotos;
        btnCapturar.setAlpha(podeCapturar ? 1f : 0.35f);

        boolean temFlash = cameraAtiva && camera != null && camera.getCameraInfo().hasFlashUnit()
                && lente == CameraSelector.LENS_FACING_BACK;
        btnFlash.setVisibility(temFlash ? View.VISIBLE : View.INVISIBLE);
        btnFlash.setImageResource(flashMode == ImageCapture.FLASH_MODE_ON ? R.drawable.ic_cam_flash_on : R.drawable.ic_cam_flash_off);
        btnTrocarCamera.setVisibility(cameraAtiva && temFrontal() ? View.VISIBLE : View.INVISIBLE);

        if (fotos.isEmpty()) {
            btnContinuar.setVisibility(View.GONE);
            txtDica.setText(maxFotos == 1 ? "Toque no botão para fotografar" : "Tire até " + maxFotos + " fotos ou escolha da galeria");
        } else {
            btnContinuar.setVisibility(View.VISIBLE);
            btnContinuar.setText("Continuar (" + fotos.size() + ")");
            txtDica.setText(fotos.size() + " de " + maxFotos + " foto(s)");
        }
        reconstruirMiniaturas(containerMiniaturas, -1, dp(52));
    }

    private void reconstruirMiniaturas(LinearLayout container, int selecionada, int tamanho) {
        container.removeAllViews();
        for (int i = 0; i < fotos.size(); i++) {
            final int indice = i;
            ImageView iv = new ImageView(this);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(tamanho, tamanho);
            lp.setMargins(dp(4), 0, dp(4), 0);
            iv.setLayoutParams(lp);
            iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
            iv.setPadding(dp(2), dp(2), dp(2), dp(2));
            iv.setBackgroundResource(i == selecionada ? R.drawable.bg_cam_thumb_selected : R.drawable.bg_cam_thumb);
            iv.setClipToOutline(true);
            iv.setOnClickListener(v -> abrirRevisao(indice));
            container.addView(iv);
            carregarMiniatura(fotos.get(i).arquivo, iv);
        }
    }

    private void carregarMiniatura(File arquivo, ImageView destino) {
        Bitmap emCache = cacheMiniaturas.get(arquivo.getAbsolutePath());
        if (emCache != null) {
            destino.setImageBitmap(emCache);
            return;
        }
        executor.execute(() -> {
            Bitmap b = carregarReduzido(arquivo, dp(120));
            if (b == null) return;
            runOnUiThread(() -> {
                cacheMiniaturas.put(arquivo.getAbsolutePath(), b);
                destino.setImageBitmap(b);
            });
        });
    }

    // ── Revisão ──

    private void abrirRevisao(int indice) {
        if (fotos.isEmpty()) return;
        indiceRevisao = Math.max(0, Math.min(indice, fotos.size() - 1));
        painelRevisao.setVisibility(View.VISIBLE);
        atualizarRevisao();
    }

    private void fecharRevisao() {
        painelRevisao.setVisibility(View.GONE);
        imgRevisao.setImageDrawable(null);
        atualizarInterface();
    }

    private void atualizarRevisao() {
        if (fotos.isEmpty()) {
            fecharRevisao();
            return;
        }
        txtTituloRevisao.setText(fotos.size() == 1 ? "1 foto" : "Foto " + (indiceRevisao + 1) + " de " + fotos.size());
        if (maxFotos == 1) {
            btnAdicionarMais.setText("Tirar outra");
            btnAdicionarMais.setVisibility(View.VISIBLE);
            btnConfirmar.setText("Usar foto");
        } else {
            btnAdicionarMais.setText("+ Adicionar mais");
            btnAdicionarMais.setVisibility(fotos.size() < maxFotos ? View.VISIBLE : View.GONE);
            btnConfirmar.setText("Confirmar (" + fotos.size() + ")");
        }
        reconstruirMiniaturas(containerMiniaturasRevisao, indiceRevisao, dp(60));

        final File arquivo = fotos.get(indiceRevisao).arquivo;
        final int largura = Math.max(getResources().getDisplayMetrics().widthPixels, dp(360));
        executor.execute(() -> {
            Bitmap b = carregarReduzido(arquivo, largura);
            runOnUiThread(() -> {
                // Só aplica se o usuário ainda está vendo esta mesma foto.
                if (painelRevisao.getVisibility() == View.VISIBLE && indiceRevisao < fotos.size()
                        && fotos.get(indiceRevisao).arquivo.equals(arquivo)) {
                    imgRevisao.setImageBitmap(b);
                }
            });
        });
    }

    private void excluirFotoAtual() {
        if (fotos.isEmpty()) return;
        Foto removida = fotos.remove(indiceRevisao);
        cacheMiniaturas.remove(removida.arquivo.getAbsolutePath());
        //noinspection ResultOfMethodCallIgnored
        removida.arquivo.delete();
        if (fotos.isEmpty()) {
            fecharRevisao();
        } else {
            indiceRevisao = Math.min(indiceRevisao, fotos.size() - 1);
            atualizarRevisao();
        }
    }

    // ── Finalizar / cancelar ──

    private void finalizar() {
        if (fotos.isEmpty()) {
            fecharRevisao();
            return;
        }
        ArrayList<String> caminhos = new ArrayList<>();
        boolean[] daCamera = new boolean[fotos.size()];
        for (int i = 0; i < fotos.size(); i++) {
            caminhos.add(fotos.get(i).arquivo.getAbsolutePath());
            daCamera[i] = fotos.get(i).daCamera;
        }
        Intent resultado = new Intent();
        resultado.putStringArrayListExtra(EXTRA_RESULT_PATHS, caminhos);
        resultado.putExtra(EXTRA_RESULT_FROM_CAMERA, daCamera);
        setResult(Activity.RESULT_OK, resultado);
        finish();
    }

    private void pedirCancelamento() {
        if (fotos.isEmpty()) {
            cancelar();
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle("Descartar fotos?")
                .setMessage(fotos.size() == 1 ? "A foto tirada será descartada." : "As " + fotos.size() + " fotos serão descartadas.")
                .setNegativeButton("Continuar aqui", null)
                .setPositiveButton("Descartar", (d, w) -> cancelar())
                .show();
    }

    private void cancelar() {
        for (Foto f : fotos) {
            //noinspection ResultOfMethodCallIgnored
            f.arquivo.delete();
        }
        fotos.clear();
        setResult(Activity.RESULT_CANCELED);
        finish();
    }

    // ── Bitmaps ──

    /** Decodifica reduzido (lado menor ~alvoPx) já com a rotação EXIF aplicada. */
    private static Bitmap carregarReduzido(File arquivo, int alvoPx) {
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(arquivo.getAbsolutePath(), o);
            if (o.outWidth <= 0 || o.outHeight <= 0) return null;
            int amostra = 1;
            while (Math.min(o.outWidth, o.outHeight) / (amostra * 2) >= alvoPx) amostra *= 2;
            BitmapFactory.Options d = new BitmapFactory.Options();
            d.inSampleSize = amostra;
            Bitmap b = BitmapFactory.decodeFile(arquivo.getAbsolutePath(), d);
            if (b == null) return null;
            int graus = new ExifInterface(arquivo.getAbsolutePath()).getRotationDegrees();
            if (graus == 0) return b;
            Matrix m = new Matrix();
            m.postRotate(graus);
            Bitmap r = Bitmap.createBitmap(b, 0, 0, b.getWidth(), b.getHeight(), m, true);
            if (r != b) b.recycle();
            return r;
        } catch (Exception e) {
            Log.e(TAG, "Erro ao carregar imagem", e);
            return null;
        }
    }
}
