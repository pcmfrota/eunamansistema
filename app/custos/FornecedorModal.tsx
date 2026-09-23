"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { localDb, serializeFormData } from "@/lib/offline-db";
import { upsertFornecedor, Fornecedor } from "./actions";

export default function FornecedorModal({
  isOpen,
  onClose,
  editingData,
  isOnline,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingData: Fornecedor | null;
  isOnline: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!isOpen) return null;

  const inputCls = "w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 outline-none focus:border-emerald-500";

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      if (editingData?.id) formData.set("id", editingData.id);

      const storeItem: any = {
        id: editingData?.id || `fornecedor_${Date.now()}`,
        nome_fantasia: String(formData.get("nome_fantasia") || "").trim(),
        razao_social: (formData.get("razao_social") as string)?.trim() || null,
        filial_id: editingData?.filial_id || "MATRIZ",
      };

      if (isOnline) {
        const result = await upsertFornecedor(formData);
        if (result?.error) throw new Error(result.error);
        await localDb.put("custos_fornecedores", storeItem);
      } else {
        const serialized = serializeFormData(formData);
        await localDb.put("custos_fornecedores", { ...storeItem, _isPendingSync: true });
        if (editingData?.id) {
          await localDb.addToQueue("custos_fornecedores", "update", { id: editingData.id, ...serialized });
        } else {
          await localDb.addToQueue("custos_fornecedores", "create", serialized);
        }
      }

      window.dispatchEvent(new CustomEvent("offline-db-updated-custos_fornecedores"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      onClose();
    } catch (err: any) {
      alert("Erro ao salvar fornecedor: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {editingData?.id ? "Editar Fornecedor" : "Novo Fornecedor"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={20} />
          </button>
        </div>

        <form ref={formRef} onSubmit={salvar} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Nome Fantasia</label>
            <input name="nome_fantasia" required defaultValue={editingData?.nome_fantasia || ""} className={inputCls} placeholder="Ex: Malut Pneus" autoFocus />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Razão Social</label>
            <input name="razao_social" defaultValue={editingData?.razao_social || ""} className={inputCls} placeholder="Ex: Malut Comércio de Pneus LTDA" />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border dark:border-zinc-800 rounded-lg">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {loading ? "Salvando..." : "Salvar Fornecedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
