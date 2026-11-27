"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BatteryCharging, Plus, Search, X, Save, Eye, Pencil, Trash2, FileText, Upload, Download, ExternalLink,
  CheckCircle2, AlertTriangle, XCircle, Boxes, ArrowUpDown, ChevronLeft, ChevronRight, CloudOff, Paperclip, RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { SearchableSelect } from "@/components/SearchableSelect";
import { excluirBateria } from "./actions";
import {
  garantiaDias, situacaoGarantia, diasRestantes, validarBateria, chaveSerie, hojeIso,
  SITUACAO_LABEL, EXTENSOES_CERTIFICADO, type Bateria, type SituacaoGarantia,
} from "@/lib/baterias";
import {
  enviarBateria, validarArquivoCertificado, lerComoDataUrl, urlCertificado, type ArquivoLocal, type EnvioBateria,
} from "@/lib/baterias-storage";

const POR_PAGINA = 20;

const fmtData = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const fmtDataHora = (d?: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const SITUACAO_ESTILO: Record<SituacaoGarantia, { cls: string; icon: typeof CheckCircle2 }> = {
  ativa: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900", icon: CheckCircle2 },
  proxima: { cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900", icon: AlertTriangle },
  vencida: { cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900", icon: XCircle },
};

function SituacaoBadge({ venc, hoje }: { venc: string; hoje: string }) {
  const s = situacaoGarantia(venc, hoje);
  const { cls, icon: Icon } = SITUACAO_ESTILO[s];
  const r = diasRestantes(venc, hoje);
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap", cls)}
      title={r >= 0 ? `Faltam ${r} dia${r !== 1 ? "s" : ""}` : `Vencida há ${-r} dia${r !== -1 ? "s" : ""}`}>
      <Icon size={12} /> {SITUACAO_LABEL[s]}
    </span>
  );
}

function Modal({ titulo, sub, icone, onClose, children, rodape, largura = "max-w-lg", bloqueado = false }: {
  titulo: string; sub?: ReactNode; icone: ReactNode; onClose: () => void; children: ReactNode; rodape?: ReactNode; largura?: string; bloqueado?: boolean;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !bloqueado) onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose, bloqueado]);
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={e => { if (e.target === e.currentTarget && !bloqueado) onClose(); }}>
      <div className={cn("bg-white dark:bg-zinc-950 w-full rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[94vh] overflow-hidden", largura)}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-lg shrink-0">{icone}</div>
            <div className="min-w-0">
              <h2 className="font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tight text-sm">{titulo}</h2>
              {sub && <p className="text-xs text-zinc-500 truncate">{sub}</p>}
            </div>
          </div>
          <button onClick={onClose} disabled={bloqueado} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">{children}</div>
        {rodape && <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 flex-wrap">{rodape}</div>}
      </div>
    </div>,
    document.body
  );
}

const inputCls = "w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-zinc-800 dark:text-zinc-100";
const labelCls = "text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1";
const btnSec = "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800";
const btnPri = "flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-500/20 disabled:opacity-50";

function Campo({ label, obrig, children }: { label: string; obrig?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls}>{label}{obrig && <span className="text-red-500"> *</span>}</label>
      {children}
    </div>
  );
}

// ─── Certificado: ver / baixar (URL assinada do bucket privado, ou o arquivo ainda local) ───

function useUrlsCertificado(b: Bateria | null) {
  const [urls, setUrls] = useState<{ ver: string; baixar: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    setUrls(null); setErro(null);
    if (!b) return;
    if (b._certificadoLocal) { setUrls({ ver: b._certificadoLocal.dataUrl, baixar: b._certificadoLocal.dataUrl }); return; }
    if (!b.certificado_path) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { setErro("Sem internet: o certificado abre quando a conexão voltar."); return; }
    let vivo = true;
    Promise.all([urlCertificado(b.certificado_path), urlCertificado(b.certificado_path, b.certificado_nome || "certificado")])
      .then(([ver, baixar]) => { if (vivo) setUrls({ ver, baixar }); })
      .catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [b]);
  return { urls, erro };
}

