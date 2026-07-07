"use client";

import { useState } from "react";
import { salvarAfiacao } from "./actions";
import { MATERIAIS_DB, ESTADO_RECEBIMENTO, TIPO_DESCARTE } from "./materiaisDB";

// ─────────────────────────────────────────────────────────────
// Constantes compartilhadas
// ─────────────────────────────────────────────────────────────
export const MAQUINAS_POR_MODULO: Record<string, string[]> = {
  MA02: ["HVE-0546","HVE-0660","HVE-0426","HVE-0653","HVE-0481","HVE-0480","HVE-0483","HVE-0431"],
  MA04: ["HVE-0552","HVE-0553","HVE-0554","HVE-0555","HVE-0556","HVE-0557"],
  MA05: ["HVE-0655","HVE-0434","HVE-0656","HVE-0482","HVE-0432","HVE-0548","HVE-0547","HVE-0435","HVE-0690","HVE-0654","HVE-0658","HVE-0659","HVE-0427","HVE-0430"],
  MA06: ["HVE-0560","HVE-0561","HVE-0562","HVE-0563","HVE-0564","HVE-0565"],
  MA07: ["HVE-0550","HVE-0634","HVE-0661","HVE-0429","HVE-0635","HVE-0636","HVE-0551","HVE-0484","HVE-0657","HVE-0689","HVE-0549","HVE-0633","HVE-0433","HVE-0398"],
};

export const AFIADORES = [
  "KHAYNAN FERNANDES FERREIRA","FELYPE DANIEL MACEDO VIEIRA","JOSIEL DA SILVA RIBEIRO",
  "GEOVANE DE ARAUJO MORAES","LUCAS PEREIRA ALVES",
];

export const MODULOS = ["MA02","MA04","MA05","MA06","MA07"];

// Derivar tipo_formulario a partir do CÓD do material
function tipoFormularioPorCod(cod: string): string {
  if (cod === "15")                              return "BAIXA DE MATERIAL ROLLTOP";
  if (cod === "20")                              return "BAIXA DE CHAPA MAQNOVA";
  if (cod === "40")                              return "BAIXA DE CHAPA ROTARY-AX";
  if (["16","17","18","21","23"].includes(cod))  return "BAIXA DE MATERIAL SABRE";
  if (["2","3","10","11","22"].includes(cod))    return "BAIXAS DE EMENDAS E BOLSAS";
  if (["12","13","14"].includes(cod))            return "BAIXA DE MATERIAL CORRENTE";
  if (cod === "1")                               return "BAIXA DE MATERIAL CORRENTE";
  return "BAIXA DE MATERIAL CORRENTE";
}

// Gerar número de ficha automático
function gerarFicha(): string {
  return "761" + Math.floor(100000 + Math.random() * 900000).toString();
}

