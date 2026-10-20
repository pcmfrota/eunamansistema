-- Marca quando o último alerta de CNH vencida foi disparado pra esse registro,
-- pra não notificar admin/PCM de novo a cada carregamento de página (só reavisa
-- depois de alguns dias, ver verificarAlertasCnhVencida em actions.ts).
ALTER TABLE public.controladoria_frota ADD COLUMN IF NOT EXISTS cnh_alerta_enviado_em timestamp with time zone;
