"use client";

import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import { ShieldCheck, Plus, Edit2, Trash2, X, Search, Eye, Download, Upload, Loader2, CreditCard, AlertTriangle, FileText, ChevronDown, ChevronUp, RefreshCcw, History, List, BarChart2, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { useOffline } from "@/components/offline-provider";
import { localDb, serializeFormData } from "@/lib/offline-db";
import { ControladoriaFrota, upsertControladoriaFrota, excluirControladoriaFrota, importarControladoriaFrota, getControladoriaFrotaHistorico } from "./actions";
import { AcaoHistoricoControladoriaFrota, HistoricoControladoriaFrota } from "@/lib/controladoria-frota-historico";
import { createClient } from "@/utils/supabase/client";
import Script from "next/script";

// ── Utilitários ────────────────────────────────────────────────────────────────

function calcularDias(dataStr: string) {
  const data = new Date(dataStr + "T00:00:00");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diffTime = data.getTime() - hoje.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatarData(dataStr: string | null | undefined) {
  if (!dataStr) return "-";
  if (dataStr.includes("-")) return dataStr.split("-").reverse().join("/");
  return dataStr;
}

function getCnhBadge(dias: number | null) {
  if (dias === null) return <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded font-bold text-[10px]">-</span>;
  if (dias <= 0) return <span className="px-2 py-0.5 bg-red-600 text-white rounded font-bold text-[10px]">VENCIDA ({dias}d)</span>;
  if (dias <= 30) return <span className="px-2 py-0.5 bg-yellow-400 text-black rounded font-bold text-[10px]">{dias}d</span>;
  return <span className="px-2 py-0.5 bg-emerald-600 text-white rounded font-bold text-[10px]">{dias}d</span>;
}

function SimNaoBadge({ value }: { value: boolean | null | undefined }) {
  if (value === true) return <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-bold">SIM</span>;
  if (value === false) return <span className="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-[10px] font-bold">NÃO</span>;
  return <span className="text-zinc-300 dark:text-zinc-700 text-[10px]">-</span>;
}

const inputCls = "w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/30";
const labelCls = "text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400";

export default function ControladoriaFrotaClient({ isVisitante, initialRegistros }: { isVisitante: boolean; initialRegistros: ControladoriaFrota[] }) {
  const { isOnline } = useOffline();
  const [registros, setRegistros] = useState<ControladoriaFrota[]>(initialRegistros);
  const [busca, setBusca] = useState("");
  const [filtroCnh, setFiltroCnh] = useState<"todos" | "vencidos" | "proximos" | "em_dia" | "sem_data">("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<ControladoriaFrota | null>(null);
  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [anexoUrlAtual, setAnexoUrlAtual] = useState<string>("");
  const [termosUrlAtual, setTermosUrlAtual] = useState<string>("");
  const [uploadingTermos, setUploadingTermos] = useState(false);

  // ── Histórico (quem criou/editou/excluiu cada registro) — carregado sob
  // demanda na primeira vez que a aba é aberta, mesmo padrão do Backlog. ──
  const [view, setView] = useState<"lista" | "dashboard" | "historico">("lista");
  const [historico, setHistorico] = useState<HistoricoControladoriaFrota[] | null>(null);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const [buscaHistorico, setBuscaHistorico] = useState("");
  const [filtroAcaoHistorico, setFiltroAcaoHistorico] = useState<string>("");
  const [linhaExpandidaHistorico, setLinhaExpandidaHistorico] = useState<string | null>(null);

  useEffect(() => {
    if (view !== "historico" || historico !== null || historicoCarregando) return;
    setHistoricoCarregando(true);
    getControladoriaFrotaHistorico()
      .then(data => setHistorico(data))
      .catch(() => setHistorico([]))
      .finally(() => setHistoricoCarregando(false));
  }, [view, historico, historicoCarregando]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return registros.filter(r => {
      if (termo && !(`${r.nome} ${r.matricula || ""} ${r.cargo || ""} ${r.cpf || ""}`.toLowerCase().includes(termo))) return false;
      const isDateNull = !r.cnh_validade;
      const dias = isDateNull ? null : calcularDias(r.cnh_validade as string);
      if (filtroCnh === "sem_data" && !isDateNull) return false;
      if (filtroCnh === "vencidos" && (isDateNull || (dias as number) > 0)) return false;
      if (filtroCnh === "proximos" && (isDateNull || (dias as number) <= 0 || (dias as number) > 30)) return false;
      if (filtroCnh === "em_dia" && (isDateNull || (dias as number) <= 30)) return false;
      return true;
    }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
  }, [registros, busca, filtroCnh]);

  const vencidasCount = useMemo(
    () => registros.filter(r => r.cnh_validade && calcularDias(r.cnh_validade) <= 0).length,
    [registros]
  );

  // ── Dashboard de CNH ──────────────────────────────────────────────────────
  const STATUS_CNH_COLOR = { vencida: "#dc2626", proxima: "#facc15", em_dia: "#059669", sem_data: "#a1a1aa" };
  const dashboardCnh = useMemo(() => {
    let vencida = 0, proxima = 0, emDia = 0, semData = 0;
    const porLocalVencida = new Map<string, number>();
    const comDias = registros.map(r => {
      if (!r.cnh_validade) { semData++; return { ...r, dias: null as number | null }; }
      const dias = calcularDias(r.cnh_validade);
      if (dias <= 0) { vencida++; porLocalVencida.set(r.local || "Sem local", (porLocalVencida.get(r.local || "Sem local") || 0) + 1); }
      else if (dias <= 30) proxima++;
      else emDia++;
      return { ...r, dias };
    });

    const statusData = [
      { name: "Vencida", value: vencida, color: STATUS_CNH_COLOR.vencida },
      { name: "Vence em 30 dias", value: proxima, color: STATUS_CNH_COLOR.proxima },
      { name: "Em dia", value: emDia, color: STATUS_CNH_COLOR.em_dia },
      { name: "Sem validade", value: semData, color: STATUS_CNH_COLOR.sem_data },
    ].filter(d => d.value > 0);

    const porLocalData = Array.from(porLocalVencida.entries())
      .map(([local, total]) => ({ local, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const urgentes = comDias
      .filter(r => r.dias !== null)
      .sort((a, b) => (a.dias as number) - (b.dias as number))
      .slice(0, 15);

    return { total: registros.length, vencida, proxima, emDia, semData, statusData, porLocalData, urgentes };
  }, [registros]);

  const abrirNovo = () => {
    setEditingData(null);
    setAnexoUrlAtual("");
    setTermosUrlAtual("");
    setModalOpen(true);
  };

  const abrirEditar = (item: ControladoriaFrota) => {
    setEditingData(item);
    setAnexoUrlAtual(item.cnh_anexo_url || "");
    setTermosUrlAtual(item.termos_anexo_url || "");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    if (editingData?.id) formData.set("id", editingData.id);

    try {
      const file = formData.get("cnh_anexo_arquivo") as File;
      let anexoUrl = anexoUrlAtual;
      if (file && file.size > 0) {
        if (!isOnline) {
          alert("Não é possível anexar arquivo offline. Conecte-se à internet para enviar a CNH.");
          setLoading(false);
          return;
        }
        setUploadingAnexo(true);
        const supabase = createClient();
        const ext = file.name.split(".").pop();
        const fileName = `cnh/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("documentos").upload(fileName, file);
        setUploadingAnexo(false);
        if (uploadError) {
          alert("Erro ao enviar anexo da CNH: " + uploadError.message);
          setLoading(false);
          return;
        }
        const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(fileName);
        anexoUrl = publicUrl;
      }
      formData.delete("cnh_anexo_arquivo");
      formData.set("cnh_anexo_url", anexoUrl);

      const termosFile = formData.get("termos_anexo_arquivo") as File;
      let termosUrl = termosUrlAtual;
      if (termosFile && termosFile.size > 0) {
        if (!isOnline) {
          alert("Não é possível anexar arquivo offline. Conecte-se à internet para enviar os termos.");
          setLoading(false);
          return;
        }
        setUploadingTermos(true);
        const supabase = createClient();
        const ext = termosFile.name.split(".").pop();
        const fileName = `termos/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("documentos").upload(fileName, termosFile);
        setUploadingTermos(false);
        if (uploadError) {
          alert("Erro ao enviar anexo dos termos: " + uploadError.message);
          setLoading(false);
          return;
        }
        const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(fileName);
        termosUrl = publicUrl;
      }
      formData.delete("termos_anexo_arquivo");
      formData.set("termos_anexo_url", termosUrl);

      if (isOnline) {
        const res = await upsertControladoriaFrota(formData);
        if (res && "error" in res) throw new Error(res.error);
        const saved = (res as any).data;
        setRegistros(prev => {
          const existe = prev.some(r => r.id === saved.id);
          const next = existe ? prev.map(r => r.id === saved.id ? saved : r) : [...prev, saved];
          return next.sort((a, b) => a.nome.localeCompare(b.nome));
        });
        await localDb.put("controladoria_frota", saved);
      } else {
        const serialized = serializeFormData(formData);
        if (editingData?.id) {
          const updated = { ...editingData, ...serialized, cnh_anexo_url: anexoUrl, termos_anexo_url: termosUrl, _isPendingSync: true };
          await localDb.put("controladoria_frota", updated);
          await localDb.addToQueue("controladoria_frota", "update", { id: editingData.id, ...serialized, cnh_anexo_url: anexoUrl, termos_anexo_url: termosUrl });
          setRegistros(prev => prev.map(r => r.id === editingData.id ? updated : r));
        } else {
          const tempId = `temp_cf_${Date.now()}`;
          const newItem = { id: tempId, ...serialized, cnh_anexo_url: anexoUrl, termos_anexo_url: termosUrl, filial_id: "MATRIZ", _isPendingSync: true };
          await localDb.put("controladoria_frota", newItem);
          await localDb.addToQueue("controladoria_frota", "create", serialized);
          setRegistros(prev => [...prev, newItem as any].sort((a, b) => a.nome.localeCompare(b.nome)));
        }
        alert("✅ Registro salvo localmente! Sincronizará automaticamente quando restabelecer conexão.");
      }

      window.dispatchEvent(new CustomEvent("offline-db-updated-controladoria_frota"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      setModalOpen(false);
      setEditingData(null);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    setDeletingId(null);
    try {
      if (isOnline) {
        const res = await excluirControladoriaFrota(id);
        if (res && "error" in res) { alert(res.error); return; }
        await localDb.delete("controladoria_frota", id);
      } else {
        await localDb.delete("controladoria_frota", id);
        await localDb.addToQueue("controladoria_frota", "delete", { id });
      }
      setRegistros(prev => prev.filter(r => r.id !== id));
      window.dispatchEvent(new CustomEvent("offline-db-updated-controladoria_frota"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    } catch (err: any) {
      alert("Erro ao excluir: " + (err.message || String(err)));
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = (window as any).XLSX;
    if (!XLSX) { alert("A biblioteca do Excel ainda está carregando."); return; }

    if (!isOnline) {
      alert("Importação de planilha exige conexão com a internet.");
      if (importFileInputRef.current) importFileInputRef.current.value = "";
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const fileData = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(fileData, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Relatórios como o "Relação de Cartão de Acesso" trazem uma linha de título
        // (ex: "RELAÇÃO DE CARTÃO DE ACESSO - INVIO TRACK") ANTES da linha de
        // cabeçalhos de verdade — sheet_to_json() sem range usaria essa linha de
        // título como se fossem os nomes das colunas, e a coluna "Nome" nunca seria
        // encontrada. Varre as primeiras linhas brutas pra achar a que realmente
        // contém "nome" como célula, e só então lê a planilha a partir dali.
        const linhasCruas: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
        let linhaCabecalho = 0;
        for (let i = 0; i < Math.min(linhasCruas.length, 10); i++) {
          const temNome = (linhasCruas[i] || []).some(c => String(c ?? "").trim().toLowerCase() === "nome");
          if (temNome) { linhaCabecalho = i; break; }
        }
        const json = XLSX.utils.sheet_to_json(worksheet, { range: linhaCabecalho });

        const res = await importarControladoriaFrota(json);
        if (res && "error" in res) {
          alert(`Erro na importação: ${res.error}`);
        } else {
          alert(`Importação concluída! ${res.novos} novo(s), ${res.atualizados} atualizado(s).`);
          const { syncTables } = await import("@/lib/offline-sync");
          await syncTables(["controladoria_frota"]);
          const fresh = await localDb.getAll<ControladoriaFrota>("controladoria_frota");
          setRegistros(fresh.sort((a, b) => a.nome.localeCompare(b.nome)));
        }
      } catch (err: any) {
        alert("Erro ao processar a planilha: " + (err.message || String(err)));
      } finally {
        setIsImporting(false);
        if (importFileInputRef.current) importFileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportExcel = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) { alert("A biblioteca do Excel ainda está carregando."); return; }
    const rows = filtrados.map(r => ({
      Mat: r.matricula || "", Nome: r.nome, CPF: r.cpf || "", "Cargo Básico Descrição": r.cargo || "", Local: r.local || "",
      Admissão: formatarData(r.data_admissao), "N° Cartão": r.numero_cartao || "",
      Ativo: r.cartao_ativo === true ? "SIM" : r.cartao_ativo === false ? "NÃO" : "",
      "Termo assinado cartão ?": r.termo_assinado_cartao === true ? "SIM" : r.termo_assinado_cartao === false ? "NÃO" : "",
      "Data de entrega": formatarData(r.data_entrega_cartao),
      "Termo de ciência monitoramento": r.termo_ciencia_monitoramento === true ? "SIM" : r.termo_ciencia_monitoramento === false ? "NÃO" : "",
      "Política de frotas": r.politica_frotas === true ? "SIM" : r.politica_frotas === false ? "NÃO" : "",
      "Cartão devolvido": r.cartao_devolvido === true ? "SIM" : r.cartao_devolvido === false ? "NÃO" : "",
      "CNH Número": r.cnh_numero || "", "CNH Categoria": r.cnh_categoria || "", "CNH Validade": formatarData(r.cnh_validade),
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Controladoria de Frota");
    XLSX.writeFile(workbook, "controladoria_gestao_frota.xlsx");
  };

  // ── Histórico: labels, formatação e diff (mesmo padrão do Backlog/Custos) ──
  const ACAO_LABEL: Record<AcaoHistoricoControladoriaFrota, string> = { CRIACAO: "Criação", EDICAO: "Edição", EXCLUSAO: "Exclusão" };
  const ACAO_BADGE: Record<AcaoHistoricoControladoriaFrota, string> = {
    CRIACAO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    EDICAO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    EXCLUSAO: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };

  const CAMPO_LABEL: Record<string, string> = {
    matricula: "Matrícula", nome: "Nome", cpf: "CPF", cargo: "Cargo", local: "Local", data_admissao: "Data de Admissão",
    numero_cartao: "N° Cartão", cartao_ativo: "Ativo", termo_assinado_cartao: "Termo Assinado",
    data_entrega_cartao: "Data de Entrega", termo_ciencia_monitoramento: "Ciência Monitoramento",
    politica_frotas: "Política de Frotas", cartao_devolvido: "Cartão Devolvido",
    cnh_numero: "Nº CNH", cnh_categoria: "Categoria CNH", cnh_validade: "Validade CNH",
    cnh_anexo_url: "Anexo CNH", termos_anexo_url: "Anexo dos Termos", observacoes: "Observações",
  };
  const CAMPO_IGNORAR_HISTORICO = new Set(["id", "filial_id", "created_at", "updated_at", "_isPendingSync"]);

  function formatarValorHistorico(campo: string, valor: any): string {
    if (valor === null || valor === undefined || valor === "") return "-";
    if (["data_admissao", "data_entrega_cartao", "cnh_validade"].includes(campo)) return formatarData(valor);
    if (typeof valor === "boolean") return valor ? "Sim" : "Não";
    if (campo === "cnh_anexo_url" || campo === "termos_anexo_url") return "Anexo enviado";
    return String(valor);
  }

  function montarComparacaoHistorico(antes: any, depois: any) {
    const chaves = Array.from(new Set([...(antes ? Object.keys(antes) : []), ...(depois ? Object.keys(depois) : [])]))
      .filter(k => !CAMPO_IGNORAR_HISTORICO.has(k));
    return chaves.map(campo => {
      const valorAntes = antes ? antes[campo] : undefined;
      const valorDepois = depois ? depois[campo] : undefined;
      return {
        campo,
        label: CAMPO_LABEL[campo] || campo.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        antes: formatarValorHistorico(campo, valorAntes),
        depois: formatarValorHistorico(campo, valorDepois),
        mudou: !!(antes && depois) && String(valorAntes) !== String(valorDepois),
      };
    });
  }

  const historicoFiltrado = useMemo(() => {
    let lista = historico || [];
    if (filtroAcaoHistorico) lista = lista.filter(h => h.acao === filtroAcaoHistorico);
    const term = buscaHistorico.toLowerCase().trim();
    if (term) {
      lista = lista.filter(h => h.descricao?.toLowerCase().includes(term) || h.usuario_nome?.toLowerCase().includes(term));
    }
    return lista;
  }, [historico, filtroAcaoHistorico, buscaHistorico]);

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[96rem] mx-auto w-full">
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="text-blue-500" size={24} /> Controladoria de Gestão de Frota
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Cartão de acesso, termos e controle de vencimento da CNH dos condutores</p>
        </div>
        {!isVisitante && (
          <div className="flex items-center gap-2 flex-wrap">
            <input type="file" accept=".xlsx,.xls,.csv" ref={importFileInputRef} onChange={handleImportExcel} className="hidden" />
            <button
              onClick={() => importFileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {isImporting ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {isImporting ? "Importando..." : "Importar Excel"}
            </button>
            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <Download size={15} /> Exportar Excel
            </button>
            <button onClick={abrirNovo} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">
              <Plus size={15} /> Novo Lançamento
            </button>
          </div>
        )}
      </div>

      {vencidasCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-semibold">
          <AlertTriangle size={16} /> {vencidasCount} condutor(es) com CNH vencida.
        </div>
      )}

      {/* Abas */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setView("lista")}
          className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
            view === "lista" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
        >
          <List size={15} /> Lista
        </button>
        <button
          onClick={() => setView("dashboard")}
          className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
            view === "dashboard" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
        >
          <BarChart2 size={15} /> Dashboard
        </button>
        <button
          onClick={() => setView("historico")}
          className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
            view === "historico" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
        >
          <History size={15} /> Histórico
        </button>
      </div>

      {view === "lista" && (
      <>
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
          <input
            type="text" placeholder="Buscar por nome, matrícula, CPF ou cargo..." value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <select value={filtroCnh} onChange={e => setFiltroCnh(e.target.value as any)} className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="todos">CNH: Todos</option>
          <option value="vencidos">CNH Vencida</option>
          <option value="proximos">CNH Vence em 30 dias</option>
          <option value="em_dia">CNH em dia</option>
          <option value="sem_data">Sem validade cadastrada</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {["Mat", "Nome", "CPF", "Cargo", "Local", "Nº Cartão", "Ativo", "CNH Validade", "CNH Anexo", "Termos", "Ações"].map(h => (
                  <th key={h} className={cn("px-3 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider", h === "Ações" ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
              {filtrados.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-16 text-center text-zinc-400 text-sm">Nenhum registro encontrado</td></tr>
              ) : filtrados.map(item => {
                const isDateNull = !item.cnh_validade;
                const dias = isDateNull ? null : calcularDias(item.cnh_validade as string);
                return (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[12px] text-zinc-500">{item.matricula || "-"}</td>
                    <td className="px-3 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200">{item.nome}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-500">{item.cpf || "-"}</td>
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{item.cargo || "-"}</td>
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{item.local || "-"}</td>
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 text-[11px]">{item.numero_cartao || "-"}</td>
                    <td className="px-3 py-2.5"><SimNaoBadge value={item.cartao_ativo} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-500">{formatarData(item.cnh_validade)}</span>
                        {getCnhBadge(dias)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {item.cnh_anexo_url ? (
                        <div className="flex items-center gap-2">
                          <a href={item.cnh_anexo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-bold flex items-center gap-1"><Eye size={12} /> Ver</a>
                          <a href={item.cnh_anexo_url} download target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-blue-600 text-[10px] font-bold flex items-center gap-1"><Download size={12} /> Baixar</a>
                        </div>
                      ) : <span className="text-zinc-400 text-[10px]">Sem anexo</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {item.termos_anexo_url ? (
                        <div className="flex items-center gap-2">
                          <a href={item.termos_anexo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-bold flex items-center gap-1"><Eye size={12} /> Ver</a>
                          <a href={item.termos_anexo_url} download target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-blue-600 text-[10px] font-bold flex items-center gap-1"><Download size={12} /> Baixar</a>
                        </div>
                      ) : <span className="text-zinc-400 text-[10px]">Sem anexo</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {!isVisitante && (
                        <div className="flex items-center justify-end gap-1">
                          <button title="Editar" onClick={() => abrirEditar(item)} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button title="Excluir" onClick={() => setDeletingId(item.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">{filtrados.length} registro(s)</div>
      </div>
      </>
      )}

      {view === "dashboard" && (
        <div className="flex flex-col gap-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Total de Condutores", value: dashboardCnh.total, color: "#2563eb", icon: Users },
              { label: "CNH Vencida", value: dashboardCnh.vencida, color: STATUS_CNH_COLOR.vencida, icon: AlertTriangle },
              { label: "Vence em 30 dias", value: dashboardCnh.proxima, color: STATUS_CNH_COLOR.proxima, icon: AlertTriangle },
              { label: "CNH em Dia", value: dashboardCnh.emDia, color: STATUS_CNH_COLOR.em_dia, icon: ShieldCheck },
              { label: "Sem Validade Cadastrada", value: dashboardCnh.semData, color: STATUS_CNH_COLOR.sem_data, icon: FileText },
            ].map(k => (
              <div key={k.label} className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-2xl" style={{ background: k.color }} />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{k.label}</p>
                <p className="text-3xl font-black mt-1" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pizza: distribuição por status */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4">
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3">Status da CNH</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboardCnh.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {dashboardCnh.statusData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Barras: CNH vencida por local */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4">
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3">CNH Vencida por Local</h3>
              <div className="h-64">
                {dashboardCnh.porLocalData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-zinc-400">Nenhuma CNH vencida 🎉</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardCnh.porLocalData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="local" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill={STATUS_CNH_COLOR.vencida} radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Tabela: mais urgentes */}
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Mais Urgentes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    {["Nome", "Local", "Cargo", "Validade CNH", "Situação"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-blue-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                  {dashboardCnh.urgentes.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-zinc-400 text-sm">Nenhum condutor com CNH cadastrada</td></tr>
                  ) : dashboardCnh.urgentes.map(r => (
                    <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                      <td className="px-3 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200">{r.nome}</td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{r.local || "-"}</td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{r.cargo || "-"}</td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{formatarData(r.cnh_validade)}</td>
                      <td className="px-3 py-2.5">{getCnhBadge(r.dias)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === "historico" && (
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
              <input
                value={buscaHistorico}
                onChange={e => setBuscaHistorico(e.target.value)}
                placeholder="Buscar por descrição ou usuário..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <select
              value={filtroAcaoHistorico}
              onChange={e => setFiltroAcaoHistorico(e.target.value)}
              className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none"
            >
              <option value="">Todas as Ações</option>
              <option value="CRIACAO">Criação</option>
              <option value="EDICAO">Edição</option>
              <option value="EXCLUSAO">Exclusão</option>
            </select>
          </div>

          {historicoCarregando ? (
            <div className="flex items-center justify-center py-16 text-zinc-400">
              <RefreshCcw className="animate-spin" size={24} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="text-[11px] uppercase">
                  <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    <th className="px-3 py-2 border border-zinc-200 dark:border-zinc-800">Data/Hora</th>
                    <th className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-center">Ação</th>
                    <th className="px-3 py-2 border border-zinc-200 dark:border-zinc-800">Descrição</th>
                    <th className="px-3 py-2 border border-zinc-200 dark:border-zinc-800">Usuário</th>
                    <th className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-center w-16">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700 dark:text-zinc-300 text-xs">
                  {historicoFiltrado.map((h, idx) => (
                    <Fragment key={h.id}>
                      <tr className={idx % 2 === 1 ? "bg-zinc-50/70 dark:bg-zinc-900/40" : ""}>
                        <td className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 whitespace-nowrap">
                          {new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-center">
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap", ACAO_BADGE[h.acao])}>
                            {ACAO_LABEL[h.acao]}
                          </span>
                        </td>
                        <td className="px-3 py-2 border border-zinc-200 dark:border-zinc-800">{h.descricao || "-"}</td>
                        <td className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{h.usuario_nome || "Sistema"}</td>
                        <td className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-center">
                          {(h.dados_antes || h.dados_depois) && (
                            <button onClick={() => setLinhaExpandidaHistorico(linhaExpandidaHistorico === h.id ? null : h.id)} className="p-1 text-zinc-400 hover:text-blue-600">
                              {linhaExpandidaHistorico === h.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                        </td>
                      </tr>
                      {linhaExpandidaHistorico === h.id && (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
                            <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                              <table className="w-full text-left border-collapse bg-white dark:bg-zinc-950">
                                <thead className="text-[10px] uppercase sticky top-0">
                                  <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                    <th className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800">Campo</th>
                                    {h.dados_antes && <th className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800">Antes</th>}
                                    {h.dados_depois && <th className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800">Depois</th>}
                                  </tr>
                                </thead>
                                <tbody className="text-[11px]">
                                  {montarComparacaoHistorico(h.dados_antes, h.dados_depois).map(linha => (
                                    <tr key={linha.campo} className={linha.mudou ? "bg-amber-50 dark:bg-amber-900/10" : ""}>
                                      <td className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{linha.label}</td>
                                      {h.dados_antes && <td className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">{linha.antes}</td>}
                                      {h.dados_depois && <td className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 font-medium text-zinc-800 dark:text-zinc-100">{linha.depois}</td>}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {historicoFiltrado.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 border border-zinc-200 dark:border-zinc-800 text-center text-zinc-500">Nenhum registro de histórico encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de lançamento */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <CreditCard size={18} className="text-blue-500" /> {editingData ? "Editar Lançamento" : "Novo Lançamento"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Identificação</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={labelCls}>Nome *</label>
                  <input name="nome" required defaultValue={editingData?.nome || ""} className={inputCls} /></div>
                <div><label className={labelCls}>Matrícula</label>
                  <input name="matricula" defaultValue={editingData?.matricula || ""} className={inputCls} /></div>
                <div><label className={labelCls}>CPF</label>
                  <input name="cpf" placeholder="000.000.000-00" defaultValue={editingData?.cpf || ""} className={inputCls} /></div>
                <div><label className={labelCls}>Cargo</label>
                  <input name="cargo" defaultValue={editingData?.cargo || ""} className={inputCls} /></div>
                <div><label className={labelCls}>Local</label>
                  <input name="local" defaultValue={editingData?.local || ""} className={inputCls} /></div>
                <div><label className={labelCls}>Data de Admissão</label>
                  <input name="data_admissao" type="date" defaultValue={editingData?.data_admissao || ""} className={inputCls} /></div>
              </div>

              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">Cartão de Acesso</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={labelCls}>N° Cartão</label>
                  <input name="numero_cartao" defaultValue={editingData?.numero_cartao || ""} className={inputCls} /></div>
                <div><label className={labelCls}>Data de Entrega</label>
                  <input name="data_entrega_cartao" type="date" defaultValue={editingData?.data_entrega_cartao || ""} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { name: "cartao_ativo", label: "Ativo", def: editingData?.cartao_ativo },
                  { name: "termo_assinado_cartao", label: "Termo assinado", def: editingData?.termo_assinado_cartao },
                  { name: "termo_ciencia_monitoramento", label: "Ciência monitoramento", def: editingData?.termo_ciencia_monitoramento },
                  { name: "politica_frotas", label: "Política de frotas", def: editingData?.politica_frotas },
                  { name: "cartao_devolvido", label: "Cartão devolvido", def: editingData?.cartao_devolvido },
                ].map(f => (
                  <label key={f.name} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 cursor-pointer">
                    <input type="checkbox" name={f.name} defaultChecked={f.def === true} className="rounded border-zinc-300" />
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{f.label}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className={labelCls}>Anexo dos Termos Assinados (foto ou PDF)</label>
                <input type="file" name="termos_anexo_arquivo" accept="image/*,application/pdf" className={inputCls} />
                {termosUrlAtual && (
                  <p className="text-xs text-blue-600 mt-1">Anexo atual: <a href={termosUrlAtual} target="_blank" rel="noreferrer" className="underline">Visualizar</a></p>
                )}
                {uploadingTermos && <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Enviando anexo...</p>}
              </div>

              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">CNH do Condutor</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className={labelCls}>Número da CNH</label>
                  <input name="cnh_numero" defaultValue={editingData?.cnh_numero || ""} className={inputCls} /></div>
                <div><label className={labelCls}>Categoria</label>
                  <input name="cnh_categoria" placeholder="Ex: AB, D, E" defaultValue={editingData?.cnh_categoria || ""} className={inputCls} /></div>
                <div><label className={labelCls}>Validade</label>
                  <input name="cnh_validade" type="date" defaultValue={editingData?.cnh_validade || ""} className={inputCls} /></div>
              </div>
              <div>
                <label className={labelCls}>Anexo da CNH (foto ou PDF)</label>
                <input type="file" name="cnh_anexo_arquivo" accept="image/*,application/pdf" className={inputCls} />
                {anexoUrlAtual && (
                  <p className="text-xs text-blue-600 mt-1">Anexo atual: <a href={anexoUrlAtual} target="_blank" rel="noreferrer" className="underline">Visualizar</a></p>
                )}
                {uploadingAnexo && <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Enviando anexo...</p>}
              </div>

              <div>
                <label className={labelCls}>Observações</label>
                <textarea name="observacoes" rows={2} defaultValue={editingData?.observacoes || ""} className={cn(inputCls, "resize-none")} />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
                <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                  {loading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm shadow-2xl">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Tem certeza que deseja excluir este registro?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
