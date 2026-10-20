"use client";

import { useState, useMemo, useRef } from "react";
import { ShieldCheck, Plus, Edit2, Trash2, X, Search, Eye, Download, Upload, Loader2, CreditCard, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOffline } from "@/components/offline-provider";
import { localDb, serializeFormData } from "@/lib/offline-db";
import { ControladoriaFrota, upsertControladoriaFrota, excluirControladoriaFrota, importarControladoriaFrota } from "./actions";
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

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return registros.filter(r => {
      if (termo && !(`${r.nome} ${r.matricula || ""} ${r.cargo || ""}`.toLowerCase().includes(termo))) return false;
      const isDateNull = !r.cnh_validade;
      const dias = isDateNull ? null : calcularDias(r.cnh_validade as string);
      if (filtroCnh === "sem_data" && !isDateNull) return false;
      if (filtroCnh === "vencidos" && (isDateNull || (dias as number) > 0)) return false;
      if (filtroCnh === "proximos" && (isDateNull || (dias as number) <= 0 || (dias as number) > 30)) return false;
      if (filtroCnh === "em_dia" && (isDateNull || (dias as number) <= 30)) return false;
      return true;
    }).sort((a, b) => {
      const da = a.cnh_validade ? calcularDias(a.cnh_validade) : Infinity;
      const db = b.cnh_validade ? calcularDias(b.cnh_validade) : Infinity;
      return da - db;
    });
  }, [registros, busca, filtroCnh]);

  const vencidasCount = useMemo(
    () => registros.filter(r => r.cnh_validade && calcularDias(r.cnh_validade) <= 0).length,
    [registros]
  );

  const abrirNovo = () => {
    setEditingData(null);
    setAnexoUrlAtual("");
    setModalOpen(true);
  };

  const abrirEditar = (item: ControladoriaFrota) => {
    setEditingData(item);
    setAnexoUrlAtual(item.cnh_anexo_url || "");
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
          const updated = { ...editingData, ...serialized, cnh_anexo_url: anexoUrl, _isPendingSync: true };
          await localDb.put("controladoria_frota", updated);
          await localDb.addToQueue("controladoria_frota", "update", { id: editingData.id, ...serialized, cnh_anexo_url: anexoUrl });
          setRegistros(prev => prev.map(r => r.id === editingData.id ? updated : r));
        } else {
          const tempId = `temp_cf_${Date.now()}`;
          const newItem = { id: tempId, ...serialized, cnh_anexo_url: anexoUrl, filial_id: "MATRIZ", _isPendingSync: true };
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
        const json = XLSX.utils.sheet_to_json(worksheet);

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
      Mat: r.matricula || "", Nome: r.nome, "Cargo Básico Descrição": r.cargo || "", Local: r.local || "",
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

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
          <input
            type="text" placeholder="Buscar por nome, matrícula ou cargo..." value={busca}
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
                {["Mat", "Nome", "Cargo", "Local", "Nº Cartão", "Ativo", "CNH Validade", "CNH Anexo", "Ações"].map(h => (
                  <th key={h} className={cn("px-3 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider", h === "Ações" ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
              {filtrados.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-zinc-400 text-sm">Nenhum registro encontrado</td></tr>
              ) : filtrados.map(item => {
                const isDateNull = !item.cnh_validade;
                const dias = isDateNull ? null : calcularDias(item.cnh_validade as string);
                return (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[12px] text-zinc-500">{item.matricula || "-"}</td>
                    <td className="px-3 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200">{item.nome}</td>
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