function CertificadoViewer({ bateria, onClose }: { bateria: Bateria; onClose: () => void }) {
  const { urls, erro } = useUrlsCertificado(bateria);
  const tipo = bateria._certificadoLocal?.tipo || bateria.certificado_tipo || "";
  const nome = bateria._certificadoLocal?.nome || bateria.certificado_nome || "certificado";
  return (
    <Modal titulo="Certificado da bateria" sub={`${bateria.modelo} · nº ${bateria.numero_serie} · ${nome}`} icone={<FileText size={18} />} onClose={onClose} largura="max-w-4xl"
      rodape={<>
        {urls && <a href={urls.ver} target="_blank" rel="noopener noreferrer" className={btnSec}><ExternalLink size={15} /> Abrir em nova aba</a>}
        {urls && <a href={urls.baixar} download={nome} className={btnPri}><Download size={15} /> Baixar</a>}
      </>}>
      {erro ? <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 text-sm font-semibold">{erro}</div>
        : !urls ? <div className="h-64 flex items-center justify-center text-sm text-zinc-400">Carregando certificado...</div>
        : tipo.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urls.ver} alt={`Certificado ${bateria.numero_serie}`} className="max-h-[70vh] w-auto mx-auto rounded-lg border border-zinc-200 dark:border-zinc-800" />
        ) : (
          <>
            <iframe src={urls.ver} title="Certificado" className="w-full h-[70vh] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white" />
            <p className="text-[11px] text-zinc-400">Se o PDF não aparecer (alguns celulares não mostram PDF dentro da tela), use “Abrir em nova aba” ou “Baixar”.</p>
          </>
        )}
    </Modal>
  );
}

// ─── Formulário (cadastro e edição) ───

type FormState = { modelo: string; numero_serie: string; fornecedor: string; data_venda: string; data_vencimento_garantia: string; observacoes: string };

