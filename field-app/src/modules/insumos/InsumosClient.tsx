"use client";
// Construído do zero no design nativo (Fase 6) — o componente desktop
// (app/insumos/InsumosClient.tsx + FichaAbastecimentoWizard.tsx + RecargaModal.tsx,
// ~5500 linhas no total) foi usado só como referência de campos/regras de negócio,
// nunca como ponto de partida de layout (ver plano, "Fase 6").
//
// ESCOPO DESTA VERSÃO (decisões documentadas no relatório final):
// - Portado: Comboios (lista + status), abrir/continuar Ficha de Abastecimento,
//   cabeçalho, linhas de abastecimento (com os 8 insumos + diesel), fechamento,
//   Recarga (Skid/Almoxarifado/Fornecedor/Outro), Estoque Atual por comboio,
//   Fichas Lançadas (histórico, somente leitura).
// - Fora do escopo (igual critério já usado em Lavagens/Preventivas/Lubrificação):
//   Painel (gráficos agregados) e Cadastros (CRUD de Materiais/Módulos/Impedimentos)
//   — mais escritório/PCM. Também fora: edição de saldo inicial (admin), reabertura
//   de ficha finalizada (admin), auditoria por período, "máquina ad-hoc" por módulo,
//   histórico de alterações, campo Impedimento no fechamento (lista não carregada
//   nesta tela), e edição manual de "entrou" em insumos fora do fluxo de Recarga.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Fuel, Search, Truck, Clock, Droplets, ListChecks, Warehouse, ChevronLeft,
  Plus, Camera, Trash2, Pencil, MoreVertical, Gauge,
} from "lucide-react";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ListRow, Card } from "../../ui/primitives/ListRow";
import { BottomSheet } from "../../ui/primitives/BottomSheet";
import { ActionSheet, ActionSheetItem } from "../../ui/primitives/ActionSheet";
import { ConfirmDialog } from "../../ui/primitives/ConfirmDialog";
import { StatTile } from "../../ui/primitives/StatTile";
import { EmptyState } from "../../ui/primitives/EmptyState";
import { Fab } from "../../ui/primitives/Fab";
import { useToast } from "../../ui/primitives/Toast";
import { INSUMO_TIPOS, labelMaterialInsumo, unidadeMaterialInsumo } from "./config";
import {
  Comboio, Modulo, Material, Colaborador, FichaCompleta, FichaAbastecimento, FichaInsumo,
  LinhaAbastecimento, EstoqueAtualItem, Skid,
  abrirOuCriarFicha, getEstoqueAtualComboio, atualizarCabecalhoFicha, salvarLinhaAbastecimento,
  excluirLinhaAbastecimento, finalizarFicha, getFichasAbastecimento, FichaAbastecimentoResumo,
  getSkidsDisponiveis, criarRecargaFinalizada, RecargaInput, ItemRecargaInput, OrigemRecarga,
} from "./actions";
import {
  deriveComboiosOffline, getEstoqueAtualComboioOffline, abrirOuCriarFichaOffline,
  getSkidsDisponiveisOffline, registrarRecargaOffline,
  enqueueAtualizarCabecalho, enqueueSalvarLinha, enqueueExcluirLinha, enqueueFinalizar,
  persistirFichaLocal, persistirLinhaLocal, removerLinhaLocal,
} from "./offlineInsumos";

function formatarPlaca(placa: string) {
  const m = placa.match(/^([A-Z]{3})(\d[A-Z0-9]{3})$/);
  return m ? `${m[1]} ${m[2]}` : placa;
}
function hoje() { return new Date().toISOString().slice(0, 10); }
function uid() { return (crypto as any).randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }

// ── Compressão de imagem + ponte da câmera nativa — mesmo padrão de Lavagens ──
function compressBase64(dataUrl: string, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; } }
      else { if (h > maxHeight) { w = Math.round((w * maxHeight) / h); h = maxHeight; } }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.drawImage(img, 0, 0, w, h); resolve(canvas.toDataURL("image/jpeg", quality)); }
      else resolve(dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
  });
}

