"use client";

import { useState } from "react";
import { salvarAfiacao } from "./actions";

// ─────────────────────────────────────────────────────────────
// Constantes compartilhadas (exportadas para reutilizar no modal)
// ─────────────────────────────────────────────────────────────
export const TIPO_FORMULARIO_OPCOES = [
  "ESTADO DE RECEBIMENTO CORRENTE",
  "ESTADO DE RECEBIMENTO SABRE",
  "BAIXA DE MATERIAL CORRENTE",
  "BAIXA DE MATERIAL SABRE",
  "BAIXA DE MATERIAL ROLLTOP",
  "BAIXA DE CHAPA MAQNOVA",
  "BAIXA DE CHAPA ROTARY-AX",
  "BAIXAS DE EMENDAS E BOLSAS",
];

export const MAQUINAS_POR_MODULO: Record<string, string[]> = {
  MA02: ["HVE-0546", "HVE-0660", "HVE-0426", "HVE-0653", "HVE-0481", "HVE-0480", "HVE-0483", "HVE-0431"],
  MA04: ["HVE-0552", "HVE-0553", "HVE-0554", "HVE-0555", "HVE-0556", "HVE-0557"],
  MA05: ["HVE-0655", "HVE-0434", "HVE-0656", "HVE-0482", "HVE-0432", "HVE-0548", "HVE-0547", "HVE-0435", "HVE-0690", "HVE-0654", "HVE-0658", "HVE-0659", "HVE-0427", "HVE-0430"],
  MA06: ["HVE-0560", "HVE-0561", "HVE-0562", "HVE-0563", "HVE-0564", "HVE-0565"],
  MA07: ["HVE-0550", "HVE-0634", "HVE-0661", "HVE-0429", "HVE-0635", "HVE-0636", "HVE-0551", "HVE-0484", "HVE-0657", "HVE-0689", "HVE-0549", "HVE-0633", "HVE-0433", "HVE-0398"],
};

export const AFIADORES = [
  "KHAYNAN FERNANDES FERREIRA",
  "FELYPE DANIEL MACEDO VIEIRA",
  "JOSIEL DA SILVA RIBEIRO",
  "GEOVANE DE ARAUJO MORAES",
  "LUCAS PEREIRA ALVES",
];

export const MODULOS = ["MA02", "MA04", "MA05", "MA06", "MA07"];

