"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Wrench, ChevronRight, Plus, Trash2, Eye, Search, Pencil, CheckCircle2, Camera } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { localDb, deserializeToFormData } from "@/lib/offline-db";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ListRow } from "../../ui/primitives/ListRow";
import { BottomSheet } from "../../ui/primitives/BottomSheet";
import { CHAVE_ABRIR_OS_PENDENTE } from "../../ui/primitives/OfflineSyncSheet";
import { ActionSheet, ActionSheetItem } from "../../ui/primitives/ActionSheet";
import { ConfirmDialog } from "../../ui/primitives/ConfirmDialog";
import { SegmentedTabs } from "../../ui/primitives/SegmentedTabs";
import { EmptyState } from "../../ui/primitives/EmptyState";
import { Fab } from "../../ui/primitives/Fab";
import { useToast } from "../../ui/primitives/Toast";
import { getCurrentLocalDatetime } from "@/src/utils/dateUtils";
import { useNativeCamera } from "../../lib/nativeCamera";
import FichaPreviewModal from "@/components/FichaPreviewModal";
import { gerarHtmlFichaOS, gerarFichaOSPDF, gerarBlobFichaOS, comprimirFotosParaFicha, type OSParaFicha, type FichaComprimida } from "./pdfFichaOS";
import {
  criarOrdemServico,
  atualizarOrdemServico,
  excluirOrdemServico,
  aprovarOrdemServico,
  getOSImagensClient,
} from "./actions";

const STATUS_OPTIONS = ["Aberta", "Programado", "Fechada"] as const;
// Só usado quando a prop `motivos` (lista real, derivada em OSPage.tsx a partir de
// ordens_servico + aux_config — mesma fonte do site, app/os/page.tsx) ainda está vazia —
// mesmo fallback do site (app/os/NovoModal.tsx). Bug anterior: este array chegou a ser a
// ÚNICA lista usada aqui, sem nunca tentar a real, escondendo do mecânico motivos de
// verdade já cadastrados (BASE TEMPO, MOBILIZAÇÃO, OPORTUNIDADE, PROJETO/MELHORIA,
// REVITALIZAÇÃO, FALHA MECÂNICA/OPERACIONAL).
const MOTIVOS_FALLBACK = ["Desgaste Natural", "Quebra Operacional", "Falha Elétrica"];

// Forma "de formulário" de DescricaoAtividade (campos sempre string, nunca null/undefined,
// pra ligar direto em inputs controlados) — convertida pra DescricaoAtividade de verdade só
// na hora de montar o payload (buildFields). Cada bloco de descrição é a atividade de um
// mecânico específico — por isso carrega sua própria assinatura (nome/matrícula/desenho),
// separada da assinatura "Mecânicos Executores" (lista de quem trabalhou na OS como um todo).
type DescricaoAtividadeForm = {
  descricao: string;
  hora_inicio: string;
  hora_fim: string;
  foto: string;
  mecanico_nome: string;
  mecanico_matricula: string;
  mecanico_assinatura: string;
};
const blankDescricaoAtividade = (): DescricaoAtividadeForm => ({
  descricao: "",
  hora_inicio: "",
  hora_fim: "",
  foto: "",
  mecanico_nome: "",
  mecanico_matricula: "",
  mecanico_assinatura: "",
});

// Qual bloco de "Descrições da Atividade" deve abrir primeiro: o primeiro ainda sem texto
// (continua de onde parou), ou o último se todos já estiverem preenchidos.
function indexPrimeiraDescricaoIncompleta(blocos: DescricaoAtividadeForm[]): number {
  const idx = blocos.findIndex((b) => !b.descricao.trim());
  return idx >= 0 ? idx : Math.max(0, blocos.length - 1);
}

// 5 papéis de aprovação — "Supervisor de Manutenção" é o único realmente novo; os outros 4
// já existiam no site (app/os/NovoModal.tsx, CARGOS_LABELS) e agora também aqui, com os
// mesmos campos (nome + matrícula + assinatura) pra ficar idêntico nas duas plataformas.
const CARGOS_LABELS: Record<string, string> = {
  encarregado: "Encarregado / Supervisor",
  pcm: "PCM / Planejamento",
  operador: "Operador / Motorista",
  supervisor_suzano: "Supervisor / Autorizador / Suzano",
  supervisor_manutencao: "Supervisor de Manutenção",
};
type CargoDado = { nome: string; matricula: string; assinatura: string };
const blankCargoDado = (): CargoDado => ({ nome: "", matricula: "", assinatura: "" });
const blankCargos = (): Record<string, CargoDado> =>
  Object.fromEntries(Object.keys(CARGOS_LABELS).map((k) => [k, blankCargoDado()]));

function FotoSlot({ label, url, onCapture, onClear }: { label: string; url?: string; onCapture: () => void; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={url ? onClear : onCapture}
      className="aspect-video rounded-xl border border-dashed border-zinc-700 bg-zinc-900 flex flex-col items-center justify-center gap-1 overflow-hidden relative"
    >
      {url ? (
        <img src={url} className="w-full h-full object-cover" />
      ) : (
        <>
          <Camera size={18} className="text-zinc-500" />
          <span className="text-[9px] font-bold text-zinc-500 text-center px-1">{label}</span>
        </>
      )}
    </button>
  );
}