function FormBateria({ inicial, existentes, fornecedoresCadastro, onClose, onSalvo }: {
  inicial: Bateria | null; existentes: Bateria[]; fornecedoresCadastro: string[]; onClose: () => void; onSalvo: (b: Bateria, pendente: boolean) => void;
}) {
  const { profile } = useAuth();
  const { isOnline } = useOffline();
  const [form, setForm] = useState<FormState>(() => ({
    modelo: inicial?.modelo || "", numero_serie: inicial?.numero_serie || "", fornecedor: inicial?.fornecedor || "",
    data_venda: inicial?.data_venda?.slice(0, 10) || "", data_vencimento_garantia: inicial?.data_vencimento_garantia?.slice(0, 10) || "",
    observacoes: inicial?.observacoes || "",
  }));
  const [arquivo, setArquivo] = useState<ArquivoLocal | null>(null);
  const [removerCert, setRemoverCert] = useState(false);
  const [verAtual, setVerAtual] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));

  const dias = garantiaDias(form.data_venda, form.data_vencimento_garantia);
  // Lista do Controle de Custos; na edição, mantém o fornecedor gravado mesmo se saiu do cadastro.
  const opcoesFornecedor = useMemo(() => {
    const nomes = new Set(fornecedoresCadastro);
    if (inicial?.fornecedor) nomes.add(inicial.fornecedor.trim());
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR")).map(n => ({ value: n, label: n }));
  }, [fornecedoresCadastro, inicial?.fornecedor]);
  const temCertAtual = !!(inicial?.certificado_path || inicial?._certificadoLocal) && !removerCert;

  const escolherArquivo = async (f: File | undefined) => {
    if (!f) return;
    const e = validarArquivoCertificado(f);
    if (e) { setErro(e); return; }
    setErro(null);
    setArquivo({ dataUrl: await lerComoDataUrl(f), nome: f.name, tipo: f.type });
    setRemoverCert(false);
  };

  const salvar = async () => {
    setErro(null);
    const v = validarBateria(form);
    if (v) { setErro(v); return; }
    const dup = existentes.find(b => b.id !== inicial?.id && chaveSerie(b.numero_serie) === chaveSerie(form.numero_serie));
    if (dup) { setErro(`Já existe uma bateria com o número de série ${dup.numero_serie} (${dup.modelo}).`); return; }

    const id = inicial?.id || crypto.randomUUID();
    const envio: EnvioBateria = {
      id, modelo: form.modelo.trim(), numero_serie: form.numero_serie.trim().toUpperCase(), fornecedor: form.fornecedor.trim(),
      data_venda: form.data_venda, data_vencimento_garantia: form.data_vencimento_garantia, observacoes: form.observacoes.trim() || null,
      ...(arquivo ? { certificado_arquivo: arquivo } : removerCert ? { remover_certificado: true } : {}),
    };

    setSalvando(true);
    try {
      if (isOnline) {
        const res = await enviarBateria(envio);
        if ("error" in res) throw new Error(res.error);
        await localDb.put("controle_baterias", res.data);
        onSalvo(res.data, false);
      } else {
        // Offline: guarda no aparelho e entra na fila (mesmo id → o reenvio nunca duplica).
        const agora = new Date().toISOString();
        const local: Bateria = {
          ...(inicial || { criado_por: profile?.id || null, criado_por_nome: profile?.full_name || null, created_at: agora, filial_id: "MATRIZ" }),
          ...envio, certificado_path: removerCert || arquivo ? null : inicial?.certificado_path || null,
          certificado_nome: arquivo ? arquivo.nome : removerCert ? null : inicial?.certificado_nome || null,
          certificado_tipo: arquivo ? arquivo.tipo : removerCert ? null : inicial?.certificado_tipo || null,
          _certificadoLocal: arquivo || (removerCert ? null : inicial?._certificadoLocal || null),
          garantia_dias: dias, observacoes: envio.observacoes ?? null, updated_at: agora, _isPendingSync: true,
        } as Bateria;
        await localDb.put("controle_baterias", local);
        await localDb.addToQueue("controle_baterias", inicial ? "update" : "create", envio);
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        onSalvo(local, true);
      }
      window.dispatchEvent(new CustomEvent("offline-db-updated-controle_baterias"));
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal titulo={inicial ? "Editar bateria" : "Nova bateria"} sub={inicial ? `${inicial.modelo} · nº ${inicial.numero_serie}` : "Informações da bateria"}
      icone={<BatteryCharging size={18} />} onClose={onClose} bloqueado={salvando} largura="max-w-2xl"
      rodape={<>
        <button onClick={onClose} disabled={salvando} className={btnSec}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className={btnPri}><Save size={15} /> {salvando ? "Salvando..." : inicial ? "Salvar alterações" : "Cadastrar bateria"}</button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label="Modelo da bateria" obrig><input className={inputCls} value={form.modelo} onChange={set("modelo")} placeholder="Ex.: Moura 150Ah" autoFocus /></Campo>
        <Campo label="Número de série" obrig><input className={cn(inputCls, "uppercase font-mono")} value={form.numero_serie} onChange={set("numero_serie")} placeholder="Ex.: MR150-0001" /></Campo>
        <Campo label="Fornecedor" obrig>
          <SearchableSelect options={opcoesFornecedor} value={form.fornecedor} onChange={v => setForm(f => ({ ...f, fornecedor: v }))} placeholder="Selecione o fornecedor..." />
          {fornecedoresCadastro.length === 0 && (
            <p className="text-[11px] text-amber-600 font-semibold">Nenhum fornecedor carregado. Os fornecedores vêm do cadastro do Controle de Custos (precisa de internet na primeira vez).</p>
          )}
        </Campo>
        <Campo label="Garantia (dias)">
          <div className={cn(inputCls, "bg-zinc-100 dark:bg-zinc-800/60 cursor-not-allowed tabular-nums", dias != null && dias <= 0 && "text-red-600")} aria-readonly title="Calculado automaticamente">
            {dias == null ? "—" : `${dias} dia${dias !== 1 ? "s" : ""}`}
          </div>
        </Campo>
        <Campo label="Data da venda" obrig><input type="date" className={inputCls} value={form.data_venda} onChange={set("data_venda")} /></Campo>
        <Campo label="Vencimento da garantia" obrig><input type="date" className={inputCls} value={form.data_vencimento_garantia} min={form.data_venda || undefined} onChange={set("data_vencimento_garantia")} /></Campo>
      </div>

      <Campo label="Certificado da bateria (PDF, JPG, PNG — até 10 MB)">
        <input ref={fileRef} type="file" accept={EXTENSOES_CERTIFICADO} className="hidden" onChange={e => { escolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
          {arquivo ? (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400 min-w-0"><Paperclip size={14} className="shrink-0" /><span className="truncate">{arquivo.nome}</span> <span className="text-[10px] font-bold uppercase text-zinc-400">novo</span></span>
          ) : temCertAtual ? (
            <button type="button" onClick={() => setVerAtual(true)} className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline min-w-0">
              <FileText size={14} className="shrink-0" /><span className="truncate">{inicial?._certificadoLocal?.nome || inicial?.certificado_nome || "Certificado"}</span>
            </button>
          ) : <span className="text-sm text-zinc-400">Nenhum certificado anexado</span>}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400">
              {arquivo || temCertAtual ? <><RefreshCcw size={13} /> Substituir</> : <><Upload size={13} /> Anexar</>}
            </button>
            {(arquivo || temCertAtual) && (
              <button type="button" onClick={() => { setArquivo(null); if (temCertAtual && !arquivo) setRemoverCert(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                <X size={13} /> {arquivo ? "Descartar" : "Remover"}
              </button>
            )}
          </div>
        </div>
        {removerCert && <p className="text-[11px] text-amber-600 font-semibold">O certificado atual será removido ao salvar.</p>}
      </Campo>

      <Campo label="Observações"><textarea className={cn(inputCls, "font-medium min-h-[64px]")} value={form.observacoes} onChange={set("observacoes")} placeholder="Opcional" /></Campo>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-xs">
        <div><span className="block text-[10px] font-black uppercase text-zinc-400">Lançado por</span>
          <span className="font-bold text-zinc-700 dark:text-zinc-200">{inicial ? inicial.criado_por_nome || "—" : profile?.full_name || "Usuário da sessão"}</span></div>
        <div><span className="block text-[10px] font-black uppercase text-zinc-400">Data e horário do lançamento</span>
          <span className="font-bold text-zinc-700 dark:text-zinc-200">{inicial ? fmtDataHora(inicial.created_at) : "Registrado ao salvar"}</span></div>
      </div>

      {!isOnline && <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-semibold"><CloudOff size={14} className="shrink-0 mt-0.5" /> Sem internet: o cadastro fica salvo no aparelho e sincroniza sozinho quando a conexão voltar.</div>}
      {erro && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold">{erro}</div>}
      {verAtual && inicial && <CertificadoViewer bateria={inicial} onClose={() => setVerAtual(false)} />}
    </Modal>
  );
}

// ─── Visualizar ───

function DetalheBateria({ b, hoje, podeEditar, onClose, onEditar, onCertificado }: {
  b: Bateria; hoje: string; podeEditar: boolean; onClose: () => void; onEditar: () => void; onCertificado: () => void;
}) {
  const r = diasRestantes(b.data_vencimento_garantia, hoje);
  const temCert = !!(b.certificado_path || b._certificadoLocal);
  const Item = ({ k, v }: { k: string; v: ReactNode }) => (
    <div className="flex flex-col gap-0.5 min-w-0"><span className="text-[10px] font-black uppercase tracking-wide text-zinc-400">{k}</span><span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 break-words">{v}</span></div>
  );
  return (
    <Modal titulo="Bateria" sub={`${b.modelo} · nº ${b.numero_serie}`} icone={<BatteryCharging size={18} />} onClose={onClose} largura="max-w-2xl"
      rodape={<>
        <button onClick={onClose} className={btnSec}>Fechar</button>
        {podeEditar && <button onClick={onEditar} className={btnPri}><Pencil size={15} /> Editar</button>}
      </>}>
      <div className="flex flex-wrap items-center gap-2">
        <SituacaoBadge venc={b.data_vencimento_garantia} hoje={hoje} />
        <span className="text-xs text-zinc-500">{r >= 0 ? `faltam ${r} dia${r !== 1 ? "s" : ""}` : `vencida há ${-r} dia${r !== -1 ? "s" : ""}`}</span>
        {b._isPendingSync && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600"><CloudOff size={12} /> aguardando sincronização</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Item k="Modelo" v={b.modelo} />
        <Item k="Nº de série" v={<span className="font-mono">{b.numero_serie}</span>} />
        <Item k="Fornecedor" v={b.fornecedor} />
        <Item k="Data da venda" v={fmtData(b.data_venda)} />
        <Item k="Vencimento" v={fmtData(b.data_vencimento_garantia)} />
        <Item k="Garantia" v={`${b.garantia_dias ?? garantiaDias(b.data_venda, b.data_vencimento_garantia)} dias`} />
        <Item k="Lançado por" v={b.criado_por_nome || "—"} />
        <Item k="Data e horário do lançamento" v={fmtDataHora(b.created_at)} />
        {b.atualizado_por_nome && <Item k="Última edição" v={`${b.atualizado_por_nome} · ${fmtDataHora(b.updated_at)}`} />}
      </div>
      {b.observacoes && <Item k="Observações" v={b.observacoes} />}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <FileText size={18} className={temCert ? "text-blue-600" : "text-zinc-300"} />
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 truncate flex-1">{temCert ? b._certificadoLocal?.nome || b.certificado_nome || "Certificado" : "Sem certificado anexado"}</span>
        {temCert && <button onClick={onCertificado} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400"><Eye size={13} /> Ver / baixar</button>}
      </div>
    </Modal>
  );
}

// ─── Tela ───

export default function ControleBateriasClient({ baterias: iniciais, fornecedoresCadastro }: { baterias: Bateria[]; fornecedoresCadastro: string[] }) {
  const { isVisitante } = useAuth();
  const { isOnline } = useOffline();
  const podeEditar = !isVisitante;
  const [baterias, setBaterias] = useState<Bateria[]>(iniciais);
  useEffect(() => { setBaterias(iniciais); }, [iniciais]);

  const [busca, setBusca] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [situacao, setSituacao] = useState<"" | SituacaoGarantia>("");
  const [vencDe, setVencDe] = useState("");
  const [vencAte, setVencAte] = useState("");
  const [ordem, setOrdem] = useState<"asc" | "desc">("asc");
  const [pagina, setPagina] = useState(1);

  const [form, setForm] = useState<{ bateria: Bateria | null } | null>(null);
  const [vendo, setVendo] = useState<Bateria | null>(null);
  const [certificado, setCertificado] = useState<Bateria | null>(null);
  const [excluindo, setExcluindo] = useState<Bateria | null>(null);
  const [excluindoBusy, setExcluindoBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const hoje = hojeIso();
  const fornecedores = useMemo(
    () => Array.from(new Set(baterias.map(b => b.fornecedor.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [baterias]
  );

  const contagem = useMemo(() => {
    const c = { total: baterias.length, ativa: 0, proxima: 0, vencida: 0 };
    baterias.forEach(b => { c[situacaoGarantia(b.data_vencimento_garantia, hoje)]++; });
    return c;
  }, [baterias, hoje]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toUpperCase();
    return baterias
      .filter(b => !q || b.modelo.toUpperCase().includes(q) || b.numero_serie.toUpperCase().includes(q))
      .filter(b => !fornecedor || b.fornecedor.trim() === fornecedor)
      .filter(b => !situacao || situacaoGarantia(b.data_vencimento_garantia, hoje) === situacao)
      .filter(b => !vencDe || b.data_vencimento_garantia.slice(0, 10) >= vencDe)
      .filter(b => !vencAte || b.data_vencimento_garantia.slice(0, 10) <= vencAte)
      .sort((a, b) => (ordem === "asc" ? 1 : -1) * a.data_vencimento_garantia.localeCompare(b.data_vencimento_garantia));
  }, [baterias, busca, fornecedor, situacao, vencDe, vencAte, ordem, hoje]);

  useEffect(() => { setPagina(1); }, [busca, fornecedor, situacao, vencDe, vencAte, ordem]);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  const temFiltro = !!(busca || fornecedor || situacao || vencDe || vencAte);
  const limpar = () => { setBusca(""); setFornecedor(""); setSituacao(""); setVencDe(""); setVencAte(""); };

  const aoSalvar = (b: Bateria, pendente: boolean) => {
    setBaterias(prev => [b, ...prev.filter(x => x.id !== b.id)]);
    if (vendo?.id === b.id) setVendo(b);
    setAviso(pendente ? "Salvo no aparelho. Sincroniza automaticamente quando a internet voltar." : null);
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    setExcluindoBusy(true);
    try {
      if (isOnline) {
        const res = await excluirBateria(excluindo.id);
        if ("error" in res) { alert(res.error); return; }
      } else {
        await localDb.addToQueue("controle_baterias", "delete", { id: excluindo.id });
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      }
      await localDb.delete("controle_baterias", excluindo.id);
      setBaterias(prev => prev.filter(b => b.id !== excluindo.id));
      window.dispatchEvent(new CustomEvent("offline-db-updated-controle_baterias"));
      setExcluindo(null);
    } catch (e) {
      alert("Erro ao excluir: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExcluindoBusy(false);
    }
  };

  const cards: { k: "" | SituacaoGarantia; label: string; valor: number; icon: typeof Boxes; cor: string; num: string }[] = [
    { k: "", label: "Total de baterias", valor: contagem.total, icon: Boxes, cor: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400", num: "text-zinc-800 dark:text-zinc-100" },
    { k: "ativa", label: "Garantia ativa", valor: contagem.ativa, icon: CheckCircle2, cor: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400", num: "text-emerald-700 dark:text-emerald-400" },
    { k: "proxima", label: "Próximas do vencimento", valor: contagem.proxima, icon: AlertTriangle, cor: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400", num: "text-amber-700 dark:text-amber-400" },
    { k: "vencida", label: "Garantia vencida", valor: contagem.vencida, icon: XCircle, cor: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400", num: "text-red-700 dark:text-red-400" },
  ];

  const AcaoBtn = ({ onClick, title, children, perigo }: { onClick: () => void; title: string; children: ReactNode; perigo?: boolean }) => (
    <button onClick={onClick} title={title} aria-label={title}
      className={cn("p-1.5 rounded-lg transition-colors", perigo ? "text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" : "text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30")}>
      {children}
    </button>
  );
  const CertBtn = ({ b }: { b: Bateria }) => (b.certificado_path || b._certificadoLocal) ? (
    <button onClick={() => setCertificado(b)} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"><FileText size={13} /> Ver</button>
  ) : <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>;

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[96rem] mx-auto w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <BatteryCharging className="text-blue-500" size={24} /> Controle de Baterias
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Baterias da frota, garantia e certificados</p>
        </div>
        {podeEditar && (
          <button onClick={() => setForm({ bateria: null })} className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={15} /> NOVA BATERIA
          </button>
        )}
      </div>

      {aviso && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
          <CloudOff size={14} /> {aviso}
          <button onClick={() => setAviso(null)} className="ml-auto p-1" aria-label="Fechar aviso"><X size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <button key={c.label} onClick={() => setSituacao(c.k)} title={c.k ? `Filtrar: ${c.label}` : "Mostrar todas"}
            className={cn("text-left bg-white dark:bg-zinc-950 rounded-xl border p-4 flex items-center gap-3 shadow-sm transition-colors",
              situacao === c.k ? "border-blue-400 ring-1 ring-blue-400" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700")}>
            <div className={cn("p-2 rounded-lg shrink-0", c.cor)}><c.icon size={18} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">{c.label}</p>
              <p className={cn("text-xl font-black leading-tight", c.num)}>{c.valor}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar modelo ou nº de série..."
            className="w-full pl-8 pr-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={fornecedor} onChange={e => setFornecedor(e.target.value)} className="py-2 px-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-sm" aria-label="Fornecedor">
          <option value="">Todos os fornecedores</option>
          {fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={situacao} onChange={e => setSituacao(e.target.value as "" | SituacaoGarantia)} className="py-2 px-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-sm" aria-label="Situação">
          <option value="">Todas as situações</option>
          {(Object.keys(SITUACAO_LABEL) as SituacaoGarantia[]).map(s => <option key={s} value={s}>{SITUACAO_LABEL[s]}</option>)}
        </select>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="font-semibold">Vencimento</span>
          <input type="date" value={vencDe} onChange={e => setVencDe(e.target.value)} className="py-1.5 px-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-sm" aria-label="Vencimento de" />
          <span>até</span>
          <input type="date" value={vencAte} min={vencDe || undefined} onChange={e => setVencAte(e.target.value)} className="py-1.5 px-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-sm" aria-label="Vencimento até" />
        </div>
        {temFiltro && <button onClick={limpar} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline py-2"><X size={13} /> Limpar filtros</button>}
      </div>

      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {filtradas.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-zinc-400">
            <BatteryCharging size={32} className="opacity-40" />
            <p className="text-sm font-semibold">{baterias.length === 0 ? "Nenhuma bateria cadastrada ainda." : "Nenhuma bateria encontrada com esses filtros."}</p>
          </div>
        ) : (
          <>
            {/* Computador/tablet: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-3 py-2.5 text-left font-bold">Modelo</th>
                    <th className="px-3 py-2.5 text-left font-bold">Nº de série</th>
                    <th className="px-3 py-2.5 text-left font-bold">Fornecedor</th>
                    <th className="px-3 py-2.5 text-left font-bold">Data da venda</th>
                    <th className="px-3 py-2.5 text-left font-bold">
                      <button onClick={() => setOrdem(o => (o === "asc" ? "desc" : "asc"))} className="inline-flex items-center gap-1 uppercase hover:text-blue-600" title="Ordenar por vencimento">
                        Vencimento <ArrowUpDown size={11} /> <span className="normal-case text-zinc-400">{ordem === "asc" ? "↑" : "↓"}</span>
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold">Garantia (dias)</th>
                    <th className="px-3 py-2.5 text-left font-bold">Situação</th>
                    <th className="px-3 py-2.5 text-left font-bold">Lançado por</th>
                    <th className="px-3 py-2.5 text-left font-bold">Certificado</th>
                    <th className="px-3 py-2.5 text-right font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(b => (
                    <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-800/70 hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                      <td className="px-3 py-2.5 font-semibold text-zinc-800 dark:text-zinc-100">
                        {b.modelo}
                        {b._isPendingSync && <span title="Aguardando sincronização"><CloudOff size={12} className="inline ml-1.5 text-amber-500" /></span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-zinc-700 dark:text-zinc-200 whitespace-nowrap">{b.numero_serie}</td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300">{b.fornecedor}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmtData(b.data_venda)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap font-semibold">{fmtData(b.data_vencimento_garantia)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right font-bold">{b.garantia_dias ?? garantiaDias(b.data_venda, b.data_vencimento_garantia)}</td>
                      <td className="px-3 py-2.5"><SituacaoBadge venc={b.data_vencimento_garantia} hoje={hoje} /></td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{b.criado_por_nome || "—"}</td>
                      <td className="px-3 py-2.5"><CertBtn b={b} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-0.5">
                          <AcaoBtn onClick={() => setVendo(b)} title="Visualizar"><Eye size={15} /></AcaoBtn>
                          {podeEditar && <AcaoBtn onClick={() => setForm({ bateria: b })} title="Editar"><Pencil size={15} /></AcaoBtn>}
                          {podeEditar && <AcaoBtn onClick={() => setExcluindo(b)} title="Excluir" perigo><Trash2 size={15} /></AcaoBtn>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular: cartões */}
            <div className="md:hidden flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              <button onClick={() => setOrdem(o => (o === "asc" ? "desc" : "asc"))} className="flex items-center gap-1 px-4 py-2 text-[11px] font-bold uppercase text-zinc-500">
                <ArrowUpDown size={12} /> Vencimento {ordem === "asc" ? "mais próximo primeiro" : "mais distante primeiro"}
              </button>
              {visiveis.map(b => (
                <div key={b.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => setVendo(b)} className="text-left min-w-0">
                      <p className="font-bold text-zinc-800 dark:text-zinc-100 truncate">{b.modelo}{b._isPendingSync && <CloudOff size={12} className="inline ml-1.5 text-amber-500" />}</p>
                      <p className="font-mono text-xs font-bold text-zinc-500">{b.numero_serie}</p>
                    </button>
                    <SituacaoBadge venc={b.data_vencimento_garantia} hoje={hoje} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <span><b className="text-zinc-400 font-semibold">Fornecedor:</b> {b.fornecedor}</span>
                    <span><b className="text-zinc-400 font-semibold">Garantia:</b> {b.garantia_dias ?? garantiaDias(b.data_venda, b.data_vencimento_garantia)} dias</span>
                    <span><b className="text-zinc-400 font-semibold">Venda:</b> {fmtData(b.data_venda)}</span>
                    <span><b className="text-zinc-400 font-semibold">Vence:</b> {fmtData(b.data_vencimento_garantia)}</span>
                    <span className="col-span-2"><b className="text-zinc-400 font-semibold">Lançado por:</b> {b.criado_por_nome || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <CertBtn b={b} />
                    <div className="flex gap-1">
                      <AcaoBtn onClick={() => setVendo(b)} title="Visualizar"><Eye size={17} /></AcaoBtn>
                      {podeEditar && <AcaoBtn onClick={() => setForm({ bateria: b })} title="Editar"><Pencil size={17} /></AcaoBtn>}
                      {podeEditar && <AcaoBtn onClick={() => setExcluindo(b)} title="Excluir" perigo><Trash2 size={17} /></AcaoBtn>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 flex-wrap">
              <span>{filtradas.length} bateria{filtradas.length !== 1 ? "s" : ""}{temFiltro ? ` (de ${baterias.length})` : ""}</span>
              {totalPaginas > 1 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={14} /></button>
                  <span className="font-semibold">Página {paginaAtual} de {totalPaginas}</span>
                  <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-40" aria-label="Próxima página"><ChevronRight size={14} /></button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {form && <FormBateria inicial={form.bateria} existentes={baterias} fornecedoresCadastro={fornecedoresCadastro} onClose={() => setForm(null)} onSalvo={aoSalvar} />}
      {vendo && !form && (
        <DetalheBateria b={vendo} hoje={hoje} podeEditar={podeEditar} onClose={() => setVendo(null)}
          onEditar={() => setForm({ bateria: vendo })} onCertificado={() => setCertificado(vendo)} />
      )}
      {certificado && <CertificadoViewer bateria={certificado} onClose={() => setCertificado(null)} />}
      {excluindo && (
        <Modal titulo="Excluir bateria" sub={`${excluindo.modelo} · nº ${excluindo.numero_serie}`} icone={<Trash2 size={18} />} onClose={() => setExcluindo(null)} bloqueado={excluindoBusy}
          rodape={<>
            <button onClick={() => setExcluindo(null)} disabled={excluindoBusy} className={btnSec}>Cancelar</button>
            <button onClick={confirmarExclusao} disabled={excluindoBusy} className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-black disabled:opacity-50">
              <Trash2 size={15} /> {excluindoBusy ? "Excluindo..." : "Excluir"}
            </button>
          </>}>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            A bateria e o certificado anexado serão excluídos. O registro fica guardado no Histórico de Exclusões.
          </p>
        </Modal>
      )}
    </div>
  );
}
