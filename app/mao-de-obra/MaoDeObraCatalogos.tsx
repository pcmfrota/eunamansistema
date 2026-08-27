"use client";

import React, { useState } from "react";
import { Plus, Layers } from "lucide-react";
import { criarCatalogoItem, criarApontamentoCatalogo } from "./actions";
import { localDb } from "@/lib/offline-db";

interface Props {
  catalogos: any[];
  apontamentosCatalogo: any[];
  onCatalogoAdicionado: (item: any) => void;
  onApontamentoAdicionado: (item: any) => void;
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
  onAdicionado
}: {
  categoria: string;
  label: string;
  itens: any[];
  onAdicionado: (item: any) => void;
}) {
  const [novoValor, setNovoValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleAdicionar = async () => {
    if (!novoValor.trim() || salvando) return;
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

  return (
    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
      <h3 className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">{label}</h3>
      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
        {itens.length === 0 && <span className="text-xs text-slate-400 italic">Nenhum item cadastrado.</span>}
        {itens.map(item => (
          <span
            key={item.id}
            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold"
          >
            {item.valor}
          </span>
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

function SecaoApontamentos({
  itens,
  onAdicionado
}: {
  itens: any[];
  onAdicionado: (item: any) => void;
}) {
  const [novoCodigo, setNovoCodigo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoProdutivo, setNovoProdutivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const produtivos = itens.filter(i => i.produtivo).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  const improdutivos = itens.filter(i => !i.produtivo).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));

  const handleAdicionar = async () => {
    if (!novoCodigo.trim() || !novaDescricao.trim() || salvando) return;
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
              <span key={item.id} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10px] font-bold">
                {item.codigo} · {item.descricao}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400">🟠 Improdutivo</span>
          <div className="flex flex-wrap gap-1.5">
            {improdutivos.length === 0 && <span className="text-xs text-slate-400 italic">Nenhum item.</span>}
            {improdutivos.map(item => (
              <span key={item.id} className="px-2 py-1 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 rounded-lg text-[10px] font-bold">
                {item.codigo} · {item.descricao}
              </span>
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

export default function MaoDeObraCatalogos({ catalogos, apontamentosCatalogo, onCatalogoAdicionado, onApontamentoAdicionado }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">
        <Layers size={15} /> Catálogos — adicione aqui os itens que aparecem nas listas do formulário
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIAS.map(cat => (
          <SecaoCategoria
            key={cat.key}
            categoria={cat.key}
            label={cat.label}
            itens={catalogos.filter(c => c.categoria === cat.key).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))}
            onAdicionado={onCatalogoAdicionado}
          />
        ))}
      </div>

      <SecaoApontamentos itens={apontamentosCatalogo} onAdicionado={onApontamentoAdicionado} />
    </div>
  );
}