// Assinatura por toque/mouse num canvas — mesmo padrão já usado em Lubrificação/Lavagens.
function SignaturePad({ label, value, onChange }: { label: string; value: string; onChange: (dataUrl: string) => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawingRef = React.useRef(false);
  const hasDrawnRef = React.useRef(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  // Redesenha a assinatura já salva (e limpa quando o valor for apagado por fora). Sem isso,
  // o canvas só mostrava o que o próprio usuário riscasse NA HORA — reabrir um cargo/
  // descrição que tinha sido recolhido (o componente desmonta e remonta do zero) sempre
  // vinha com o canvas em branco mesmo com a assinatura intacta em `value`, parecendo que
  // tinha "sumido sozinha". Mesma correção aplicada em components/SignaturePad.tsx (usado
  // pelo site) — esta aqui é uma cópia local só do field-app, por isso precisa do fix também.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    if (!value) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawnRef.current = false;
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      hasDrawnRef.current = true;
    };
    img.src = value;
  }, [value]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: (point.clientX - rect.left) * (canvas.width / rect.width), y: (point.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawnRef.current = true;
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (hasDrawnRef.current && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  };

  const limpar = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasDrawnRef.current = false;
    onChange("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-400">{label}</label>
        {value && (
          <button type="button" onClick={limpar} className="text-[10px] font-black text-red-400 uppercase tracking-widest">
            Limpar
          </button>
        )}
      </div>
      <div className="rounded-xl border border-zinc-800 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full h-[120px] touch-none cursor-crosshair"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
    </div>
  );
}

function blankForm() {
  return {
    horario_parada: "",
    data_abertura: getCurrentLocalDatetime(),
    data_fechamento: "",
    status: "Aberta",
    equipamento_id: "",
    placa: "",
    modulo: "",
    horimetro: "",
    km: "",
    operacao_tipo: "",
    local: "",
    foto_horimetro: "",
    foto_km: "",
    descricoes_atividade: [blankDescricaoAtividade()] as DescricaoAtividadeForm[],
    motivo: "",
    observacoes: "",
    cargos: blankCargos(),
    cargosPulados: [] as string[],
    fotos: [] as string[],
  };
}

export default function OSClient({
  equipamentos,
  colaboradores,
  ordensIniciais,
  motivos = [],
}: {
  equipamentos: any[];
  colaboradores: any[];
  ordensIniciais: any[];
  motivos?: string[];
}) {
  const { isOnline } = useOffline();
  const { profile } = useAuth();
  const toast = useToast();

  const role = (profile?.role || "").toLowerCase().trim();
  // Aprovação em duas etapas — PCM e Supervisor de Manutenção validam separadamente (mesma
  // regra de actions.ts/etapasExigidas; admin valida qualquer etapa pendente).
  const podeAprovarPcm = role === "admin" || role === "pcm";
  const podeAprovarSupervisor = role === "admin" || role === "supervisor_manutencao";
  const podeAprovar = podeAprovarPcm || podeAprovarSupervisor;
  const podeCriar = role !== "visitante";
  const podeExcluir = role === "admin" || role === "pcm" || role === "gestao";

  // Etapa (se houver) que o cargo do usuário autoriza validar NESTA OS especificamente.
  const podeAprovarEstaOS = (o: any) => {
    if (role === "admin") return o.aprovado === false;
    if (role === "pcm") return o.aprovado_pcm === false;
    if (role === "supervisor_manutencao") return o.aprovado_supervisor === false;
    return false;
  };
  // Etapa a enviar pro servidor: admin aprova de uma vez tudo que estiver pendente (etapa
  // indefinida = aprovarOrdemServico resolve sozinho); PCM/Supervisor validam só a própria.
  const minhaEtapaAprovacao = (): "pcm" | "supervisor" | undefined => {
    if (role === "pcm") return "pcm";
    if (role === "supervisor_manutencao") return "supervisor";
    return undefined;
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [ordens, setOrdens] = useState<any[]>(ordensIniciais);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"lista" | "validacao">("lista");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm());
  const [salvando, setSalvando] = useState(false);
  // Qual cargo de "Aprovações" está com os campos abertos agora — as linhas começam
  // suspensas (só o nome do papel) e só abrem nome/matrícula/assinatura ao tocar.
  const [cargoExpandido, setCargoExpandido] = useState<string | null>(null);
  // Mesma ideia, pra "Descrições da Atividade": só um bloco aberto por vez. Ao concluir um
  // (botão "Concluir Descrição"), recolhe e abre o próximo — criando um novo em branco se
  // esse era o último. null = nenhum aberto (ex: ao editar uma OS já toda preenchida).
  const [descricaoExpandida, setDescricaoExpandida] = useState<number | null>(0);

  const [actionItem, setActionItem] = useState<any>(null);
  // Ficha oficial (mesmo layout do site, ver pdfFichaOS.ts) — visualizar/baixar/compartilhar.
  const [fichaData, setFichaData] = useState<OSParaFicha | null>(null);
  // Foto pequena (na ficha) -> original em resolução cheia — pra foto ampliada não ficar
  // borrada (ver comprimirFotosParaFicha/FichaPreviewModal).
  const [fichaAltaResolucao, setFichaAltaResolucao] = useState<Map<string, string> | null>(null);
  // Texto do overlay de carregamento — null = escondido. Cobre tanto "abrir a ficha" (busca +
  // encolhe as fotos) quanto o raro caso de ainda não ter o PDF em cache ao clicar em Baixar/
  // Compartilhar.
  const [fichaBusyMsg, setFichaBusyMsg] = useState<string | null>(null);
  // Cache do PDF já gerado por OS — evita rodar html2canvas/jsPDF de novo (o gargalo real) a
  // cada clique em Baixar/Compartilhar da MESMA ficha sem mudanças. Guarda a Promise (não só
  // o Blob) pra também cobrir o caso de clicar enquanto a geração em segundo plano ainda está
  // rodando — nesse caso só espera a mesma Promise em vez de começar uma segunda em paralelo.
  // A chave inclui uma assinatura do conteúdo (JSON.stringify da própria ficha): qualquer
  // alteração (foto nova, assinatura, validação) já muda a assinatura e invalida sozinho.
  // Espera 2 frames de animação — tempo suficiente pro navegador pintar um estado (ex: o
  // overlay de spinner) já aplicado por um setState antes de rodar algo pesado em seguida
  // (html2canvas), que trava a thread principal e não deixa nenhuma pintura pendente aparecer.
  const aguardarRepaint = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const fichaPdfCacheRef = useRef<Map<string, { assinatura: string; promise: Promise<Blob> }>>(new Map());
  const getOrGerarBlobFicha = (os: OSParaFicha): Promise<Blob> => {
    const assinatura = JSON.stringify(os);
    const cache = fichaPdfCacheRef.current.get(os.id);
    if (cache && cache.assinatura === assinatura) return cache.promise;
    const promise = gerarBlobFichaOS(os);
    fichaPdfCacheRef.current.set(os.id, { assinatura, promise });
    return promise;
  };
  // Cache dos dados já buscados (fotos/assinatura/descrições — o que demora é a ida ao
  // Supabase, não ficou no card da lista de propósito) e já comprimidos pra ficha. Guarda a
  // Promise (não só o resultado) pra dar pra PRÉ-buscar assim que o usuário toca na linha da
  // OS (abre o ActionSheet) — na hora em que ele de fato toca em "Ver Ficha", a busca já
  // pode ter terminado em segundo plano, sem nem precisar mostrar o spinner. `resolvido`
  // marca quando já terminou, só pra decidir se mostra "Carregando ficha..." ou não. Uma vez
  // fechada/validada, a OS não muda mais, então reusar aqui é seguro.
  const fichaDadosCacheRef = useRef<Map<string, { promise: Promise<FichaComprimida>; resolvido?: FichaComprimida }>>(new Map());
  const carregarDadosFicha = (o: any) => {
    const cacheKey = String(o.id);
    const existente = fichaDadosCacheRef.current.get(cacheKey);
    if (existente) return existente;
    const entry = {} as { promise: Promise<FichaComprimida>; resolvido?: FichaComprimida };
    entry.promise = (async () => {
      let fotosExtra: any = {};
      if (isOnline && !cacheKey.startsWith("temp_")) {
        const res = await getOSImagensClient(o.id);
        if (res && "data" in res && res.data) fotosExtra = res.data;
      }
      const resultado = await comprimirFotosParaFicha({ ...o, ...fotosExtra });
      entry.resolvido = resultado;
      return resultado;
    })();
    fichaDadosCacheRef.current.set(cacheKey, entry);
    return entry;
  };
  // Dispara a busca assim que o usuário toca na OS na lista (antes mesmo de tocar em "Ver
  // Ficha" no ActionSheet) — puro ganho de tempo, não mostra nada na tela por si só.
  const prefetchFichaDados = (o: any) => {
    if (!o?.id || String(o.id).startsWith("temp_")) return;
    carregarDadosFicha(o).promise.catch(() => {
      fichaDadosCacheRef.current.delete(String(o.id));
    });
  };
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  useEffect(() => setOrdens(ordensIniciais), [ordensIniciais]);

  const placasOptions = useMemo(() => equipamentos.map((e) => ({ value: e.id, label: e.placa })), [equipamentos]);
  const colaboradoresOptions = useMemo(() => colaboradores.map((c) => ({ value: c.nome, label: c.nome })), [colaboradores]);

  const pendentesValidacao = useMemo(() => ordens.filter((o) => podeAprovarEstaOS(o)), [ordens, role]);

  const listaFiltrada = useMemo(() => {
    const base = aba === "validacao" ? pendentesValidacao : ordens;
    return [...base]
      .filter((o) => !busca || (o.placa || "").toLowerCase().includes(busca.toLowerCase()) || (o.numero_os || "").toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => (b.data_abertura || "").localeCompare(a.data_abertura || ""));
  }, [ordens, pendentesValidacao, aba, busca]);

  // ── Ponte nativa da câmera (EunamanCamera) — serviço único em lib/nativeCamera.ts ──
  const { openCamera: abrirCameraNativa } = useNativeCamera("eunaman_os_active_photo_field", (alvo, compressed) => {
    if (alvo === "foto_horimetro" || alvo === "foto_km") {
      setForm((p) => ({ ...p, [alvo]: compressed }));
    } else if (alvo.startsWith("fotos:")) {
      const idx = Number(alvo.split(":")[1]);
      setForm((p) => {
        const arr = [...p.fotos];
        arr[idx] = compressed;
        return { ...p, fotos: arr };
      });
    } else if (alvo.startsWith("descricao:")) {
      const idx = Number(alvo.split(":")[1]);
      setForm((p) => {
        const arr = [...p.descricoes_atividade];
        if (arr[idx]) arr[idx] = { ...arr[idx], foto: compressed };
        return { ...p, descricoes_atividade: arr };
      });
    }
  });

  // ── Rascunho do formulário (sobrevive ao reload que o Android dá na Activity
  // enquanto o app de Câmera nativo está em primeiro plano, pra liberar memória —
  // comum em aparelhos com pouca RAM) — mesmo padrão de CaptacaoClient.tsx. Sem isso,
  // a foto tirada volta certinho (via EunamanCamera.getPendingPhoto acima) mas fica
  // anexada a um formulário em branco atrás de uma folha fechada: pro usuário parece
  // que "o app recarregou e perdeu tudo".
  const hasRestoredRef = React.useRef(false);

  useEffect(() => {
    if (!mounted || !hasRestoredRef.current) return;
    try {
      if (sheetOpen) {
        localStorage.setItem("eunaman_os_form_draft", JSON.stringify({ form, editingId }));
        localStorage.setItem("eunaman_os_sheet_open", "true");
      } else {
        localStorage.removeItem("eunaman_os_form_draft");
        localStorage.setItem("eunaman_os_sheet_open", "false");
      }
    } catch (e) {
      console.error("Erro ao salvar rascunho da OS:", e);
    }
  }, [form, editingId, sheetOpen, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const sheetWasOpen = localStorage.getItem("eunaman_os_sheet_open");
      const draft = localStorage.getItem("eunaman_os_form_draft");
      if (sheetWasOpen === "true" && draft) {
        const parsed = JSON.parse(draft);
        if (parsed && typeof parsed === "object" && parsed.form) {
          // Mescla com blankForm() pra rascunhos salvos antes dos campos novos (matriculas/
          // cargos/cargosPulados/mecanico_* por descrição) não ficarem undefined.
          const descricoesRestauradas = (parsed.form.descricoes_atividade || []).map((d: any) => ({ ...blankDescricaoAtividade(), ...d }));
          setForm({
            ...blankForm(),
            ...parsed.form,
            cargos: { ...blankCargos(), ...(parsed.form.cargos || {}) },
            descricoes_atividade: descricoesRestauradas,
          });
          setEditingId(parsed.editingId ?? null);
          setDescricaoExpandida(indexPrimeiraDescricaoIncompleta(descricoesRestauradas));
          setSheetOpen(true);
        }
      }
    } catch (e) {
      console.error("Erro ao restaurar rascunho da OS:", e);
    } finally {
      hasRestoredRef.current = true;
    }
  }, [mounted]);

  const abrirCamera = (alvo: string) => {
    abrirCameraNativa(alvo, () => toast.show("Câmera nativa disponível apenas no aplicativo instalado.", "info"));
  };

  const abrirNovo = () => {
    setEditingId(null);
    const novoForm = blankForm();
    setForm(novoForm);
    setCargoExpandido(null);
    setDescricaoExpandida(indexPrimeiraDescricaoIncompleta(novoForm.descricoes_atividade));
    setSheetOpen(true);
  };

  const abrirEdicao = async (o: any) => {
    setEditingId(o.id);
    setCargoExpandido(null);
    let fotosExtra: any = {};
    if (isOnline && !String(o.id).startsWith("temp_")) {
      const res = await getOSImagensClient(o.id);
      if (res && "data" in res && res.data) fotosExtra = res.data;
    }
    let assinaturasSalvas: string[] = [];
    let matriculasSalvas: string[] = [];
    let cargosSalvos: Record<string, CargoDado> = blankCargos();
    let cargosPuladosSalvos: string[] = [];
    try {
      const parsed = JSON.parse(o.assinatura_mecanico || fotosExtra.assinatura_mecanico || "{}");
      assinaturasSalvas = Array.isArray(parsed.mecanicos) ? parsed.mecanicos : [];
      matriculasSalvas = Array.isArray(parsed.matriculas) ? parsed.matriculas : [];
      if (Array.isArray(parsed.cargosPulados)) cargosPuladosSalvos = parsed.cargosPulados;
      if (parsed.cargos && typeof parsed.cargos === "object") {
        // Compatibilidade: formato anterior gravava cada cargo como string simples (só a
        // assinatura, sem nome/matrícula) — tanto vindo do site quanto de versões antigas.
        Object.entries(parsed.cargos as Record<string, any>).forEach(([key, val]) => {
          if (!(key in cargosSalvos)) return;
          cargosSalvos[key] = typeof val === "string" ? { nome: "", matricula: "", assinatura: val } : { ...blankCargoDado(), ...val };
        });
      }
    } catch {}
    // Mecânicos "legado" (de antes da assinatura por descrição existir, quando havia uma
    // lista separada "Mecânicos Executores") — sem seção própria pra editar mais, só usados
    // abaixo pra pré-preencher o mecânico de cada bloco de descrição que ainda não tiver um
    // (por índice), pra não esconder/perder uma assinatura antiga já feita.
    const mecanicosLegado = Array.isArray(o.mecanicos) ? o.mecanicos : [];
    // descricoes_atividade (como fotos/foto_horimetro/foto_km) fica de fora da listagem em
    // massa por ter fotos — só vem em fotosExtra, buscado sob demanda acima. OS antigas
    // (gravadas antes desse campo existir) continuam editáveis: monta um único bloco a
    // partir do texto legado de `descricao`, sem perder nada.
    const descricoesOrigem = Array.isArray(fotosExtra.descricoes_atividade) && fotosExtra.descricoes_atividade.length > 0
      ? fotosExtra.descricoes_atividade
      : o.descricoes_atividade;
    const descricoesSalvas: DescricaoAtividadeForm[] =
      Array.isArray(descricoesOrigem) && descricoesOrigem.length > 0
        ? descricoesOrigem.map((d: any, i: number) => ({
            descricao: d?.descricao || "",
            hora_inicio: d?.hora_inicio || "",
            hora_fim: d?.hora_fim || "",
            foto: d?.foto || "",
            mecanico_nome: d?.mecanico_nome || mecanicosLegado[i] || "",
            mecanico_matricula: d?.mecanico_matricula || matriculasSalvas[i] || "",
            mecanico_assinatura: d?.mecanico_assinatura || assinaturasSalvas[i] || "",
          }))
        : [{ ...blankDescricaoAtividade(), descricao: o.descricao || "", mecanico_nome: mecanicosLegado[0] || "", mecanico_matricula: matriculasSalvas[0] || "", mecanico_assinatura: assinaturasSalvas[0] || "" }];
    setForm({
      horario_parada: (o.horario_parada || "").slice(0, 16),
      data_abertura: (o.data_abertura || "").slice(0, 16),
      data_fechamento: (o.data_fechamento || "").slice(0, 16),
      status: o.status || "Aberta",
      equipamento_id: o.equipamento_id || "",
      placa: o.placa || "",
      modulo: o.modulo || "",
      horimetro: o.horimetro != null ? String(o.horimetro) : "",
      km: o.km != null ? String(o.km) : "",
      operacao_tipo: o.operacao_tipo || "",
      local: o.local || "",
      foto_horimetro: fotosExtra.foto_horimetro || o.foto_horimetro || "",
      foto_km: fotosExtra.foto_km || o.foto_km || "",
      descricoes_atividade: descricoesSalvas,
      motivo: o.motivo || "",
      observacoes: o.observacoes || "",
      cargos: cargosSalvos,
      cargosPulados: cargosPuladosSalvos,
      fotos: fotosExtra.fotos || o.fotos || [],
    });
    setDescricaoExpandida(indexPrimeiraDescricaoIncompleta(descricoesSalvas));
    setSheetOpen(true);
  };

  // "Ver Detalhes" também precisa buscar sob demanda (mesmo motivo de abrirEdicao acima):
  // fotos/foto_horimetro/foto_km/descricoes_atividade ficam fora da listagem em massa.
  const abrirVisualizacao = async (o: any) => {
    const cacheKey = String(o.id);
    const entry = carregarDadosFicha(o);
    // Só mostra o spinner quando a busca/compressão ainda não terminou — se o usuário já
    // tinha tocado na linha da OS (ver prefetchFichaDados) e demorou pra tocar em "Ver
    // Ficha", isso aqui já pode estar pronto, e abre instantâneo sem spinner nenhum.
    if (!entry.resolvido) setFichaBusyMsg("Carregando ficha...");
    try {
      const resultado = await entry.promise;
      setFichaData(resultado.ficha);
      setFichaAltaResolucao(resultado.altaResolucao);
      // NÃO gera o PDF em segundo plano aqui: html2canvas trava a thread principal por um
      // tempo perceptível (mesmo com fotos já comprimidas), e como isso rodava assim que a
      // prévia aparecia, qualquer toque no X pra fechar ou em Compartilhar logo em seguida
      // ficava sem resposta até o html2canvas terminar — parecendo o app travado. A geração
      // só acontece agora quando o usuário de fato clica em Baixar/Compartilhar (com o
      // spinner "Gerando PDF..."/"Preparando..." já previsto pra essa espera).
    } catch (err: any) {
      console.error("Erro ao abrir a ficha da OS:", err);
      toast.show("Erro ao abrir a ficha: " + (err?.message || String(err)), "error");
      fichaDadosCacheRef.current.delete(cacheKey);
    } finally {
      setFichaBusyMsg(null);
    }
  };

  // Veio de um toque num item pendente de OS no sheet de sincronização (ver
  // ui/primitives/OfflineSyncSheet.tsx) — abre a ficha dessa OS específica assim que ela
  // aparecer na lista local. Roda a cada mudança em `ordens` (não só no mount) porque a
  // lista pode ainda estar carregando/sincronizando no instante exato da navegação.
  useEffect(() => {
    let pedido: { numero_os: string | null; id: string | null } | null = null;
    try {
      const raw = sessionStorage.getItem(CHAVE_ABRIR_OS_PENDENTE);
      if (raw) pedido = JSON.parse(raw);
    } catch {}
    if (!pedido) return;
    const alvo = ordens.find(
      (o) => (pedido!.numero_os && o.numero_os === pedido!.numero_os) || (pedido!.id && o.id === pedido!.id)
    );
    if (alvo) {
      abrirVisualizacao(alvo);
      try {
        sessionStorage.removeItem(CHAVE_ABRIR_OS_PENDENTE);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordens]);

  const onSelecionarPlaca = (equipamentoId: string) => {
    const eq = equipamentos.find((e) => e.id === equipamentoId);
    setForm((p) => ({ ...p, equipamento_id: equipamentoId, placa: eq?.placa || "", modulo: eq?.modulo || "", operacao_tipo: eq?.categoria || "" }));
  };

  const horasManutencao = useMemo(() => {
    if (!form.data_abertura || !form.data_fechamento) return 0;
    const diffMin = Math.floor((new Date(form.data_fechamento).getTime() - new Date(form.data_abertura).getTime()) / 60000);
    return diffMin > 0 ? Number((diffMin / 60).toFixed(2)) : 0;
  }, [form.data_abertura, form.data_fechamento]);

  // Lista de mecânicos/matrículas/assinaturas da OS — derivada das assinaturas por
  // descrição de atividade (não existe mais um campo separado "Mecânicos Executores": cada
  // descrição já é a atividade de um mecânico específico, então repetir a mesma pessoa numa
  // lista à parte era redundante). Um mesmo nome em descrições diferentes conta uma vez só,
  // com a primeira matrícula/assinatura preenchida que aparecer.
  const mecanicosDerivados = useMemo(() => {
    const vistos = new Map<string, { matricula: string; assinatura: string }>();
    form.descricoes_atividade.forEach((d) => {
      const nome = d.mecanico_nome.trim();
      if (!nome || vistos.has(nome)) return;
      vistos.set(nome, { matricula: d.mecanico_matricula.trim(), assinatura: d.mecanico_assinatura });
    });
    const nomes = Array.from(vistos.keys());
    return {
      nomes,
      matriculas: nomes.map((n) => vistos.get(n)!.matricula),
      assinaturas: nomes.map((n) => vistos.get(n)!.assinatura),
    };
  }, [form.descricoes_atividade]);

  // Desfaz o JSON.stringify de descricoes_atividade (ver buildFields) pro registro local
  // otimista (lista/ficha) — a fila/FormData precisa da string (mesmo parse do caminho
  // online em actions.ts), mas guardar a string direto no registro local quebrava a ficha
  // (comprimirFotosParaFicha espera um array de verdade).
  const parseDescricoesAtividadeJSON = (raw: unknown): any[] => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string") return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // Monta o mapa de campos "achatado" (mesma convenção de app/os/actions.ts: mecanico_1..5,
  // fotos como múltiplos valores) usado tanto pro FormData (caminho online) quanto pro
  // payload da fila offline — nunca via fd.entries()/Object.fromEntries, que colapsa
  // chaves repetidas (perderia todas as fotos além da última).
  const buildFields = () => {
    const fields: Record<string, any> = {
      equipamento_id: form.equipamento_id,
      placa: form.placa,
      modulo: form.modulo,
      status: form.data_fechamento ? "Fechada" : form.status,
      data_abertura: form.data_abertura,
      data_fechamento: form.data_fechamento || null,
      horimetro: form.horimetro || null,
      km: form.km || null,
      foto_horimetro: form.foto_horimetro || null,
      foto_km: form.foto_km || null,
      operacao_tipo: form.operacao_tipo,
      local: form.local,
      descricao: form.descricoes_atividade
        .map((d) => d.descricao.trim())
        .filter(Boolean)
        .map((texto, i) => `${i + 1}) ${texto}`)
        .join("\n\n"),
      descricoes_atividade: JSON.stringify(
        form.descricoes_atividade
          .filter((d) => d.descricao.trim() || d.hora_inicio || d.hora_fim || d.foto || d.mecanico_nome || d.mecanico_assinatura)
          .map((d) => ({
            descricao: d.descricao,
            hora_inicio: d.hora_inicio || null,
            hora_fim: d.hora_fim || null,
            foto: d.foto || null,
            mecanico_nome: d.mecanico_nome || null,
            mecanico_matricula: d.mecanico_matricula || null,
            mecanico_assinatura: d.mecanico_assinatura || null,
          }))
      ),
      motivo: form.motivo,
      observacoes: form.observacoes,
      horario_parada: form.horario_parada,
      horas_manutencao: horasManutencao,
      assinatura_mecanico: JSON.stringify({
        mecanicos: mecanicosDerivados.assinaturas,
        matriculas: mecanicosDerivados.matriculas,
        cargos: form.cargos,
        cargosPulados: form.cargosPulados,
      }),
      fotos: form.fotos.filter(Boolean),
    };
    mecanicosDerivados.nomes.forEach((nome, idx) => {
      fields[`mecanico_${idx + 1}`] = nome;
    });
    return fields;
  };

  const temDescricaoPreenchida = useMemo(
    () => form.descricoes_atividade.some((d) => d.descricao.trim()),
    [form.descricoes_atividade]
  );

  const handleSalvar = async () => {
    if (!form.equipamento_id || !form.horario_parada || !form.data_abertura || !temDescricaoPreenchida) {
      toast.show("Preencha Placa, Horário da Parada, Início da Manutenção e ao menos uma Descrição.", "error");
      return;
    }
    setSalvando(true);
    try {
      const fields = buildFields();
      const mecanicosArray = mecanicosDerivados.nomes;

      if (isOnline) {
        const fd = deserializeToFormData(fields);
        const res = editingId ? await atualizarOrdemServico(editingId, fd) : await criarOrdemServico(fd);
        if (res && "error" in res) {
          toast.show("Erro ao salvar: " + res.error, "error");
          setSalvando(false);
          return;
        }
        const saved = res as any;
        await localDb.put("ordens_servico", saved);
        setOrdens((prev) => (editingId ? prev.map((o) => (o.id === editingId ? saved : o)) : [saved, ...prev]));
        toast.show(editingId ? "OS atualizada!" : "OS criada!", "success");
      } else if (editingId) {
        const current = ordens.find((o) => o.id === editingId);
        // fields.descricoes_atividade é uma STRING (JSON.stringify, ver buildFields — é o
        // formato que o FormData/fila offline espera pra reaproveitar o mesmo parse do
        // caminho online). Pro registro LOCAL exibido na lista/ficha precisa virar array de
        // novo, senão comprimirFotosParaFicha (que espera array) quebra ao abrir a ficha.
        const updated = {
          ...current,
          ...fields,
          descricoes_atividade: parseDescricoesAtividadeJSON(fields.descricoes_atividade),
          mecanicos: mecanicosArray,
          _isPendingSync: true,
        };
        await localDb.put("ordens_servico", updated);
        await localDb.addToQueue("os", "update", { id: editingId, ...fields });
        setOrdens((prev) => prev.map((o) => (o.id === editingId ? updated : o)));
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        toast.show("OS atualizada offline — sincroniza quando a conexão voltar.", "success");
      } else {
        const tempId = `temp_os_${Date.now()}`;
        const tempNum = `OS-OFF-${Math.floor(Math.random() * 9000) + 1000}`;
        const optimistic = {
          id: tempId,
          numero_os: tempNum,
          ...fields,
          descricoes_atividade: parseDescricoesAtividadeJSON(fields.descricoes_atividade),
          classe: "CORRETIVA",
          foi_enviado_reserva: false,
          mecanicos: mecanicosArray,
          aprovado: false,
          _isPendingSync: true,
        };
        await localDb.put("ordens_servico", optimistic);
        await localDb.addToQueue("os", "create", { ...fields, temp_numero_os: tempNum });
        setOrdens((prev) => [optimistic, ...prev]);
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        toast.show("OS criada offline — sincroniza quando a conexão voltar.", "success");
      }
      window.dispatchEvent(new CustomEvent("offline-db-updated-ordens_servico"));
      setSheetOpen(false);
    } finally {
      setSalvando(false);
    }
  };

  const handleAprovar = async (o: any) => {
    const etapa = minhaEtapaAprovacao();
    if (isOnline) {
      const res = await aprovarOrdemServico(o.id, etapa);
      if (res && "error" in res) {
        toast.show("Erro ao aprovar: " + res.error, "error");
        return;
      }
      const saved = res as any;
      await localDb.put("ordens_servico", saved);
      setOrdens((prev) => prev.map((x) => (x.id === o.id ? saved : x)));
    } else {
      const updated = {
        ...o,
        ...(!etapa || etapa === "pcm" ? { aprovado_pcm: true } : {}),
        ...(!etapa || etapa === "supervisor" ? { aprovado_supervisor: true } : {}),
        _isPendingSync: true,
      };
      updated.aprovado = updated.aprovado_pcm === true && updated.aprovado_supervisor === true;
      await localDb.put("ordens_servico", updated);
      await localDb.addToQueue("os", "approve", { id: o.id, etapa });
      setOrdens((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    }
    window.dispatchEvent(new CustomEvent("offline-db-updated-ordens_servico"));
    toast.show("OS aprovada.", "success");
  };

  const handleExcluir = async (o: any) => {
    const isTempLocal = String(o.id).startsWith("temp_os_");
    if (isTempLocal) {
      const queue = await localDb.getQueue();
      const queueItem = queue.find((q: any) => q.entity === "os" && q.action === "create" && q.payload?.temp_numero_os === o.numero_os);
      if (queueItem?.id !== undefined) await localDb.removeFromQueue(queueItem.id);
    } else if (isOnline) {
      const res = await excluirOrdemServico(o.id);
      if (res && "error" in res) {
        toast.show("Erro ao excluir: " + res.error, "error");
        return;
      }
    } else {
      await localDb.addToQueue("os", "delete", o.id);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    }
    await localDb.delete("ordens_servico", o.id);
    setOrdens((prev) => prev.filter((x) => x.id !== o.id));
    window.dispatchEvent(new CustomEvent("offline-db-updated-ordens_servico"));
    toast.show("OS excluída.", "success");
  };

  const inputCls =
    "w-full px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-zinc-600";
  const labelCls = "block text-xs font-bold text-zinc-400 mb-1.5";

  const statusColor = (status: string) =>
    status === "Fechada" ? "text-emerald-400" : status === "Programado" ? "text-blue-400" : status === "Cancelada" ? "text-zinc-500" : "text-amber-400";

  const actionSheetItems: ActionSheetItem[] = actionItem
    ? [
        { key: "ver", label: "Ver Ficha / Compartilhar", icon: Eye, onSelect: () => abrirVisualizacao(actionItem) },
        ...(podeCriar ? [{ key: "editar", label: "Editar", icon: Pencil, onSelect: () => abrirEdicao(actionItem) } as ActionSheetItem] : []),
        ...(podeAprovarEstaOS(actionItem)
          ? [{ key: "aprovar", label: "Aprovar", icon: CheckCircle2, onSelect: () => handleAprovar(actionItem) } as ActionSheetItem]
          : []),
        ...(podeExcluir
          ? [{ key: "excluir", label: "Excluir", icon: Trash2, destructive: true, onSelect: () => setConfirmDelete(actionItem) } as ActionSheetItem]
          : []),
      ]
    : [];

  return (
    <div className="min-h-full p-4 space-y-3 pb-24">
      <SegmentedTabs
        items={[
          { key: "lista", label: "Lista" },
          ...(podeAprovar ? [{ key: "validacao", label: `Validação${pendentesValidacao.length > 0 ? ` (${pendentesValidacao.length})` : ""}` }] : []),
        ]}
        value={aba}
        onChange={(v) => setAba(v as "lista" | "validacao")}
      />

      <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900">
        <Search size={16} className="text-zinc-500" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar placa ou nº da OS..."
          className="flex-1 bg-transparent text-sm font-semibold text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </div>

      {listaFiltrada.length === 0 ? (
        <EmptyState icon={Wrench} title="Nenhuma OS encontrada" description="Toque em Nova OS para abrir uma ordem de serviço." />
      ) : (
        <div className="space-y-2">
          {listaFiltrada.map((o) => (
            <ListRow
              key={o.id}
              icon={<Wrench size={18} />}
              title={`${o.numero_os || "—"} · ${o.placa}`}
              subtitle={(o.data_abertura || "").slice(0, 10).split("-").reverse().join("/")}
              badge={
                <span className={`text-[9px] font-black uppercase tracking-wide ${statusColor(o.status)}`}>
                  {o.status || "Aberta"}
                  {o.aprovado === false ? ` · Pendente${o.aprovado_pcm === false ? " PCM" : ""}${o.aprovado_supervisor === false ? " Supervisor" : ""}` : ""}
                </span>
              }
              onClick={() => {
                setActionItem(o);
                // Já começa a buscar/comprimir a ficha assim que o ActionSheet abre — ganha o
                // tempo de reação do usuário até ele de fato tocar em "Ver Ficha".
                prefetchFichaDados(o);
              }}
              rightSlot={<ChevronRight size={16} className="text-zinc-600" />}
            />
          ))}
        </div>
      )}

      {podeCriar && aba === "lista" && <Fab onClick={abrirNovo} icon={<Plus size={20} />} label="Nova OS" />}

      {/* ─── FORMULÁRIO ─── */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editingId ? "Editar OS" : "Nova OS"} fullHeight>
        <div className="space-y-4 pb-4">
          <div>
            <label className={labelCls}>Horário Real da Parada *</label>
            <input
              type="datetime-local"
              value={form.horario_parada}
              onChange={(e) => setForm((p) => ({ ...p, horario_parada: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Início Manutenção *</label>
              <input
                type="datetime-local"
                value={form.data_abertura}
                onChange={(e) => setForm((p) => ({ ...p, data_abertura: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Fechamento</label>
              <input
                type="datetime-local"
                value={form.data_fechamento}
                onChange={(e) => setForm((p) => ({ ...p, data_fechamento: e.target.value, status: e.target.value ? "Fechada" : p.status }))}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status *</label>
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className={inputCls}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Placa *</label>
              <SearchableSelect value={form.equipamento_id} onChange={onSelecionarPlaca} options={placasOptions} placeholder="Selecione o equipamento..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Horímetro</label>
              <input type="number" step="0.1" value={form.horimetro} onChange={(e) => setForm((p) => ({ ...p, horimetro: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>KM</label>
              <input type="number" step="0.1" value={form.km} onChange={(e) => setForm((p) => ({ ...p, km: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Operação (Tipo)</label>
              <input value={form.operacao_tipo} onChange={(e) => setForm((p) => ({ ...p, operacao_tipo: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Local da Atividade</label>
              <input value={form.local} onChange={(e) => setForm((p) => ({ ...p, local: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FotoSlot label="Foto Horímetro" url={form.foto_horimetro} onCapture={() => abrirCamera("foto_horimetro")} onClear={() => setForm((p) => ({ ...p, foto_horimetro: "" }))} />
            <FotoSlot label="Foto KM" url={form.foto_km} onCapture={() => abrirCamera("foto_km")} onClear={() => setForm((p) => ({ ...p, foto_km: "" }))} />
          </div>

          {/* Descrições da atividade — lista repetível, cada bloco com horário inicial/final
              e foto própria (sem limite de quantidade) */}
          <div className="p-3.5 rounded-xl bg-amber-950/10 border border-amber-900/30 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-amber-500 uppercase tracking-wide">Descrições da Atividade *</p>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => {
                    const arr = [...p.descricoes_atividade, blankDescricaoAtividade()];
                    setDescricaoExpandida(arr.length - 1);
                    return { ...p, descricoes_atividade: arr };
                  })
                }
                className="text-[10px] font-black text-amber-500 uppercase"
              >
                + Adicionar Descrição
              </button>
            </div>
            {form.descricoes_atividade.map((bloco, idx) => {
              const removerBloco = () => {
                setDescricaoExpandida((atual) => {
                  if (atual === null) return atual;
                  if (atual === idx) return Math.max(0, idx - 1);
                  return atual > idx ? atual - 1 : atual;
                });
                setForm((p) => ({ ...p, descricoes_atividade: p.descricoes_atividade.filter((_, i) => i !== idx) }));
              };

              // Recolhida (padrão) — só um resumo + status; toca pra reabrir e editar.
              if (idx !== descricaoExpandida) {
                return (
                  <div
                    key={idx}
                    onClick={() => setDescricaoExpandida(idx)}
                    className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black text-zinc-500 uppercase">Descrição {idx + 1}</span>
                      {bloco.descricao.trim() && <p className="text-xs text-zinc-300 truncate mt-0.5">{bloco.descricao.trim()}</p>}
                    </div>
                    {bloco.descricao.trim() ? (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    ) : (
                      <span className="text-[10px] font-black text-amber-500 uppercase shrink-0">Preencher</span>
                    )}
                  </div>
                );
              }

              return (
              <div key={idx} className="p-3 rounded-xl bg-zinc-900 border border-amber-700/50 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-amber-500 uppercase">Descrição {idx + 1}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Recolhe sem exigir nada preenchido — diferente de "Concluir Descrição"
                        (mais abaixo), que valida o texto. Pra quando o usuário abriu esse
                        bloco mas decidiu não usar agora, sem perder o que já tinha digitado. */}
                    <button type="button" onClick={() => setDescricaoExpandida(null)} className="text-[10px] font-black text-zinc-500 uppercase">
                      Fechar
                    </button>
                    {form.descricoes_atividade.length > 1 && (
                      <button
                        type="button"
                        onClick={removerBloco}
                        className="text-red-400 text-lg leading-none px-1"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={bloco.descricao}
                  onChange={(e) =>
                    setForm((p) => {
                      const arr = [...p.descricoes_atividade];
                      arr[idx] = { ...arr[idx], descricao: e.target.value };
                      return { ...p, descricoes_atividade: arr };
                    })
                  }
                  rows={2}
                  placeholder="Descreva a falha ou manutenção..."
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1">Horário Inicial</label>
                    <input
                      type="time"
                      value={bloco.hora_inicio}
                      onChange={(e) =>
                        setForm((p) => {
                          const arr = [...p.descricoes_atividade];
                          arr[idx] = { ...arr[idx], hora_inicio: e.target.value };
                          return { ...p, descricoes_atividade: arr };
                        })
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1">Horário Final</label>
                    <input
                      type="time"
                      value={bloco.hora_fim}
                      onChange={(e) =>
                        setForm((p) => {
                          const arr = [...p.descricoes_atividade];
                          arr[idx] = { ...arr[idx], hora_fim: e.target.value };
                          return { ...p, descricoes_atividade: arr };
                        })
                      }
                      className={inputCls}
                    />
                  </div>
                </div>
                <FotoSlot
                  label="Foto desta descrição"
                  url={bloco.foto}
                  onCapture={() => abrirCamera(`descricao:${idx}`)}
                  onClear={() =>
                    setForm((p) => {
                      const arr = [...p.descricoes_atividade];
                      arr[idx] = { ...arr[idx], foto: "" };
                      return { ...p, descricoes_atividade: arr };
                    })
                  }
                />
                {/* Assinatura do mecânico responsável POR ESTA atividade — cada descrição
                    pode ser de um mecânico diferente, por isso a assinatura é por bloco. */}
                <div className="pt-2.5 border-t border-zinc-800 space-y-2">
                  <label className="block text-[10px] font-bold text-emerald-500 uppercase">Assinatura do Mecânico desta Atividade</label>
                  <SearchableSelect
                    value={bloco.mecanico_nome}
                    onChange={(v) =>
                      setForm((p) => {
                        const arr = [...p.descricoes_atividade];
                        arr[idx] = { ...arr[idx], mecanico_nome: v };
                        return { ...p, descricoes_atividade: arr };
                      })
                    }
                    options={colaboradoresOptions}
                    placeholder="Nome do mecânico..."
                  />
                  <input
                    value={bloco.mecanico_matricula}
                    onChange={(e) =>
                      setForm((p) => {
                        const arr = [...p.descricoes_atividade];
                        arr[idx] = { ...arr[idx], mecanico_matricula: e.target.value };
                        return { ...p, descricoes_atividade: arr };
                      })
                    }
                    placeholder="Matrícula"
                    className={inputCls}
                  />
                  {bloco.mecanico_nome.trim() && (
                    <SignaturePad
                      label={`Assinatura — ${bloco.mecanico_nome}`}
                      value={bloco.mecanico_assinatura}
                      onChange={(v) =>
                        setForm((p) => {
                          const arr = [...p.descricoes_atividade];
                          arr[idx] = { ...arr[idx], mecanico_assinatura: v };
                          return { ...p, descricoes_atividade: arr };
                        })
                      }
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!bloco.descricao.trim()) {
                      toast.show("Descreva a atividade antes de concluir.", "error");
                      return;
                    }
                    if (idx === form.descricoes_atividade.length - 1) {
                      setForm((p) => ({ ...p, descricoes_atividade: [...p.descricoes_atividade, blankDescricaoAtividade()] }));
                    }
                    setDescricaoExpandida(idx + 1);
                  }}
                  className="w-full py-2.5 rounded-lg bg-amber-600 active:bg-amber-700 text-white text-xs font-black uppercase tracking-wide"
                >
                  Concluir Descrição
                </button>
              </div>
              );
            })}
          </div>

          <div>
            <label className={labelCls}>Motivo</label>
            <select value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} className={inputCls}>
              <option value="">Selecione...</option>
              {motivos.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
              {motivos.length === 0 && MOTIVOS_FALLBACK.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Aprovações / Assinaturas de Responsáveis — mesmos 5 papéis do site (Encarregado,
              PCM, Operador, Supervisor/Suzano, Supervisor de Manutenção), cada um com
              nome + matrícula + assinatura própria. Quem efetivamente aprova a OS no fluxo
              de validação (duas etapas) é feito por cargo de login (ver podeAprovar acima) —
              esta seção é o registro em papel/assinatura de quem esteve envolvido. */}
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <p className="text-[11px] font-black text-zinc-300 uppercase tracking-wide">Aprovações / Assinaturas de Responsáveis</p>
            {Object.entries(CARGOS_LABELS).map(([key, label]) => {
              const dado = form.cargos[key] || blankCargoDado();
              const pulado = form.cargosPulados.includes(key);
              const expandido = cargoExpandido === key;

              // Pulado — linha compacta, só com a opção de reabrir.
              if (pulado) {
                return (
                  <div key={key} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                    <span className="text-[10px] font-black text-zinc-400 uppercase">{label}</span>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, cargosPulados: p.cargosPulados.filter((k) => k !== key) }))}
                      className="text-[10px] font-black text-amber-500 uppercase"
                    >
                      Pulado — reabrir
                    </button>
                  </div>
                );
              }

              // Suspenso (padrão) — só o nome do cargo + status; toca pra abrir os campos.
              if (!expandido) {
                return (
                  <div
                    key={key}
                    onClick={() => setCargoExpandido(key)}
                    className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-black text-zinc-400 uppercase block">{label}</span>
                      {dado.assinatura ? (
                        <span className="text-[10px] font-bold text-emerald-400">
                          ✅ {dado.nome}{dado.matricula ? ` — Mat. ${dado.matricula}` : ""}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-500">Toque para assinar</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm((p) => ({ ...p, cargosPulados: [...p.cargosPulados, key] }));
                      }}
                      className="text-[10px] font-black text-zinc-500 uppercase shrink-0 ml-2"
                    >
                      Pular
                    </button>
                  </div>
                );
              }

              // Expandido — campos de nome/matrícula/assinatura abertos pra edição.
              return (
                <div key={key} className="p-3 rounded-xl bg-zinc-900 border border-amber-700/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-amber-500 uppercase">{label}</span>
                    <button type="button" onClick={() => setCargoExpandido(null)} className="text-[10px] font-black text-zinc-500 uppercase">
                      Fechar
                    </button>
                  </div>
                  <input
                    value={dado.nome}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, cargos: { ...p.cargos, [key]: { ...dado, nome: e.target.value } } }))
                    }
                    placeholder="Nome completo"
                    className={inputCls}
                  />
                  <input
                    value={dado.matricula}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, cargos: { ...p.cargos, [key]: { ...dado, matricula: e.target.value } } }))
                    }
                    placeholder="Matrícula"
                    className={inputCls}
                  />
                  {dado.nome.trim() && (
                    <SignaturePad
                      label={`Assinatura — ${label}`}
                      value={dado.assinatura}
                      onChange={(v) => setForm((p) => ({ ...p, cargos: { ...p.cargos, [key]: { ...dado, assinatura: v } } }))}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <label className={labelCls}>Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} rows={3} className={inputCls} />
          </div>

          {/* Fotos do serviço */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Fotos do Serviço ({form.fotos.filter(Boolean).length}/5)</label>
              {form.fotos.filter(Boolean).length < 5 && (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, fotos: [...p.fotos, ""] }))}
                  className="text-[10px] font-black text-amber-500 uppercase"
                >
                  + Adicionar
                </button>
              )}
            </div>
            {form.fotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {form.fotos.map((url, idx) => (
                  <FotoSlot
                    key={idx}
                    label={`Foto ${idx + 1}`}
                    url={url}
                    onCapture={() => abrirCamera(`fotos:${idx}`)}
                    onClear={() => setForm((p) => ({ ...p, fotos: p.fotos.filter((_, i) => i !== idx) }))}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSalvar}
            disabled={salvando || !form.equipamento_id || !temDescricaoPreenchida}
            className="w-full py-3.5 rounded-xl text-sm font-black text-white bg-amber-600 active:bg-amber-700 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : editingId ? "Salvar Alterações" : "Abrir OS"}
          </button>
        </div>
      </BottomSheet>

      {fichaBusyMsg && (
        <div className="fixed inset-0 z-[1300] flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-md text-white">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm font-bold text-zinc-300">{fichaBusyMsg}</p>
        </div>
      )}

      {/* ─── FICHA OFICIAL (visualizar / baixar / compartilhar) — mesmo layout do site ─── */}
      {fichaData && (
        <FichaPreviewModal
          html={gerarHtmlFichaOS(fichaData)}
          resolverImagemAmpliada={(src) => fichaAltaResolucao?.get(src) || src}
          onClose={() => setFichaData(null)}
          onDownload={async () => {
            // Repetir Baixar/Compartilhar da MESMA ficha sem mudanças reusa o PDF do cache
            // (quase instantâneo); senão, o html2canvas (pesado) vai rodar agora.
            const assinatura = JSON.stringify(fichaData);
            const jaPronto = fichaPdfCacheRef.current.get(fichaData.id)?.assinatura === assinatura;
            if (!jaPronto) {
              setFichaBusyMsg("Gerando PDF...");
              // Dá 2 frames pro navegador pintar o spinner ANTES do html2canvas travar a
              // thread principal — sem isso o clique parecia não fazer nada (sem spinner
              // nenhum) até o PDF terminar de gerar.
              await aguardarRepaint();
            }
            try {
              const blob = await getOrGerarBlobFicha(fichaData);
              await gerarFichaOSPDF(fichaData, "download", blob);
            } finally {
              setFichaBusyMsg(null);
            }
          }}
          onShare={async () => {
            const assinatura = JSON.stringify(fichaData);
            const jaPronto = fichaPdfCacheRef.current.get(fichaData.id)?.assinatura === assinatura;
            if (!jaPronto) {
              setFichaBusyMsg("Preparando ficha para compartilhamento...");
              await aguardarRepaint();
            }
            try {
              const blob = await getOrGerarBlobFicha(fichaData);
              await gerarFichaOSPDF(fichaData, "share", blob);
            } finally {
              setFichaBusyMsg(null);
            }
          }}
        />
      )}

      <ActionSheet open={!!actionItem} onClose={() => setActionItem(null)} title={actionItem ? `OS ${actionItem.numero_os}` : undefined} items={actionSheetItems} />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleExcluir(confirmDelete)}
        title="Excluir OS"
        description="Esta ação não pode ser desfeita. Backlogs vinculados a esta OS não serão excluídos."
        destructive
      />
    </div>
  );
}