// ─────────────────────────────────────────────────────────────
// Campos dinâmicos por tipo de lançamento
// ─────────────────────────────────────────────────────────────
export function renderCamposDetalhes(
  tipo_formulario: string,
  detalhes: any,
  onChange: (field: string, value: string) => void,
  auxiliares: any[] = []
) {
  if (!tipo_formulario) return null;
  const sel = (cls = "") =>
    `mt-1 block w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${cls}`;

  const estadosDb = auxiliares.filter(i => i.category === "estado_recebimento").map(i => i.value);
  const listaEstados = estadosDb.length > 0 ? estadosDb : Object.values(ESTADO_RECEBIMENTO);

  const descartesDb = auxiliares.filter(i => i.category === "tipo_descarte").map(i => i.value);
  const listaDescartes = descartesDb.length > 0 ? descartesDb : Object.values(TIPO_DESCARTE);

  const isCorrente  = ["BAIXA DE MATERIAL CORRENTE","ESTADO DE RECEBIMENTO CORRENTE"].includes(tipo_formulario);
  const isSabre     = ["BAIXA DE MATERIAL SABRE","ESTADO DE RECEBIMENTO SABRE"].includes(tipo_formulario);
  const isRecebimento = tipo_formulario.includes("RECEBIMENTO");
  const isEmenda    = tipo_formulario === "BAIXAS DE EMENDAS E BOLSAS";

  return (
    <div className="space-y-4 mt-4 border-t pt-4">
      {/* Quantidade */}
      <div>
        <label className="block text-sm font-semibold text-gray-600">SELECIONE A QUANTIDADE*</label>
        <select
          required
          className={sel()}
          value={detalhes.corrente || detalhes.sabre || detalhes.quantidade || ""}
          onChange={(e) => {
            const val = e.target.value;
            if (isCorrente) onChange("corrente", val);
            else if (isEmenda) onChange("quantidade", val);
            else onChange("sabre", val);
          }}
        >
          <option value="">Selecione...</option>
          {(isEmenda
            ? [1,2,3,4,5,10,20,50,100,200,500,1000]
            : isCorrente
              ? [1,2,3,4,5,6,7,8]
              : [1,2,3,4]
          ).map(n => <option key={n} value={String(n)}>{n}</option>)}
        </select>
      </div>

      {/* Motivo / Estado */}
      <div>
        <label className="block text-sm font-semibold text-gray-600">
          {isRecebimento ? "ESTADO DO MATERIAL*" : "MOTIVO DE SUBSTITUIÇÃO*"}
        </label>
        <select
          required
          className={sel()}
          value={detalhes.motivo || detalhes.estado_corrente || detalhes.recebimento_sabre || ""}
          onChange={(e) => {
            const val = e.target.value;
            onChange("motivo", val);
            if (isRecebimento) {
              if (isCorrente) onChange("estado_corrente", val);
              else onChange("recebimento_sabre", val);
            }
          }}
        >
          <option value="">Selecione...</option>
          {(isRecebimento ? listaEstados : listaDescartes).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export const TIPO_FORMULARIO_OPCOES = [
  "ESTADO DE RECEBIMENTO CORRENTE","ESTADO DE RECEBIMENTO SABRE",
  "BAIXA DE MATERIAL CORRENTE","BAIXA DE MATERIAL SABRE","BAIXA DE MATERIAL ROLLTOP",
  "BAIXA DE CHAPA MAQNOVA","BAIXA DE CHAPA ROTARY-AX","BAIXAS DE EMENDAS E BOLSAS",
];

// ─────────────────────────────────────────────────────────────
// Componente AfiacaoForm
// ─────────────────────────────────────────────────────────────
export default function AfiacaoForm({
  onSuccess,
  auxiliares = [],
}: {
  onSuccess: (data: any) => void;
  auxiliares?: any[];
}) {
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");
  const [formData, setFormData] = useState({
    data: "",
    afiador: "",
    modulo: "",
    maquina: "",
    letra: "",
    kit: "",
    tipo_formulario: "",
    detalhes: {} as any,
  });

  // Material selecionado
  const materialSelecionado = MATERIAIS_DB.find(m => m.cod === formData.detalhes.cod);

  const handleChange = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleDetalhesChange = (field: string, value: string) => {
    setFormData(prev => {
      const isRecebimento = prev.tipo_formulario.includes("RECEBIMENTO");
      const isCorrente = ["BAIXA DE MATERIAL CORRENTE","ESTADO DE RECEBIMENTO CORRENTE"].includes(prev.tipo_formulario);
      const updatedDetalhes = { ...prev.detalhes, [field]: value };

      if (["corrente","sabre","quantidade"].includes(field)) {
        const qtd = parseFloat(value) || 0;
        updatedDetalhes.qtd_expedida = String(qtd);

        if (isRecebimento) {
          // No recebimento, qtd_baixas = 0
          updatedDetalhes.qtd_baixas = "0";
        } else if (field === "corrente" && isCorrente) {
          // Correntes: 1 corrente = 0,057 (fator Suzano)
          const baixa = Math.round(qtd * 0.057 * 1000) / 1000;
          updatedDetalhes.qtd_baixas = String(baixa);
        } else {
          // Sabre, Rolltop, Chapa, Emendas: qtd_baixas = qtd selecionada
          updatedDetalhes.qtd_baixas = String(qtd);
        }
      }

      return { ...prev, detalhes: updatedDetalhes };
    });
  };

  // Ao selecionar um material da lista
  const handleSelectMaterial = (mat: typeof MATERIAIS_DB[0]) => {
    const tipo = tipoFormularioPorCod(mat.cod);
    const isRecebimento = tipo.includes("RECEBIMENTO");
    setMaterialSearch("");
    setFormData(prev => ({
      ...prev,
      tipo_formulario: tipo,
      detalhes: {
        cod: mat.cod,
        num_ficha: gerarFicha(),
        ficha_fisica: "OK",
        novo_velho: "NOVO",
        carga: "1",
        uni: "20",
        qtd_expedida: "1",
        qtd_baixas: isRecebimento ? "0" : "1",
        cc: prev.detalhes.cc || "",
        ni: mat.ni,
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.detalhes.cod) {
      alert("Selecione um material da lista antes de salvar.");
      return;
    }
    setLoading(true);
    try {
      const result = await salvarAfiacao(formData);
      if (result.success) {
        setSucesso(true);
        onSuccess(result.data);
        setTimeout(() => setSucesso(false), 3000);
        setFormData({ data:"",afiador:"",modulo:"",maquina:"",letra:"",kit:"",tipo_formulario:"",detalhes:{} });
        setMaterialSearch("");
      } else {
        alert("Erro ao salvar: " + result.error);
      }
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const afiadoresCadastrados = auxiliares.filter(i => i.category === "afiador").map(i => i.value);
  const listaAfiadores = afiadoresCadastrados.length > 0 ? afiadoresCadastrados : AFIADORES;

  const maquinasDoModulo = (modulo: string) => {
    const maqsCadastradas = auxiliares
      .filter(i => i.category === "maquina" && i.modulo === modulo)
      .map(i => i.value);
    return maqsCadastradas.length > 0 ? maqsCadastradas : (MAQUINAS_POR_MODULO[modulo] || []);
  };
  const maquinas = maquinasDoModulo(formData.modulo);

  // Filtro de materiais para busca
  const termoBusca = materialSearch.toLowerCase();
  const materiaisFiltrados = MATERIAIS_DB.filter(m =>
    !termoBusca ||
    m.material.toLowerCase().includes(termoBusca) ||
    m.cod.includes(termoBusca) ||
    m.ni.includes(termoBusca)
  );

  const sel = "block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 pb-2 border-b">
        <span className="text-2xl">📝</span>
        <h2 className="text-lg font-bold text-gray-800">Novo Lançamento de Afiação</h2>
      </div>

      {sucesso && (
        <div className="bg-green-50 border border-green-300 text-green-700 rounded-lg px-4 py-3 flex items-center gap-2 text-sm font-medium">
          ✅ Lançamento salvo com sucesso!
        </div>
      )}

      {/* ── Data + Afiador ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">DATA*</label>
          <input type="date" required className={sel} value={formData.data}
            onChange={e => handleChange("data", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">AFIADOR*</label>
          <select required className={sel} value={formData.afiador}
            onChange={e => handleChange("afiador", e.target.value)}>
            <option value="">Selecione o afiador...</option>
            {listaAfiadores.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* ── Módulo + Letra + Kit ── */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">MÓDULO*</label>
          <select required className={sel} value={formData.modulo}
            onChange={e => { handleChange("modulo", e.target.value); handleChange("maquina", ""); }}>
            <option value="">Módulo...</option>
            {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">LETRA*</label>
          <select required className={sel} value={formData.letra}
            onChange={e => handleChange("letra", e.target.value)}>
            <option value="">Letra...</option>
            {["A","B","C","D"].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Nª KIT*</label>
          <select required className={sel} value={formData.kit}
            onChange={e => handleChange("kit", e.target.value)}>
            <option value="">Kit...</option>
            {Array.from({ length: 15 }, (_, i) => i + 1).map(k => (
              <option key={k} value={k.toString()}>{k}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Máquinas ── */}
      {formData.modulo && (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            🚜 EQUIPAMENTOS DO {formData.modulo}*
          </label>
          {maquinas.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {maquinas.map(maq => (
                <label key={maq}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-all ${
                    formData.maquina === maq
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                  }`}>
                  <input type="radio" name="maquina" value={maq}
                    checked={formData.maquina === maq}
                    onChange={e => handleChange("maquina", e.target.value)}
                    className="sr-only" required />
                  {maq}
                </label>
              ))}
            </div>
          ) : (
            <input type="text" placeholder="Ex: HVE-0000" className={sel}
              value={formData.maquina}
              onChange={e => handleChange("maquina", e.target.value)} />
          )}
        </div>
      )}

      {/* ── Seleção de Material (novo fluxo) ── */}
      <div className="border-t pt-4">
        <label className="block text-sm font-semibold text-gray-600 mb-1">
          📦 SELECIONAR MATERIAL*
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Busque e selecione o material. O tipo de lançamento será definido automaticamente.
        </p>

        {/* Material selecionado — exibir card */}
        {materialSelecionado ? (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">CÓD {materialSelecionado.cod}</span>
              <p className="font-bold text-blue-800 text-sm">{materialSelecionado.material}</p>
              <p className="text-xs text-blue-500">NI: {materialSelecionado.ni} &nbsp;|&nbsp; Custo unit.: {new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(materialSelecionado.custo)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Tipo: <span className="font-semibold text-slate-700">{formData.tipo_formulario}</span></p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, tipo_formulario: "", detalhes: {} }));
                setMaterialSearch("");
              }}
              className="text-xs text-rose-500 hover:text-rose-700 font-bold px-3 py-1.5 rounded-lg hover:bg-rose-50 border border-rose-200 transition-all"
            >
              ✕ Trocar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="🔍 Buscar material por nome, código ou NI..."
              className={sel}
              value={materialSearch}
              onChange={e => setMaterialSearch(e.target.value)}
              autoComplete="off"
            />
            {/* Lista de materiais filtrados */}
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700 text-white text-xs sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-12">CÓD</th>
                    <th className="px-3 py-2 text-left">Material</th>
                    <th className="px-3 py-2 text-left w-28">NI</th>
                    <th className="px-3 py-2 text-right w-24">Custo Unit.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {materiaisFiltrados.map(mat => (
                    <tr
                      key={mat.cod}
                      onClick={() => handleSelectMaterial(mat)}
                      className="cursor-pointer hover:bg-blue-50 transition-colors active:bg-blue-100"
                    >
                      <td className="px-3 py-2 font-bold font-mono text-slate-500">{mat.cod}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{mat.material}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{mat.ni}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-600">
                        {new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(mat.custo)}
                      </td>
                    </tr>
                  ))}
                  {materiaisFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-gray-400 text-xs">
                        Nenhum material encontrado para "{materialSearch}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Campos dinâmicos por tipo ── */}
      {formData.tipo_formulario && renderCamposDetalhes(
        formData.tipo_formulario, formData.detalhes, handleDetalhesChange, auxiliares
      )}

      {/* ── Controle da Ficha ── */}
      {formData.tipo_formulario && (
        <div className="space-y-4 border-t pt-4 mt-4 bg-slate-50/50 p-4 rounded-xl border border-gray-100">
          <h3 className="font-bold text-sm text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
            📋 Informações de Controle da Ficha
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">Nª FICHA (Automático)</label>
              <input readOnly type="text"
                className="mt-1 block w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 font-mono text-indigo-600 font-bold outline-none cursor-not-allowed"
                value={formData.detalhes.num_ficha || ""} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">FICHA FÍSICA*</label>
              <select required
                className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={formData.detalhes.ficha_fisica || "OK"}
                onChange={e => handleDetalhesChange("ficha_fisica", e.target.value)}>
                <option value="OK">OK</option>
                <option value="PENDENTE">PENDENTE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">NOVO/VELHO*</label>
              <select required
                className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold"
                value={formData.detalhes.novo_velho || "NOVO"}
                onChange={e => handleDetalhesChange("novo_velho", e.target.value)}>
                <option value="NOVO">NOVO</option>
                <option value="VELHO">VELHO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">CARGA*</label>
              <input required type="text"
                className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                value={formData.detalhes.carga || "1"}
                onChange={e => handleDetalhesChange("carga", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">UNI (Opcional)</label>
              <input type="text"
                className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                value={formData.detalhes.uni || ""}
                onChange={e => handleDetalhesChange("uni", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">Qtd. Expedida*</label>
              <input required type="number" step="any"
                className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                value={formData.detalhes.qtd_expedida ?? "1"}
                onChange={e => handleDetalhesChange("qtd_expedida", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">Qtd Baixas*</label>
              <input required type="number" step="any"
                className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                value={formData.detalhes.qtd_baixas ?? "1"}
                onChange={e => handleDetalhesChange("qtd_baixas", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">Centro de Custo (Opcional)</label>
              <input type="text" placeholder="Auto-calculado"
                className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                value={formData.detalhes.cc || ""}
                onChange={e => handleDetalhesChange("cc", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">Status Baixa (Opcional)</label>
              <input type="text"
                className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={formData.detalhes.status_baixa || ""}
                onChange={e => handleDetalhesChange("status_baixa", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">Un. (Opcional)</label>
              <input type="text" placeholder="Ex: PC"
                className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={formData.detalhes.un || ""}
                onChange={e => handleDetalhesChange("un", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Botão Salvar ── */}
      <div className="pt-2">
        <button type="submit" disabled={loading || !formData.detalhes.cod}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all">
          {loading ? "⏳ Salvando..." : "💾 Salvar Lançamento"}
        </button>
        {!formData.detalhes.cod && (
          <p className="text-center text-xs text-gray-400 mt-2">Selecione um material para habilitar o salvamento</p>
        )}
      </div>
    </form>
  );
}
