"use client";

import React, { useState } from "react";
import { Plus, Layers, Pencil, X } from "lucide-react";
import {
  criarCatalogoItem,
  editarCatalogoItem,
  excluirCatalogoItem,
  criarApontamentoCatalogo,
  editarApontamentoCatalogo,
  excluirApontamentoCatalogo,
} from "./actions";
import { localDb } from "@/lib/offline-db";
import { useOffline } from "@/components/offline-provider";

interface Props {
  catalogos: any[];
  apontamentosCatalogo: any[];
  onCatalogoAdicionado: (item: any) => void;
  onCatalogoRemovido: (id: string) => void;
  onApontamentoAdicionado: (item: any) => void;
  onApontamentoRemovido: (id: string) => void;
}

const CATEGORIAS: { key: string; label: string }[] = [
  { key: "tipo_manutencao", label: "Categoria (Tipo de Manutenção)" },
  { key: "equipe_turno", label: "Equipe / Turno" },
  { key: "supervisor", label: "Supervisor Responsável" },
  { key: "modulo", label: "Módulo" },
  { key: "frente_trabalho", label: "Frente de Trabalho" },
];

function SecaoCategoria({
  categoria,
  label,
  itens,
  onAdicionado,
  onRemovido,
}: {
  categoria: string;
  label: string;
  itens: any[];
  onAdicionado: (item: any) => void;
  onRemovido: (id: string) => void;
}) {
  const { isOnline } = useOffline();
  const [novoValor, setNovoValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleAdicionar = async () => {
    if (!novoValor.trim() || salvando) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    setSalvando(true);
    try {
      const res = await criarCatalogoItem(categoria, novoValor);
      if ("error" in res && res.error) {
        alert(res.error);
        return;
      }
      if (res.data) {
        await localDb.put("mao_obra_catalogos", res.data);
        onAdicionado(res.data);
        setNovoValor("");
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarEdicao = async (item: any) => {
    const valorNormalizado = editValue.trim().toUpperCase();
    setEditingId(null);
    if (!valorNormalizado || valorNormalizado === item.valor) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    const res = await editarCatalogoItem(item.id, valorNormalizado);
    if ("error" in res && res.error) {
      alert(res.error);
      return;
    }
    if (res.data) {
      await localDb.put("mao_obra_catalogos", res.data);
      onAdicionado(res.data);
    }
  };

  const handleExcluir = async (item: any) => {
    if (!confirm(`Remover "${item.valor}" desta lista?`)) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    const res = await excluirCatalogoItem(item.id);
    if ("error" in res && res.error) {
      alert(res.error);
      return;
    }
    await localDb.delete("mao_obra_catalogos", item.id);
    onRemovido(item.id);
  };

  return (
    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
      <h3 className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">{label}</h3>
      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
        {itens.length === 0 && <span className="text-xs text-slate-400 italic">Nenhum item cadastrado.</span>}
        {itens.map(item => (
          editingId === item.id ? (
            <input
              key={item.id}
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleSalvarEdicao(item);
                if (e.key === "Escape") setEditingId(null);
              }}
              onBlur={() => handleSalvarEdicao(item)}
              className="w-32 px-2 py-1 rounded-lg border-2 border-emerald-400 bg-white dark:bg-slate-950 text-[11px] font-bold outline-none"
            />
          ) : (
            <span
              key={item.id}
              className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold"
            >
              {item.valor}
              <button
                type="button"
                onClick={() => { setEditingId(item.id); setEditValue(item.valor); }}
                title="Editar"
                className="p-0.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Pencil size={10} />
              </button>
              <button
                type="button"
                onClick={() => handleExcluir(item)}
                title="Excluir"
                className="p-0.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          )
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={novoValor}
          onChange={e => setNovoValor(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdicionar()}
          placeholder="Adicionar novo item..."
          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="button"
          disabled={salvando}
          onClick={handleAdicionar}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow disabled:opacity-60 shrink-0"
        >
          <Plus size={13} /> Adicionar
        </button>
      </div>
    </div>
  );
}

function ApontamentoChip({
  item,
  color,
  onAdicionado,
  onRemovido,
}: {
  item: any;
  color: "indigo" | "orange";
  onAdicionado: (item: any) => void;
  onRemovido: (id: string) => void;
}) {
  const { isOnline } = useOffline();
  const [editing, setEditing] = useState(false);
  const [codigo, setCodigo] = useState(item.codigo);
  const [descricao, setDescricao] = useState(item.descricao);
  const [produtivo, setProdutivo] = useState(item.produtivo);

  const handleSalvar = async () => {
    setEditing(false);
    const codigoNormalizado = (codigo || "").trim();
    const descricaoNormalizada = (descricao || "").trim().toUpperCase();
    if (!codigoNormalizado || !descricaoNormalizada) return;
    if (codigoNormalizado === item.codigo && descricaoNormalizada === item.descricao && produtivo === item.produtivo) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    const res = await editarApontamentoCatalogo(item.id, codigoNormalizado, descricaoNormalizada, produtivo);
    if ("error" in res && res.error) {
      alert(res.error);
      return;
    }
    if (res.data) {
      await localDb.put("mao_obra_apontamentos_catalogo", res.data);
      onAdicionado(res.data);
    }
  };

  const handleExcluir = async () => {
    if (!confirm(`Remover "${item.codigo} · ${item.descricao}" desta lista?`)) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    const res = await excluirApontamentoCatalogo(item.id);
    if ("error" in res && res.error) {
      alert(res.error);
      return;
    }
    await localDb.delete("mao_obra_apontamentos_catalogo", item.id);
    onRemovido(item.id);
  };

  if (editing) {
    return (
      <span className="flex items-center gap-1 p-1 rounded-lg border-2 border-emerald-400 bg-white dark:bg-slate-950">
        <input
          autoFocus
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSalvar(); if (e.key === "Escape") setEditing(false); }}
          className="w-12 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent text-[10px] font-bold outline-none"
        />
        <input
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSalvar(); if (e.key === "Escape") setEditing(false); }}
          className="w-28 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent text-[10px] font-bold outline-none"
        />
        <select
          value={produtivo ? "1" : "0"}
          onChange={e => setProdutivo(e.target.value === "1")}
          className="px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent text-[10px] font-bold outline-none"
        >
          <option value="1">🟢</option>
          <option value="0">🟠</option>
        </select>
        <button type="button" onClick={handleSalvar} className="p-0.5 text-emerald-600" title="Salvar">✓</button>
      </span>
    );
  }

  return (
    <span
      className={
        color === "indigo"
          ? "flex items-center gap-1 pl-2 pr-1 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10px] font-bold"
          : "flex items-center gap-1 pl-2 pr-1 py-1 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 rounded-lg text-[10px] font-bold"
      }
    >
      {item.codigo} · {item.descricao}
      <button type="button" onClick={() => setEditing(true)} title="Editar" className="p-0.5 opacity-60 hover:opacity-100 transition-opacity">
        <Pencil size={10} />
      </button>
      <button type="button" onClick={handleExcluir} title="Excluir" className="p-0.5 opacity-60 hover:opacity-100 hover:text-red-600 transition-colors">
        <X size={11} />
      </button>
    </span>
  );
}

function SecaoApontamentos({
  itens,
  onAdicionado,
  onRemovido,
}: {
  itens: any[];
  onAdicionado: (item: any) => void;
  onRemovido: (id: string) => void;
}) {
  const { isOnline } = useOffline();
  const [novoCodigo, setNovoCodigo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoProdutivo, setNovoProdutivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const produtivos = itens.filter(i => i.produtivo).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  const improdutivos = itens.filter(i => !i.produtivo).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));

  const handleAdicionar = async () => {
    if (!novoCodigo.trim() || !novaDescricao.trim() || salvando) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    setSalvando(true);
    try {
      const res = await criarApontamentoCatalogo(novoCodigo, novaDescricao, novoProdutivo);
      if ("error" in res && res.error) {
        alert(res.error);
        return;
      }
      if (res.data) {
        await localDb.put("mao_obra_apontamentos_catalogo", res.data);
        onAdicionado(res.data);
        setNovoCodigo("");
        setNovaDescricao("");
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
      <h3 className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">
        Apontamentos (Produtivo / Improdutivo)
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">🟢 Produtivo</span>
          <div className="flex flex-wrap gap-1.5">
            {produtivos.length === 0 && <span className="text-xs text-slate-400 italic">Nenhum item.</span>}
            {produtivos.map(item => (
              <ApontamentoChip key={item.id} item={item} color="indigo" onAdicionado={onAdicionado} onRemovido={onRemovido} />
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400">🟠 Improdutivo</span>
          <div className="flex flex-wrap gap-1.5">
            {improdutivos.length === 0 && <span className="text-xs text-slate-400 italic">Nenhum item.</span>}
            {improdutivos.map(item => (
              <ApontamentoChip key={item.id} item={item} color="orange" onAdicionado={onAdicionado} onRemovido={onRemovido} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-slate-100 dark:border-slate-800">
        <input
          type="text"
          value={novoCodigo}
          onChange={e => setNovoCodigo(e.target.value)}
          placeholder="Código (ex: 217)"
          className="w-28 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <input
          type="text"
          value={novaDescricao}
          onChange={e => setNovaDescricao(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdicionar()}
          placeholder="Descrição (ex: ABASTECER)"
          className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select
          value={novoProdutivo ? "1" : "0"}
          onChange={e => setNovoProdutivo(e.target.value === "1")}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
        >
          <option value="1">🟢 Produtivo</option>
          <option value="0">🟠 Improdutivo</option>
        </select>
        <button
          type="button"
          disabled={salvando}
          onClick={handleAdicionar}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow disabled:opacity-60"
        >
          <Plus size={13} /> Adicionar
        </button>
      </div>
    </div>
  );
}

export default function MaoDeObraCatalogos({
  catalogos,
  apontamentosCatalogo,
  onCatalogoAdicionado,
  onCatalogoRemovido,
  onApontamentoAdicionado,
  onApontamentoRemovido,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">
        <Layers size={15} /> Catálogos — adicione, edite ou remova os itens que aparecem nas listas do formulário
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIAS.map(cat => (
          <SecaoCategoria
            key={cat.key}
            categoria={cat.key}
            label={cat.label}
            itens={catalogos.filter(c => c.categoria === cat.key && c.ativo !== false).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))}
            onAdicionado={onCatalogoAdicionado}
            onRemovido={onCatalogoRemovido}
          />
        ))}
      </div>

      <SecaoApontamentos
        itens={apontamentosCatalogo.filter(i => i.ativo !== false)}
        onAdicionado={onApontamentoAdicionado}
        onRemovido={onApontamentoRemovido}
      />
    </div>
  );
}