// ─────────────────────────────────────────────────────────────
// Renderiza os campos específicos de cada tipo de formulário
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

  const estadosDb = auxiliares.filter(item => item.category === "estado_recebimento").map(item => item.value);
  const listaEstados = estadosDb.length > 0 ? estadosDb : [
    "QUEIMADA (O)","TORCIDA (O)","CONTAMINADA (O) COM AREIA","SEM LUBRIFICAÇÃO","NORMAL",
    "FALTANDO PEDAÇO","ELOS DE TRAÇÃO DANIFICADOS","QUEBRADA","FACAS AMASSADAS",
    "PEÇA NÃO ENTREGUE","PEÇA NÃO UTILIZADA","MATERIAL DO KIT INCORRETO",
    "EMPENADO","PONTEIRA FECHADA","CANALETA DANIFICADA","CANALETA FECHADA","ROLLTOP DANIFICADO"
  ];

  const descartesDb = auxiliares.filter(item => item.category === "tipo_descarte").map(item => item.value);
  const listaDescartes = descartesDb.length > 0 ? descartesDb : [
    "MAL USO","PERDA","QUEBRA","LUBRIFICAÇÃO","VIDA ÚTIL","ACIDENTE","TORÇÃO","PONTEIRA QUEIMADA",
    "PONTEIRA FECHADA","PONTEIRA QUEBRADA","MÁQ. EM INÍCIO DE OPERAÇÃO"
  ];

  const materiaisDb = auxiliares.filter(item => item.category === "material").map(item => item.value);
  const listaMateriais = materiaisDb.length > 0 ? materiaisDb : ["EMENDA MACHO","EMENDA FEMEA","BOLSAS","REBITE"];

  if (tipo_formulario === "ESTADO DE RECEBIMENTO CORRENTE") {
    return (
      <div className="space-y-4 mt-4 border-t pt-4">
        <h3 className="font-bold text-base text-gray-700 uppercase tracking-wide">🔗 Recebimento Corrente</h3>
        <div>
          <label className="block text-sm font-semibold text-gray-600">CABEÇOTE*</label>
          <select required className={sel()} value={detalhes.cabecote || ""} onChange={(e) => onChange("cabecote", e.target.value)}>
            <option value="">Selecione...</option>
            {["370E (OREGON)", "370E (MAQNOVA)", "370E (KOMATSU)"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600">CORRENTE*</label>
          <select required className={sel()} value={detalhes.corrente || ""} onChange={(e) => onChange("corrente", e.target.value)}>
            <option value="">Selecione...</option>
            {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={`CORRENTE ${n}`}>CORRENTE {n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600">ESTADO DA CORRENTE*</label>
          <select required className={sel()} value={detalhes.estado_corrente || ""} onChange={(e) => onChange("estado_corrente", e.target.value)}>
            <option value="">Selecione o estado...</option>
            {listaEstados.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (tipo_formulario === "ESTADO DE RECEBIMENTO SABRE") {
    return (
      <div className="space-y-4 mt-4 border-t pt-4">
        <h3 className="font-bold text-base text-gray-700 uppercase tracking-wide">⚔️ Recebimento Sabre</h3>
        <div>
          <label className="block text-sm font-semibold text-gray-600">CABEÇOTE*</label>
          <select required className={sel()} value={detalhes.cabecote || ""} onChange={(e) => onChange("cabecote", e.target.value)}>
            <option value="">Selecione...</option>
            {["370E JET FIT","SABRE MAQNOVA","KOMATSU 370E","SABRE ROTARY-AX"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600">SABRE*</label>
          <select required className={sel()} value={detalhes.sabre || ""} onChange={(e) => onChange("sabre", e.target.value)}>
            <option value="">Selecione...</option>
            {[1,2,3,4,5].map(n => <option key={n} value={`SABRE ${n}`}>SABRE {n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600">ESTADO DO SABRE*</label>
          <select required className={sel()} value={detalhes.recebimento_sabre || ""} onChange={(e) => onChange("recebimento_sabre", e.target.value)}>
            <option value="">Selecione o estado...</option>
            {listaEstados.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (tipo_formulario === "BAIXA DE MATERIAL CORRENTE") {
    return (
      <div className="space-y-4 mt-4 border-t pt-4">
        <h3 className="font-bold text-base text-gray-700 uppercase tracking-wide">🔗 Baixa de Corrente</h3>
        <div>
          <label className="block text-sm font-semibold text-gray-600">CABEÇOTE*</label>
          <select required className={sel()} value={detalhes.cabecote || ""} onChange={(e) => onChange("cabecote", e.target.value)}>
            <option value="">Selecione...</option>
            {["370E (OREGON)","370E (MAQNOVA)","370E (KOMATSU)"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600">CORRENTE*</label>
          <select required className={sel()} value={detalhes.corrente || ""} onChange={(e) => onChange("corrente", e.target.value)}>
            <option value="">Selecione...</option>
            {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={`CORRENTE ${n}`}>CORRENTE {n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600">MOTIVO DE SUBSTITUIÇÃO*</label>
          <select required className={sel()} value={detalhes.motivo || ""} onChange={(e) => onChange("motivo", e.target.value)}>
            <option value="">Selecione...</option>
            {listaDescartes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (tipo_formulario === "BAIXA DE MATERIAL SABRE") {
    return (
      <div className="space-y-4 mt-4 border-t pt-4">
        <h3 className="font-bold text-base text-gray-700 uppercase tracking-wide">⚔️ Substituição de Sabre</h3>
        <div>
          <label className="block text-sm font-semibold text-gray-600">CABEÇOTE*</label>
          <select required className={sel()} value={detalhes.cabecote || ""} onChange={(e) => onChange("cabecote", e.target.value)}>
            <option value="">Selecione...</option>
            {["370E JET FIT","SABRE MAQNOVA","KOMATSU 370E","SABRE ROTARY-AX"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600">SABRE*</label>
          <select required className={sel()} value={detalhes.sabre || ""} onChange={(e) => onChange("sabre", e.target.value)}>
            <option value="">Selecione...</option>
            {[1,2,3,4].map(n => <option key={n} value={`SABRE ${n}`}>SABRE {n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600">MOTIVO DE SUBSTITUIÇÃO*</label>
          <select required className={sel()} value={detalhes.motivo || ""} onChange={(e) => onChange("motivo", e.target.value)}>
            <option value="">Selecione...</option>
            {listaDescartes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (["BAIXA DE MATERIAL ROLLTOP","BAIXA DE CHAPA MAQNOVA","BAIXA DE CHAPA ROTARY-AX"].includes(tipo_formulario)) {
    const titulo =
      tipo_formulario === "BAIXA DE MATERIAL ROLLTOP" ? "🔄 Substituição Rolltop" :
      tipo_formulario === "BAIXA DE CHAPA MAQNOVA"    ? "🔧 Baixa Chapa Maqnova" :
                                                         "🔩 Baixa Chapa Rotary-AX";
    return (
      <div className="space-y-4 mt-4 border-t pt-4">
        <h3 className="font-bold text-base text-gray-700 uppercase tracking-wide">{titulo}</h3>
        <div>
          <label className="block text-sm font-semibold text-gray-600">SABRE / ROLLTOP / CHAPA*</label>
          <select required className={sel()} value={detalhes.sabre || ""} onChange={(e) => onChange("sabre", e.target.value)}>
            <option value="">Selecione...</option>
            {[1,2,3,4].map(n => <option key={n} value={`SABRE ${n}`}>SABRE {n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600">MOTIVO DE SUBSTITUIÇÃO*</label>
          <select required className={sel()} value={detalhes.motivo || ""} onChange={(e) => onChange("motivo", e.target.value)}>
            <option value="">Selecione...</option>
            {listaDescartes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (tipo_formulario === "BAIXAS DE EMENDAS E BOLSAS") {
    return (
      <div className="space-y-4 mt-4 border-t pt-4">
        <h3 className="font-bold text-base text-gray-700 uppercase tracking-wide">🧰 Emendas e Bolsas</h3>
        <div>
          <label className="block text-sm font-semibold text-gray-600">QUANTIDADE*</label>
          <input required type="number" min="1" className={sel()}
            value={detalhes.quantidade || ""}
            onChange={(e) => onChange("quantidade", e.target.value)}
            placeholder="Ex: 5000"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600">TIPO DE MATERIAL*</label>
          <select required className={sel()} value={detalhes.tipo_material || ""} onChange={(e) => onChange("tipo_material", e.target.value)}>
            <option value="">Selecione...</option>
            {listaMateriais.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>
    );
  }

  return null;
}

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

  const handleChange = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleDetalhesChange = (field: string, value: string) =>
    setFormData((prev) => ({
      ...prev,
      detalhes: { ...prev.detalhes, [field]: value },
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await salvarAfiacao(formData);
      if (result.success) {
        setSucesso(true);
        onSuccess(result.data);
        setTimeout(() => setSucesso(false), 3000);
        setFormData({
          data: "",
          afiador: "",
          modulo: "",
          maquina: "",
          letra: "",
          kit: "",
          tipo_formulario: "",
          detalhes: {},
        });
      } else {
        alert("Erro ao salvar formulário: " + result.error);
      }
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Obter afiadores dinâmicos ou usar estáticos como fallback
  const afiadoresCadastrados = auxiliares.filter((item) => item.category === "afiador").map((item) => item.value);
  const listaAfiadores = afiadoresCadastrados.length > 0 ? afiadoresCadastrados : AFIADORES;

  // Obter máquinas dinâmicas ou usar estáticas como fallback
  const maquinasDoModulo = (modulo: string) => {
    const maqsCadastradas = auxiliares
      .filter((item) => item.category === "maquina" && item.modulo === modulo)
      .map((item) => item.value);
    return maqsCadastradas.length > 0 ? maqsCadastradas : (MAQUINAS_POR_MODULO[modulo] || []);
  };

  const maquinas = maquinasDoModulo(formData.modulo);

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 pb-2 border-b">
        <span className="text-2xl">📝</span>
        <h2 className="text-lg font-bold text-gray-800">Novo Lançamento de Afiação</h2>
      </div>

      {/* Mensagem de sucesso */}
      {sucesso && (
        <div className="bg-green-50 border border-green-300 text-green-700 rounded-lg px-4 py-3 flex items-center gap-2 text-sm font-medium">
          ✅ Lançamento salvo com sucesso! Redirecionando para o banco de dados...
        </div>
      )}

      {/* Linha 1: Data + Afiador */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">DATA*</label>
          <input
            type="date" required
            className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.data}
            onChange={(e) => handleChange("data", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">AFIADOR*</label>
          <select required
            className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.afiador}
            onChange={(e) => handleChange("afiador", e.target.value)}
          >
            <option value="">Selecione o afiador...</option>
            {listaAfiadores.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>


      {/* Linha 2: Módulo + Letra + Kit */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">MÓDULO*</label>
          <select required
            className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.modulo}
            onChange={(e) => {
              handleChange("modulo", e.target.value);
              handleChange("maquina", ""); // reset máquina ao trocar módulo
            }}
          >
            <option value="">Módulo...</option>
            {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">LETRA*</label>
          <select required
            className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.letra}
            onChange={(e) => handleChange("letra", e.target.value)}
          >
            <option value="">Letra...</option>
            {["A","B","C","D"].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">KIT*</label>
          <select required
            className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.kit}
            onChange={(e) => handleChange("kit", e.target.value)}
          >
            <option value="">Kit...</option>
            {Array.from({ length: 15 }, (_, i) => i + 1).map(k => (
              <option key={k} value={k.toString()}>{k}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Máquinas — sempre visível quando módulo selecionado */}
      {formData.modulo && (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            🚜 MÁQUINAS DO {formData.modulo}*
          </label>
          {maquinas.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {maquinas.map(maq => (
                <label
                  key={maq}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-all ${
                    formData.maquina === maq
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="maquina"
                    value={maq}
                    checked={formData.maquina === maq}
                    onChange={(e) => handleChange("maquina", e.target.value)}
                    className="sr-only"
                    required
                  />
                  {maq}
                </label>
              ))}
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-2">Digite o número da máquina manualmente:</p>
              <input
                type="text"
                placeholder="Ex: HVE-0000"
                className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.maquina}
                onChange={(e) => handleChange("maquina", e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Tipo de Formulário */}
      <div className="border-t pt-4">
        <label className="block text-sm font-semibold text-gray-600 mb-1">SELECIONAR TIPO DE FORMULÁRIO*</label>
        <p className="text-xs text-gray-400 mb-2">Escolha o tipo de lançamento que deseja registrar:</p>
        <select required
          className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
          value={formData.tipo_formulario}
          onChange={(e) => {
            handleChange("tipo_formulario", e.target.value);
            setFormData(prev => ({ ...prev, tipo_formulario: e.target.value, detalhes: {} }));
          }}
        >
          <option value="">Selecione o tipo...</option>
          {TIPO_FORMULARIO_OPCOES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Campos dinâmicos por tipo */}
      {renderCamposDetalhes(formData.tipo_formulario, formData.detalhes, handleDetalhesChange, auxiliares)}

      {/* Botão */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
        >
          {loading ? "⏳ Salvando..." : "💾 Salvar Lançamento"}
        </button>
      </div>
    </form>
  );
}