function SignaturePad({ value, onChange }: { value: string; onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  }, []);
  useEffect(() => {
    if (!value && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      hasDrawnRef.current = false;
    }
  }, [value]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: (point.clientX - rect.left) * (canvas.width / rect.width), y: (point.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    const { x, y } = getPos(e); ctx.beginPath(); ctx.moveTo(x, y);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return; e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    const { x, y } = getPos(e); ctx.lineTo(x, y); ctx.stroke(); hasDrawnRef.current = true;
  };
  const end = () => {
    if (!drawingRef.current) return; drawingRef.current = false;
    if (hasDrawnRef.current && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  };
  const limpar = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasDrawnRef.current = false; onChange("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-400">Assinatura</label>
        {value && <button type="button" onClick={limpar} className="text-[10px] font-black text-red-400 uppercase tracking-widest">Limpar</button>}
      </div>
      <div className="rounded-xl border border-zinc-800 bg-white overflow-hidden">
        <canvas ref={canvasRef} width={600} height={160} className="w-full h-[140px] touch-none cursor-crosshair"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      </div>
    </div>
  );
}

function useCameraBridge(onResult: (field: string, dataUrl: string) => void, storageKey: string) {
  useEffect(() => {
    (window as any).onEunamanCameraResult = async (jsonStr: string) => {
      try {
        const result = JSON.parse(jsonStr);
        if (result.success && result.dataUrl) {
          const activeField = localStorage.getItem(storageKey);
          if (activeField) onResult(activeField, await compressBase64(result.dataUrl));
        }
      } catch (e) { console.error("[EunamanCamera] Erro ao processar resultado:", e); }
    };
    const timer = setTimeout(() => {
      if ((window as any).EunamanCamera?.getPendingPhoto) {
        try {
          const pending = (window as any).EunamanCamera.getPendingPhoto();
          if (pending) (window as any).onEunamanCameraResult(pending);
        } catch {}
      }
    }, 500);
    return () => { clearTimeout(timer); delete (window as any).onEunamanCameraResult; };
  }, []);
}

function abrirCamera(field: string, storageKey: string, toast: ReturnType<typeof useToast>) {
  localStorage.setItem(storageKey, field);
  if ((window as any).EunamanCamera?.openCamera) {
    try { (window as any).EunamanCamera.openCamera(); } catch { toast.show("Erro ao abrir a câmera.", "error"); }
  } else {
    toast.show("Câmera nativa disponível apenas no aplicativo instalado.", "info");
  }
}

const STATUS_BADGE = {
  disponivel: <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-black uppercase tracking-wider">Disponível</span>,
  andamento: <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-black uppercase tracking-wider"><Clock size={10} /> Em andamento</span>,
};

type View = "hub" | "fichas";

export default function InsumosClient({
  equipamentos, fichas, fichaInsumos, linhas, materiais, modulos, colaboradores,
}: {
  equipamentos: { id: string; placa: string; tipo: string; modelo?: string | null }[];
  fichas: FichaAbastecimento[];
  fichaInsumos: FichaInsumo[];
  linhas: LinhaAbastecimento[];
  materiais: Material[];
  modulos: Modulo[];
  colaboradores: Colaborador[];
}) {
  const { isOnline } = useOffline();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [view, setView] = useState<View>("hub");
  const [busca, setBusca] = useState("");
  const [fichaAtiva, setFichaAtiva] = useState<FichaCompleta | null>(null);
  const [carregandoId, setCarregandoId] = useState<string | null>(null);
  const [comboioMenu, setComboioMenu] = useState<Comboio | null>(null);
  const [comboioEstoque, setComboioEstoque] = useState<Comboio | null>(null);
  const [comboioRecarga, setComboioRecarga] = useState<Comboio | null>(null);

  // ── Rascunho de "qual ficha está aberta" (sobrevive ao reload que o Android dá na
  // Activity enquanto o app de Câmera nativo está em primeiro plano — ver LinhaForm,
  // que tem o próprio rascunho dos campos da linha; sem este aqui, o reload volta pro
  // Hub inteiro e o usuário nem chega a ver o rascunho da linha restaurado).
  const hasRestoredFichaRef = useRef(false);

  useEffect(() => {
    if (!mounted || !hasRestoredFichaRef.current) return;
    try {
      if (fichaAtiva) {
        localStorage.setItem("eunaman_insumos_ficha_ativa", JSON.stringify(fichaAtiva));
      } else {
        localStorage.removeItem("eunaman_insumos_ficha_ativa");
      }
    } catch (e) {
      console.error("Erro ao salvar rascunho de ficha de insumos:", e);
    }
  }, [fichaAtiva, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const draft = localStorage.getItem("eunaman_insumos_ficha_ativa");
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed && typeof parsed === "object") setFichaAtiva(parsed);
      }
    } catch (e) {
      console.error("Erro ao restaurar rascunho de ficha de insumos:", e);
    } finally {
      hasRestoredFichaRef.current = true;
    }
  }, [mounted]);

  const comboios = useMemo(
    () => deriveComboiosOffline(equipamentos as any, fichas, fichaInsumos),
    [equipamentos, fichas, fichaInsumos]
  );
  const comboiosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return comboios;
    return comboios.filter((c) => c.placa.toLowerCase().includes(termo) || c.modelo?.toLowerCase().includes(termo));
  }, [comboios, busca]);

  const fichasResumo: FichaAbastecimentoResumo[] = useMemo(() => {
    return fichas
      .slice()
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 200)
      .map((f) => {
        const eq = equipamentos.find((e) => e.id === f.equipamento_id);
        const mod = modulos.find((m) => m.id === f.modulo_id);
        const dieselSaido = fichaInsumos
          .filter((fi) => fi.ficha_id === f.id && (fi.insumo_tipo === "DIESEL_T1" || fi.insumo_tipo === "DIESEL_T2"))
          .reduce((s, fi) => s + Number(fi.saiu || 0), 0);
        return {
          id: f.id, numero_sequencial: f.numero_sequencial, data: f.data, turno: f.turno,
          status: f.status, status_baixa: f.status_baixa, placa: eq?.placa || "-",
          modulo_nome: mod?.nome || null, motorista_nome: f.motorista_nome, dieselSaido,
        };
      });
  }, [fichas, fichaInsumos, equipamentos, modulos]);

  async function abrirComboio(comboio: Comboio) {
    setCarregandoId(comboio.id);
    try {
      if (!isOnline) {
        const result = await abrirOuCriarFichaOffline(comboio.id);
        if (result.error || !result.ficha) { toast.show(result.error || "Não foi possível abrir a ficha offline.", "error"); return; }
        setFichaAtiva(result.ficha);
        return;
      }
      const result = await abrirOuCriarFicha(comboio.id);
      if (result.error || !result.ficha) { toast.show(result.error || "Não foi possível abrir a ficha.", "error"); return; }
      setFichaAtiva(result.ficha);
    } catch {
      const result = await abrirOuCriarFichaOffline(comboio.id);
      if (result.error || !result.ficha) { toast.show("Sem conexão e não foi possível abrir a ficha offline.", "error"); return; }
      setFichaAtiva(result.ficha);
    } finally {
      setCarregandoId(null);
    }
  }

  if (fichaAtiva) {
    const comboio = comboios.find((c) => c.id === fichaAtiva.ficha.equipamento_id)!;
    return (
      <FichaScreen
        fichaInicial={fichaAtiva}
        comboio={comboio}
        equipamentos={equipamentos}
        colaboradores={colaboradores}
        isOnline={isOnline}
        toast={toast}
        onVoltar={() => setFichaAtiva(null)}
        onAtualizar={setFichaAtiva}
      />
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {view === "hub" ? (
        <>
          <ListRow
            icon={<ListChecks size={18} />}
            title={`Fichas Lançadas (${fichasResumo.length})`}
            subtitle="Ver histórico de abastecimento"
            onClick={() => setView("fichas")}
          />

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar comboio por placa..."
              className="w-full pl-9 pr-3 py-3 text-sm rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-50 outline-none focus:border-amber-600"
              style={{ minHeight: "var(--tap-min)" }}
            />
          </div>

          {comboiosFiltrados.length === 0 ? (
            <EmptyState icon={Truck} title="Nenhum comboio encontrado" />
          ) : (
            <div className="space-y-2">
              {comboiosFiltrados.map((c) => (
                <ListRow
                  key={c.id}
                  icon={<Truck size={18} />}
                  title={formatarPlaca(c.placa)}
                  subtitle={c.modelo || c.modulo || undefined}
                  meta={`Diesel atual: ${c.saldoDieselAtual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L${c.temRascunho && c.rascunhoLubrificador ? ` · Iniciada por ${c.rascunhoLubrificador}` : ""}`}
                  badge={c.temRascunho ? STATUS_BADGE.andamento : STATUS_BADGE.disponivel}
                  onClick={() => (carregandoId ? null : setComboioMenu(c))}
                  rightSlot={<MoreVertical size={16} className="text-zinc-600" />}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <FichasListaView fichas={fichasResumo} onVoltar={() => setView("hub")} />
      )}

      <ActionSheet
        open={!!comboioMenu}
        onClose={() => setComboioMenu(null)}
        title={comboioMenu ? formatarPlaca(comboioMenu.placa) : undefined}
        items={
          comboioMenu
            ? ([
                {
                  key: "lancamentos", label: carregandoId === comboioMenu.id ? "Abrindo..." : "Lançamentos (Ficha de Abastecimento)",
                  icon: ListChecks, onSelect: () => abrirComboio(comboioMenu),
                },
                { key: "recarga", label: "Recarga de Insumos", icon: Droplets, onSelect: () => setComboioRecarga(comboioMenu) },
                { key: "estoque", label: "Ver Estoque Atual", icon: Warehouse, onSelect: () => setComboioEstoque(comboioMenu) },
              ] as ActionSheetItem[])
            : []
        }
      />

      <BottomSheet open={!!comboioEstoque} onClose={() => setComboioEstoque(null)} title={comboioEstoque ? `Estoque Atual · ${comboioEstoque.placa}` : undefined}>
        {comboioEstoque && (
          <EstoqueAtualView comboio={comboioEstoque} materiais={materiais} fichas={fichas} fichaInsumos={fichaInsumos} isOnline={isOnline} />
        )}
      </BottomSheet>

      {comboioRecarga && (
        <RecargaSheet
          comboio={comboioRecarga}
          modulos={modulos}
          materiais={materiais}
          colaboradores={colaboradores}
          equipamentos={equipamentos}
          isOnline={isOnline}
          toast={toast}
          onClose={() => setComboioRecarga(null)}
        />
      )}
    </div>
  );
}

// ── Estoque Atual (por comboio) ──────────────────────────────────────────────

function EstoqueAtualView({ comboio, materiais, fichas, fichaInsumos, isOnline }: {
  comboio: Comboio; materiais: Material[]; fichas: FichaAbastecimento[]; fichaInsumos: FichaInsumo[]; isOnline: boolean;
}) {
  const [itens, setItens] = useState<EstoqueAtualItem[] | null>(null);
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!isOnline) { if (ativo) setItens(getEstoqueAtualComboioOffline(comboio.id, fichas, fichaInsumos)); return; }
      try {
        const r = await getEstoqueAtualComboio(comboio.id);
        if (ativo) setItens(r);
      } catch {
        if (ativo) setItens(getEstoqueAtualComboioOffline(comboio.id, fichas, fichaInsumos));
      }
    })();
    return () => { ativo = false; };
  }, [comboio.id, isOnline]);

  const temTanque2 = comboio.numero_tanques_diesel >= 2;
  const itensVisiveis = (itens || []).filter((i) => i.insumo_tipo !== "DIESEL_T2" || temTanque2);

  if (!itens) return <p className="text-xs text-zinc-500 text-center py-6">Carregando...</p>;
  return (
    <div className="divide-y divide-zinc-800 pb-2">
      {itensVisiveis.map((i) => (
        <div key={i.insumo_tipo} className="flex items-center justify-between py-2.5">
          <span className="text-xs font-bold text-zinc-300">{labelMaterialInsumo(i.insumo_tipo, materiais, temTanque2)}</span>
          <span className="text-sm font-black text-zinc-50">
            {i.saldoAtual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} {unidadeMaterialInsumo(i.insumo_tipo, materiais)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Fichas Lançadas (histórico, somente leitura) ────────────────────────────

function FichasListaView({ fichas, onVoltar }: { fichas: FichaAbastecimentoResumo[]; onVoltar: () => void }) {
  return (
    <div className="space-y-3">
      <button onClick={onVoltar} className="flex items-center gap-1 text-sm font-bold text-zinc-300" style={{ minHeight: "var(--tap-min)" }}>
        <ChevronLeft size={18} /> Comboios
      </button>
      {fichas.length === 0 ? (
        <EmptyState icon={ListChecks} title="Nenhuma ficha lançada ainda" />
      ) : (
        <div className="space-y-2">
          {fichas.map((f) => (
            <ListRow
              key={f.id}
              icon={<Fuel size={18} />}
              title={`${formatarPlaca(f.placa)} · ${f.data.split("-").reverse().join("/")}`}
              subtitle={`${f.motorista_nome || "Sem motorista"}${f.modulo_nome ? ` · ${f.modulo_nome}` : ""}`}
              meta={`Diesel saído: ${f.dieselSaido.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L · Turno ${f.turno}`}
              badge={
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${f.status === "FINALIZADA" ? "bg-zinc-800 text-zinc-400" : "bg-amber-500/15 text-amber-400"}`}>
                  {f.status === "FINALIZADA" ? "Finalizada" : "Rascunho"}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ficha de Abastecimento (tela cheia — abrir/continuar lançamento) ───────

function FichaScreen({ fichaInicial, comboio, equipamentos, colaboradores, isOnline, toast, onVoltar, onAtualizar }: {
  fichaInicial: FichaCompleta;
  comboio: Comboio;
  equipamentos: { id: string; placa: string; tipo: string }[];
  colaboradores: Colaborador[];
  isOnline: boolean;
  toast: ReturnType<typeof useToast>;
  onVoltar: () => void;
  onAtualizar: (f: FichaCompleta) => void;
}) {
  const { ficha, insumos, linhas } = fichaInicial;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [editCabecalho, setEditCabecalho] = useState(false);
  const [linhaEdit, setLinhaEdit] = useState<LinhaAbastecimento | "nova" | null>(null);
  const [linhaMenu, setLinhaMenu] = useState<LinhaAbastecimento | null>(null);
  const [confirmExcluirLinha, setConfirmExcluirLinha] = useState<LinhaAbastecimento | null>(null);
  const [fecharOpen, setFecharOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // ── Rascunho de "qual linha estava sendo editada" (ver LinhaForm pros campos em si).
  const hasRestoredLinhaEditRef = useRef(false);

  useEffect(() => {
    if (!mounted || !hasRestoredLinhaEditRef.current) return;
    try {
      if (linhaEdit !== null) {
        localStorage.setItem("eunaman_insumos_linha_edit", JSON.stringify(linhaEdit));
      } else {
        localStorage.removeItem("eunaman_insumos_linha_edit");
      }
    } catch (e) {
      console.error("Erro ao salvar rascunho de linha em edição:", e);
    }
  }, [linhaEdit, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const draft = localStorage.getItem("eunaman_insumos_linha_edit");
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed === "nova" || (parsed && typeof parsed === "object")) setLinhaEdit(parsed);
      }
    } catch (e) {
      console.error("Erro ao restaurar rascunho de linha em edição:", e);
    } finally {
      hasRestoredLinhaEditRef.current = true;
    }
  }, [mounted]);

  const temTanque2 = comboio.numero_tanques_diesel >= 2;
  const dieselRestou = insumos.filter((i) => i.insumo_tipo === "DIESEL_T1" || i.insumo_tipo === "DIESEL_T2").reduce((s, i) => s + Number(i.restou || 0), 0);

  async function refetch(fichaIdParaUsar = ficha.id) {
    const [fichasLocal, insumosLocal, linhasLocal] = await Promise.all([
      localDb.getAll<FichaAbastecimento>("insumos_fichas_abastecimento"),
      localDb.getAll<FichaInsumo>("insumos_ficha_insumos"),
      localDb.getAll<LinhaAbastecimento>("insumos_abastecimento_linhas"),
    ]);
    const novaFicha = fichasLocal.find((f) => f.id === fichaIdParaUsar) || ficha;
    onAtualizar({
      ficha: novaFicha,
      insumos: insumosLocal.filter((i) => i.ficha_id === fichaIdParaUsar),
      linhas: linhasLocal.filter((l) => l.ficha_id === fichaIdParaUsar).sort((a, b) => (a.hora_inicial || "").localeCompare(b.hora_inicial || "")),
    });
  }

  async function salvarCabecalho(patch: Partial<FichaAbastecimento>) {
    setSalvando(true);
    try {
      await persistirFichaLocal({ ...ficha, ...patch });
      if (isOnline) {
        const res = await atualizarCabecalhoFicha(ficha.id, patch);
        if (res.error) toast.show(res.error, "error");
      } else {
        await enqueueAtualizarCabecalho(ficha.id, patch);
      }
      await refetch();
      toast.show("Cabeçalho salvo.", "success");
      setEditCabecalho(false);
    } finally {
      setSalvando(false);
    }
  }

  async function salvarLinha(linha: Partial<LinhaAbastecimento> & { id: string }) {
    setSalvando(true);
    try {
      await persistirLinhaLocal({ ...linha, ficha_id: ficha.id } as LinhaAbastecimento);
      if (isOnline) {
        const { id, ...resto } = linha;
        const linhaParaEnviar = id.startsWith("temp_") ? resto : linha;
        const res = await salvarLinhaAbastecimento(ficha.id, linhaParaEnviar);
        if (res.error) toast.show(res.error, "error");
        else if (res.warning) toast.show(res.warning, "info");
      } else {
        await enqueueSalvarLinha(ficha.id, linha);
      }
      await refetch();
      toast.show("Linha salva.", "success");
      setLinhaEdit(null);
    } finally {
      setSalvando(false);
    }
  }

  async function excluirLinha(linha: LinhaAbastecimento) {
    await removerLinhaLocal(linha.id);
    if (isOnline && !linha.id.startsWith("temp_")) {
      const res = await excluirLinhaAbastecimento(linha.id, ficha.id);
      if (res.error) toast.show(res.error, "error");
    } else {
      await enqueueExcluirLinha(ficha.id, linha.id);
    }
    await refetch();
    toast.show("Linha excluída.", "success");
  }

  async function fecharFicha(fechamento: {
    km_horimetro_final: number | null; regua_tanque1_final_cm: number | null; regua_tanque1_final_lts: number | null;
    regua_tanque2_final_cm: number | null; regua_tanque2_final_lts: number | null; observacoes: string | null;
  }) {
    setSalvando(true);
    try {
      const payload = { ...fechamento, codigo_impedimento_id: null };
      await persistirFichaLocal({ ...ficha, ...payload, status: "FINALIZADA" });
      if (isOnline) {
        const res = await finalizarFicha(ficha.id, payload);
        if (res.error) { toast.show(res.error, "error"); return; }
        if (res.alertas?.length) toast.show(res.alertas[0], "info");
      } else {
        await enqueueFinalizar(ficha.id, payload);
      }
      toast.show("Ficha finalizada.", "success");
      setFecharOpen(false);
      onVoltar();
    } finally {
      setSalvando(false);
    }
  }

  const linhaMenuItems: ActionSheetItem[] = linhaMenu
    ? [
        { key: "editar", label: "Editar", icon: Pencil, onSelect: () => setLinhaEdit(linhaMenu) },
        { key: "excluir", label: "Excluir", icon: Trash2, destructive: true, onSelect: () => setConfirmExcluirLinha(linhaMenu) },
      ]
    : [];

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <button onClick={onVoltar} className="flex items-center gap-1 text-sm font-bold text-zinc-300" style={{ minHeight: "var(--tap-min)" }}>
          <ChevronLeft size={18} /> Comboios
        </button>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${ficha.status === "FINALIZADA" ? "bg-zinc-800 text-zinc-400" : "bg-amber-500/15 text-amber-400"}`}>
          {ficha.status === "FINALIZADA" ? "Finalizada" : "Em andamento"}
        </span>
      </div>

      <Card className="p-4 space-y-1">
        <p className="text-lg font-black text-zinc-50 font-mono">{formatarPlaca(comboio.placa)}</p>
        <p className="text-xs text-zinc-500">{ficha.data.split("-").reverse().join("/")} · Turno {ficha.turno}</p>
        <p className="text-xs text-zinc-400">{ficha.motorista_nome || "Motorista não informado"}</p>
        <button onClick={() => setEditCabecalho(true)} className="mt-2 text-xs font-black text-amber-500 uppercase tracking-wider" style={{ minHeight: "var(--tap-min)" }}>
          Editar Cabeçalho
        </button>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <StatTile icon={Droplets} label="Diesel Restou" value={`${dieselRestou.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`} accent="amber" />
        <StatTile icon={ListChecks} label="Linhas Lançadas" value={linhas.length} accent="zinc" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-zinc-400 uppercase tracking-wider">Linhas de Abastecimento</p>
      </div>

      {linhas.length === 0 ? (
        <EmptyState icon={Truck} title="Nenhuma linha lançada ainda" description="Toque em + Nova Linha pra registrar o abastecimento de um equipamento." />
      ) : (
        <div className="space-y-2">
          {linhas.map((l) => (
            <ListRow
              key={l.id}
              icon={<Truck size={18} />}
              title={equipamentos.find((e) => e.id === l.equipamento_id)?.placa || l.equipamento_texto || "—"}
              subtitle={`${l.hora_inicial || "--:--"} às ${l.hora_final || "--:--"}${l.horimetro ? ` · Horímetro ${l.horimetro}` : ""}`}
              meta={`Diesel: ${(l.diesel_litros || 0).toLocaleString("pt-BR")} L (tanque ${l.tanque_diesel || 1})`}
              onClick={() => setLinhaMenu(l)}
              rightSlot={<MoreVertical size={16} className="text-zinc-600" />}
            />
          ))}
        </div>
      )}

      {ficha.status !== "FINALIZADA" && (
        <button
          onClick={() => setFecharOpen(true)}
          className="w-full rounded-xl text-sm font-black text-white bg-emerald-600 active:bg-emerald-700 mt-4"
          style={{ minHeight: "var(--tap-min)" }}
        >
          Fechar Ficha
        </button>
      )}

      {ficha.status !== "FINALIZADA" && (
        <Fab onClick={() => setLinhaEdit("nova")} icon={<Plus size={20} />} label="Nova Linha" />
      )}

      <ActionSheet open={!!linhaMenu} onClose={() => setLinhaMenu(null)} items={linhaMenuItems} />

      <ConfirmDialog
        open={!!confirmExcluirLinha}
        onClose={() => setConfirmExcluirLinha(null)}
        onConfirm={() => confirmExcluirLinha && excluirLinha(confirmExcluirLinha)}
        title="Excluir linha?"
        description="Essa linha de abastecimento será excluída. Os totais da ficha serão recalculados."
        destructive
      />

      <BottomSheet open={editCabecalho} onClose={() => setEditCabecalho(false)} title="Editar Cabeçalho" fullHeight>
        <CabecalhoForm ficha={ficha} colaboradores={colaboradores} temTanque2={temTanque2} salvando={salvando} onSalvar={salvarCabecalho} />
      </BottomSheet>

      <BottomSheet open={linhaEdit !== null} onClose={() => setLinhaEdit(null)} title={linhaEdit === "nova" ? "Nova Linha" : "Editar Linha"} fullHeight>
        {linhaEdit !== null && (
          <LinhaForm
            linhaInicial={linhaEdit === "nova" ? null : linhaEdit}
            equipamentos={equipamentos}
            temTanque2={temTanque2}
            salvando={salvando}
            onSalvar={salvarLinha}
          />
        )}
      </BottomSheet>

      <BottomSheet open={fecharOpen} onClose={() => setFecharOpen(false)} title="Fechar Ficha" fullHeight>
        <FecharForm ficha={ficha} temTanque2={temTanque2} salvando={salvando} onFechar={fecharFicha} />
      </BottomSheet>
    </div>
  );
}

function CabecalhoForm({ ficha, colaboradores, temTanque2, salvando, onSalvar }: {
  ficha: FichaAbastecimento; colaboradores: Colaborador[]; temTanque2: boolean; salvando: boolean;
  onSalvar: (patch: Partial<FichaAbastecimento>) => void;
}) {
  const [turno, setTurno] = useState(ficha.turno);
  const [motoristaId, setMotoristaId] = useState("");
  const [motoristaNome, setMotoristaNome] = useState(ficha.motorista_nome || "");
  const [lubrificadorId, setLubrificadorId] = useState("");
  const [lubrificadorNome, setLubrificadorNome] = useState(ficha.lubrificador_nome || "");
  const [kmInicial, setKmInicial] = useState(String(ficha.km_horimetro_inicial ?? ""));
  const [reguaT1, setReguaT1] = useState(String(ficha.regua_tanque1_inicial_lts ?? ""));
  const [reguaT2, setReguaT2] = useState(String(ficha.regua_tanque2_inicial_lts ?? ""));
  const [obs, setObs] = useState(ficha.observacoes || "");

  const colaboradorOptions = colaboradores.map((c) => ({ value: c.id, label: c.nome }));

  return (
    <div className="space-y-4 pb-4">
      <div>
        <label className="text-xs font-bold text-zinc-400 mb-1 block">Turno</label>
        <div className="flex gap-2">
          {(["1", "2", "3"] as const).map((t) => (
            <button key={t} onClick={() => setTurno(t)}
              className={`flex-1 rounded-xl text-sm font-bold py-3 ${turno === t ? "bg-amber-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"}`}>
              {t}º
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-zinc-400 mb-1 block">Motorista</label>
        <SearchableSelect
          options={colaboradorOptions}
          value={motoristaId}
          onChange={(id) => { setMotoristaId(id); setMotoristaNome(colaboradores.find((c) => c.id === id)?.nome || ""); }}
          placeholder={motoristaNome || "Selecione..."}
        />
      </div>
      <div>
        <label className="text-xs font-bold text-zinc-400 mb-1 block">Lubrificador</label>
        <SearchableSelect
          options={colaboradorOptions}
          value={lubrificadorId}
          onChange={(id) => { setLubrificadorId(id); setLubrificadorNome(colaboradores.find((c) => c.id === id)?.nome || ""); }}
          placeholder={lubrificadorNome || "Selecione..."}
        />
      </div>
      <div>
        <label className="text-xs font-bold text-zinc-400 mb-1 block">Km/Horímetro Inicial</label>
        <input value={kmInicial} onChange={(e) => setKmInicial(e.target.value)} inputMode="decimal"
          className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-zinc-400 mb-1 block">Régua Tanque 1 (L)</label>
          <input value={reguaT1} onChange={(e) => setReguaT1(e.target.value)} inputMode="decimal"
            className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
        </div>
        {temTanque2 && (
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1 block">Régua Tanque 2 (L)</label>
            <input value={reguaT2} onChange={(e) => setReguaT2(e.target.value)} inputMode="decimal"
              className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
          </div>
        )}
      </div>
      <div>
        <label className="text-xs font-bold text-zinc-400 mb-1 block">Observações</label>
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3}
          className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm" />
      </div>
      <button
        disabled={salvando}
        onClick={() => onSalvar({
          turno: turno as any, motorista_nome: motoristaNome || null, lubrificador_nome: lubrificadorNome || null,
          km_horimetro_inicial: kmInicial ? Number(kmInicial) : null,
          regua_tanque1_inicial_lts: reguaT1 ? Number(reguaT1) : null,
          regua_tanque2_inicial_lts: reguaT2 ? Number(reguaT2) : null,
          observacoes: obs || null,
        })}
        className="w-full rounded-xl text-sm font-black text-white bg-amber-600 active:bg-amber-700 disabled:opacity-60"
        style={{ minHeight: "var(--tap-min)" }}
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

const CAMPOS_INSUMO_LINHA: { key: keyof LinhaAbastecimento; label: string }[] = [
  { key: "motor", label: "Hidráulico/Motor" },
  { key: "corrente", label: "Corrente" },
  { key: "graxa", label: "Graxa" },
  { key: "transmissao", label: "Transmissão" },
  { key: "fluido_radiador", label: "Fluido Radiador" },
  { key: "diferencial", label: "Diferencial" },
  { key: "arla", label: "Arla" },
];

function LinhaForm({ linhaInicial, equipamentos, temTanque2, salvando, onSalvar }: {
  linhaInicial: LinhaAbastecimento | null;
  equipamentos: { id: string; placa: string; tipo: string }[];
  temTanque2: boolean;
  salvando: boolean;
  onSalvar: (linha: Partial<LinhaAbastecimento> & { id: string }) => void;
}) {
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [equipamentoId, setEquipamentoId] = useState(linhaInicial?.equipamento_id || "");
  const [horaInicial, setHoraInicial] = useState(linhaInicial?.hora_inicial || "");
  const [horaFinal, setHoraFinal] = useState(linhaInicial?.hora_final || "");
  const [horimetro, setHorimetro] = useState(String(linhaInicial?.horimetro ?? ""));
  const [tanqueDiesel, setTanqueDiesel] = useState<1 | 2>(linhaInicial?.tanque_diesel || 1);
  const [dieselLitros, setDieselLitros] = useState(String(linhaInicial?.diesel_litros ?? ""));
  const [matriculaOperador, setMatriculaOperador] = useState(linhaInicial?.matricula_operador || "");
  const [assinatura, setAssinatura] = useState(linhaInicial?.assinatura_operador_url || "");
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    CAMPOS_INSUMO_LINHA.forEach((c) => { init[c.key as string] = String((linhaInicial as any)?.[c.key] ?? ""); });
    return init;
  });

  useCameraBridge((_field, dataUrl) => setAssinatura(dataUrl), "eunaman_insumos_active_field");

  // ── Rascunho dos campos da linha (sobrevive ao reload que o Android dá na Activity
  // enquanto o app de Câmera nativo está em primeiro plano) — mesmo padrão de
  // CaptacaoClient.tsx/OSClient.tsx, só que consolidando vários useState num objeto só
  // porque este formulário não usa um único `form` de estado.
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!mounted || !hasRestoredRef.current) return;
    try {
      const draft = { equipamentoId, horaInicial, horaFinal, horimetro, tanqueDiesel, dieselLitros, matriculaOperador, assinatura, valores };
      localStorage.setItem("eunaman_insumos_linha_form_draft", JSON.stringify(draft));
    } catch (e) {
      console.error("Erro ao salvar rascunho da linha:", e);
    }
  }, [equipamentoId, horaInicial, horaFinal, horimetro, tanqueDiesel, dieselLitros, matriculaOperador, assinatura, valores, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const draft = localStorage.getItem("eunaman_insumos_linha_form_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed && typeof parsed === "object") {
          if (parsed.equipamentoId !== undefined) setEquipamentoId(parsed.equipamentoId);
          if (parsed.horaInicial !== undefined) setHoraInicial(parsed.horaInicial);
          if (parsed.horaFinal !== undefined) setHoraFinal(parsed.horaFinal);
          if (parsed.horimetro !== undefined) setHorimetro(parsed.horimetro);
          if (parsed.tanqueDiesel !== undefined) setTanqueDiesel(parsed.tanqueDiesel);
          if (parsed.dieselLitros !== undefined) setDieselLitros(parsed.dieselLitros);
          if (parsed.matriculaOperador !== undefined) setMatriculaOperador(parsed.matriculaOperador);
          if (parsed.assinatura !== undefined) setAssinatura(parsed.assinatura);
          if (parsed.valores !== undefined) setValores(parsed.valores);
        }
      }
    } catch (e) {
      console.error("Erro ao restaurar rascunho da linha:", e);
    } finally {
      hasRestoredRef.current = true;
    }
  }, [mounted]);

  // Some embora via reload (JS reinicia do zero, este cleanup não roda) — só quando o
  // usuário realmente fecha a folha (salvando ou cancelando), pra não vazar rascunho de
  // uma linha pra a próxima "Nova Linha" aberta.
  useEffect(() => {
    return () => {
      localStorage.removeItem("eunaman_insumos_linha_form_draft");
    };
  }, []);

  const equipamentoOptions = equipamentos.map((e) => ({ value: e.id, label: e.placa }));

  function salvar() {
    if (!equipamentoId) { toast.show("Selecione o equipamento.", "error"); return; }
    const payload: Partial<LinhaAbastecimento> & { id: string } = {
      id: linhaInicial?.id || uid(),
      equipamento_id: equipamentoId,
      equipamento_texto: equipamentos.find((e) => e.id === equipamentoId)?.placa || null,
      hora_inicial: horaInicial || null,
      hora_final: horaFinal || null,
      horimetro: horimetro ? Number(horimetro) : null,
      tanque_diesel: tanqueDiesel,
      diesel_litros: dieselLitros ? Number(dieselLitros) : 0,
      matricula_operador: matriculaOperador || null,
      assinatura_operador_url: assinatura || null,
    };
    CAMPOS_INSUMO_LINHA.forEach((c) => { (payload as any)[c.key] = valores[c.key as string] ? Number(valores[c.key as string]) : 0; });
    onSalvar(payload);
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <label className="text-xs font-bold text-zinc-400 mb-1 block">Equipamento *</label>
        <SearchableSelect options={equipamentoOptions} value={equipamentoId} onChange={setEquipamentoId} placeholder="Selecione o equipamento..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-zinc-400 mb-1 block">Hora Inicial</label>
          <input type="time" value={horaInicial} onChange={(e) => setHoraInicial(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-400 mb-1 block">Hora Final</label>
          <input type="time" value={horaFinal} onChange={(e) => setHoraFinal(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-zinc-400 mb-1 block">Horímetro</label>
        <input value={horimetro} onChange={(e) => setHorimetro(e.target.value)} inputMode="decimal"
          className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-zinc-400 mb-1 block">Diesel (L)</label>
          <input value={dieselLitros} onChange={(e) => setDieselLitros(e.target.value)} inputMode="decimal"
            className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
        </div>
        {temTanque2 && (
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1 block">Tanque</label>
            <div className="flex gap-2">
              {[1, 2].map((t) => (
                <button key={t} onClick={() => setTanqueDiesel(t as 1 | 2)}
                  className={`flex-1 rounded-xl text-sm font-bold py-3 ${tanqueDiesel === t ? "bg-amber-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"}`}>
                  {t}º
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs font-black text-zinc-400 uppercase tracking-wider pt-2">Outros Insumos</p>
      <div className="grid grid-cols-2 gap-3">
        {CAMPOS_INSUMO_LINHA.map((c) => (
          <div key={c.key as string}>
            <label className="text-xs font-bold text-zinc-400 mb-1 block">{c.label}</label>
            <input
              value={valores[c.key as string]}
              onChange={(e) => setValores((p) => ({ ...p, [c.key as string]: e.target.value }))}
              inputMode="decimal"
              className="w-full px-3 py-2.5 rounded-xl bg-white text-zinc-900 text-sm font-bold"
              style={{ minHeight: "var(--tap-min)" }}
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs font-bold text-zinc-400 mb-1 block">Matrícula do Operador</label>
        <input value={matriculaOperador} onChange={(e) => setMatriculaOperador(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-400 block">Assinatura ou Foto do Operador</label>
        {assinatura ? (
          <button onClick={() => abrirCamera("assinatura", "eunaman_insumos_active_field", toast)} className="relative aspect-video w-full rounded-xl overflow-hidden border border-zinc-800">
            <img src={assinatura} className="w-full h-full object-contain bg-white" />
          </button>
        ) : (
          <button onClick={() => abrirCamera("assinatura", "eunaman_insumos_active_field", toast)}
            className="w-full aspect-video rounded-xl border border-dashed border-zinc-700 bg-zinc-900 flex flex-col items-center justify-center gap-1">
            <Camera size={20} className="text-zinc-500" />
            <span className="text-[10px] font-bold text-zinc-500">Tirar foto</span>
          </button>
        )}
        <SignaturePad value={assinatura} onChange={setAssinatura} />
      </div>

      <button
        disabled={salvando}
        onClick={salvar}
        className="w-full rounded-xl text-sm font-black text-white bg-amber-600 active:bg-amber-700 disabled:opacity-60"
        style={{ minHeight: "var(--tap-min)" }}
      >
        {salvando ? "Salvando..." : "Salvar Linha"}
      </button>
    </div>
  );
}

function FecharForm({ ficha, temTanque2, salvando, onFechar }: {
  ficha: FichaAbastecimento; temTanque2: boolean; salvando: boolean;
  onFechar: (f: { km_horimetro_final: number | null; regua_tanque1_final_cm: number | null; regua_tanque1_final_lts: number | null; regua_tanque2_final_cm: number | null; regua_tanque2_final_lts: number | null; observacoes: string | null }) => void;
}) {
  const [kmFinal, setKmFinal] = useState(String(ficha.km_horimetro_final ?? ""));
  const [reguaT1, setReguaT1] = useState(String(ficha.regua_tanque1_final_lts ?? ""));
  const [reguaT2, setReguaT2] = useState(String(ficha.regua_tanque2_final_lts ?? ""));
  const [obs, setObs] = useState(ficha.observacoes || "");

  return (
    <div className="space-y-4 pb-4">
      <p className="text-xs text-zinc-400">Confirme os dados finais e feche a ficha. Depois de fechada, ela só pode ser reaberta por um administrador.</p>
      <div>
        <label className="text-xs font-bold text-zinc-400 mb-1 block">Km/Horímetro Final</label>
        <input value={kmFinal} onChange={(e) => setKmFinal(e.target.value)} inputMode="decimal"
          className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-zinc-400 mb-1 block">Régua Tanque 1 Final (L)</label>
          <input value={reguaT1} onChange={(e) => setReguaT1(e.target.value)} inputMode="decimal"
            className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
        </div>
        {temTanque2 && (
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1 block">Régua Tanque 2 Final (L)</label>
            <input value={reguaT2} onChange={(e) => setReguaT2(e.target.value)} inputMode="decimal"
              className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
          </div>
        )}
      </div>
      <div>
        <label className="text-xs font-bold text-zinc-400 mb-1 block">Observações</label>
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm" />
      </div>
      <button
        disabled={salvando}
        onClick={() => onFechar({
          km_horimetro_final: kmFinal ? Number(kmFinal) : null,
          regua_tanque1_final_cm: null, regua_tanque1_final_lts: reguaT1 ? Number(reguaT1) : null,
          regua_tanque2_final_cm: null, regua_tanque2_final_lts: reguaT2 ? Number(reguaT2) : null,
          observacoes: obs || null,
        })}
        className="w-full rounded-xl text-sm font-black text-white bg-emerald-600 active:bg-emerald-700 disabled:opacity-60"
        style={{ minHeight: "var(--tap-min)" }}
      >
        {salvando ? "Fechando..." : "Confirmar Fechamento"}
      </button>
    </div>
  );
}

// ── Recarga (Skid/Almoxarifado/Fornecedor/Outro → Comboio) ──────────────────

const ORIGENS: { value: OrigemRecarga; label: string }[] = [
  { value: "SKID", label: "Skid" },
  { value: "ALMOXARIFADO", label: "Almoxarifado" },
  { value: "FORNECEDOR", label: "Fornecedor" },
  { value: "OUTRO", label: "Outro" },
];

function RecargaSheet({ comboio, modulos, materiais, colaboradores, equipamentos, isOnline, toast, onClose }: {
  comboio: Comboio; modulos: Modulo[]; materiais: Material[]; colaboradores: Colaborador[];
  equipamentos: { id: string; placa: string; tipo: string }[]; isOnline: boolean; toast: ReturnType<typeof useToast>; onClose: () => void;
}) {
  const [origem, setOrigem] = useState<OrigemRecarga>("SKID");
  const [skidId, setSkidId] = useState("");
  const [deposito, setDeposito] = useState("");
  const [outroTexto, setOutroTexto] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [observacao, setObservacao] = useState("");
  const [assinatura, setAssinatura] = useState("");
  const [itens, setItens] = useState<(ItemRecargaInput & { key: string })[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [skids, setSkids] = useState<Skid[]>([]);

  useEffect(() => {
    (async () => {
      if (isOnline) {
        try { setSkids(await getSkidsDisponiveis()); return; } catch {}
      }
      const { getSkidsDisponiveisOffline } = await import("./offlineInsumos");
      setSkids(getSkidsDisponiveisOffline(equipamentos as any));
    })();
  }, [isOnline]);

  const materialOptions = materiais.map((m) => ({ value: m.id, label: `${m.material} (${m.unidade})` }));
  const colaboradorOptions = colaboradores.map((c) => ({ value: c.id, label: c.nome }));
  const skidOptions = skids.map((s) => ({ value: s.id, label: s.placa }));

  function addItem() {
    setItens((p) => [...p, { key: uid(), material_id: "", quantidade: 0, req_nf: null, tanque_diesel: null }]);
  }

  async function salvar() {
    if (!itens.length) { toast.show("Adicione pelo menos um item.", "error"); return; }
    if (itens.some((i) => !i.material_id || !i.quantidade)) { toast.show("Preencha material e quantidade em todos os itens.", "error"); return; }
    if ((origem === "ALMOXARIFADO" || origem === "FORNECEDOR") && itens.some((i) => !i.req_nf?.trim())) {
      toast.show("REQ/NF é obrigatório pra origem Almoxarifado ou Fornecedor.", "error");
      return;
    }
    setSalvando(true);
    try {
      const input: RecargaInput = {
        equipamento_id: comboio.id, modulo_id: null, turno: null, data: hoje(), hora: new Date().toTimeString().slice(0, 5),
        motorista_nome: null, motorista_matricula: null, observacao: observacao || null,
        origem_tipo: origem, origem_skid_id: origem === "SKID" ? skidId || null : null,
        origem_deposito: origem === "ALMOXARIFADO" ? deposito || null : null,
        origem_outro_texto: origem === "OUTRO" ? outroTexto || null : null,
        local_recarga: null, responsavel_nome: responsavelNome || null, responsavel_matricula: null,
        responsavel_assinatura_url: assinatura || null,
        itens: itens.map(({ key, ...i }) => i),
      };
      if (isOnline) {
        const res = await criarRecargaFinalizada(input);
        if (res.error) { toast.show(res.error, "error"); return; }
      } else {
        const { registrarRecargaOffline } = await import("./offlineInsumos");
        await registrarRecargaOffline(input);
      }
      toast.show("Recarga registrada.", "success");
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={`Recarga · ${formatarPlaca(comboio.placa)}`} fullHeight>
      <div className="space-y-4 pb-4">
        <div>
          <label className="text-xs font-bold text-zinc-400 mb-1 block">Origem</label>
          <div className="grid grid-cols-2 gap-2">
            {ORIGENS.map((o) => (
              <button key={o.value} onClick={() => setOrigem(o.value)}
                className={`rounded-xl text-sm font-bold py-3 ${origem === o.value ? "bg-amber-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {origem === "SKID" && (
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1 block">Skid</label>
            <SearchableSelect options={skidOptions} value={skidId} onChange={setSkidId} placeholder="Selecione o skid..." />
          </div>
        )}
        {origem === "ALMOXARIFADO" && (
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1 block">Depósito</label>
            <input value={deposito} onChange={(e) => setDeposito(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
          </div>
        )}
        {origem === "OUTRO" && (
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1 block">Descrição</label>
            <input value={outroTexto} onChange={(e) => setOutroTexto(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }} />
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs font-black text-zinc-400 uppercase tracking-wider">Itens</p>
          <button onClick={addItem} className="text-xs font-black text-amber-500 uppercase tracking-wider flex items-center gap-1" style={{ minHeight: "var(--tap-min)" }}>
            <Plus size={14} /> Adicionar
          </button>
        </div>
        {itens.map((item, idx) => (
          <Card key={item.key} className="p-3 space-y-2">
            <SearchableSelect
              options={materialOptions}
              value={item.material_id}
              onChange={(v) => setItens((p) => p.map((i) => (i.key === item.key ? { ...i, material_id: v } : i)))}
              placeholder="Material..."
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={item.quantidade || ""}
                onChange={(e) => setItens((p) => p.map((i) => (i.key === item.key ? { ...i, quantidade: Number(e.target.value) || 0 } : i)))}
                placeholder="Quantidade" inputMode="decimal"
                className="w-full px-3 py-2.5 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }}
              />
              <input
                value={item.req_nf || ""}
                onChange={(e) => setItens((p) => p.map((i) => (i.key === item.key ? { ...i, req_nf: e.target.value } : i)))}
                placeholder="REQ/NF" className="w-full px-3 py-2.5 rounded-xl bg-white text-zinc-900 text-sm font-bold" style={{ minHeight: "var(--tap-min)" }}
              />
            </div>
            <button onClick={() => setItens((p) => p.filter((i) => i.key !== item.key))} className="text-[10px] font-black text-red-400 uppercase tracking-widest">
              Remover item
            </button>
          </Card>
        ))}

        <div>
          <label className="text-xs font-bold text-zinc-400 mb-1 block">Responsável</label>
          <SearchableSelect
            options={colaboradorOptions}
            value={responsavelId}
            onChange={(id) => { setResponsavelId(id); setResponsavelNome(colaboradores.find((c) => c.id === id)?.nome || ""); }}
            placeholder={responsavelNome || "Selecione..."}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-400 mb-1 block">Observação</label>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-xl bg-white text-zinc-900 text-sm" />
        </div>
        <SignaturePad value={assinatura} onChange={setAssinatura} />

        <button
          disabled={salvando}
          onClick={salvar}
          className="w-full rounded-xl text-sm font-black text-white bg-amber-600 active:bg-amber-700 disabled:opacity-60"
          style={{ minHeight: "var(--tap-min)" }}
        >
          {salvando ? "Salvando..." : "Registrar Recarga"}
        </button>
      </div>
    </BottomSheet>
  );
}
