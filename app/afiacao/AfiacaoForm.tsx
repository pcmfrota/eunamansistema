"use client";

import { useState } from "react";
import { salvarAfiacao } from "./actions";

const TIPO_FORMULARIO_OPCOES = [
  "ESTADO DE RECEBIMENTO CORRENTE",
  "ESTADO DE RECEBIMENTO SABRE",
  "BAIXA DE MATERIAL CORRENTE",
  "BAIXA DE MATERIAL SABRE",
  "BAIXA DE MATERIAL ROLLTOP",
  "BAIXA DE CHAPA MAQNOVA",
  "BAIXA DE CHAPA ROTARY-AX",
  "BAIXAS DE EMENDAS E BOLSAS"
];

const MAQUINAS_POR_MODULO: Record<string, string[]> = {
  MA02: ["HVE-0546", "HVE-0660", "HVE-0426", "HVE-0653", "HVE-0481", "HVE-0480", "HVE-0483", "HVE-0431"],
  MA05: ["HVE-0655", "HVE-0434", "HVE-0656", "HVE-0482", "HVE-0432", "HVE-0548", "HVE-0547", "HVE-0435", "HVE-0690", "HVE-0654", "HVE-0658", "HVE-0659", "HVE-0427", "HVE-0430"],
  MA07: ["HVE-0550", "HVE-0634", "HVE-0661", "HVE-0429", "HVE-0635", "HVE-0636", "HVE-0551", "HVE-0484", "HVE-0657", "HVE-0689", "HVE-0549", "HVE-0633", "HVE-0433", "HVE-0398"]
};

export default function AfiacaoForm({ onSuccess }: { onSuccess: (data: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    data: "",
    afiador: "",
    modulo: "",
    maquina: "",
    letra: "",
    kit: "",
    tipo_formulario: "",
    detalhes: {} as any
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDetalhesChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      detalhes: { ...prev.detalhes, [field]: value }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await salvarAfiacao(formData);
      if (result.success) {
        onSuccess(result.data);
        alert("Formulário salvo com sucesso!");
        // Reset form
        setFormData({
          data: "",
          afiador: "",
          modulo: "",
          maquina: "",
          letra: "",
          kit: "",
          tipo_formulario: "",
          detalhes: {}
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

  const renderDetalhes = () => {
    const { tipo_formulario, detalhes } = formData;
    if (!tipo_formulario) return null;

    if (tipo_formulario === "ESTADO DE RECEBIMENTO CORRENTE") {
      return (
        <div className="space-y-4 mt-4 border-t pt-4">
          <h3 className="font-bold text-lg">RECEBIMENTO CORRENTE</h3>
          <div>
            <label className="block text-sm font-medium">CABEÇOTE*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.cabecote || ""} onChange={(e) => handleDetalhesChange("cabecote", e.target.value)}>
              <option value="">Selecione...</option>
              {["370E (OREGON)", "370E (MAQNOVA)", "370E (KOMATSU)"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">OUTRA CORRENTE</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.corrente || ""} onChange={(e) => handleDetalhesChange("corrente", e.target.value)}>
              <option value="">Selecione...</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={`CORRENTE ${n}`}>CORRENTE {n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">ESTADO DA CORRENTE</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.estado_corrente || ""} onChange={(e) => handleDetalhesChange("estado_corrente", e.target.value)}>
              <option value="">Selecione a opção que corresponde ao estado...</option>
              {["QUEIMADA (O)", "TORCIDA (O)", "CONTAMINADA (O) COM AREIA", "SEM LUBRIFICAÇÃO", "NORMAL", "FALTANDO PEDAÇO", "ELOS DE TRAÇÃO DANIFICADOS", "QUEBRADA", "FACAS AMASSADAS", "PEÇA NÃO ENTREGUE", "PEÇA NÃO UTILIZADA", "MATERIAL DO KIT INCORRETO"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      );
    }

    if (tipo_formulario === "ESTADO DE RECEBIMENTO SABRE") {
      return (
        <div className="space-y-4 mt-4 border-t pt-4">
          <h3 className="font-bold text-lg">RECEBIMENTO SABRE</h3>
          <div>
            <label className="block text-sm font-medium">CABEÇOTE*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.cabecote || ""} onChange={(e) => handleDetalhesChange("cabecote", e.target.value)}>
              <option value="">Selecione...</option>
              {["370E JET FIT", "SABRE MAQNOVA", "KOMATSU 370E", "SABRE ROTARY-AX"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">1SABRE*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.sabre || ""} onChange={(e) => handleDetalhesChange("sabre", e.target.value)}>
              <option value="">Selecione...</option>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={`SABRE ${n}`}>SABRE {n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">RECEBIMENTO DE SABRE*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.recebimento_sabre || ""} onChange={(e) => handleDetalhesChange("recebimento_sabre", e.target.value)}>
              <option value="">Selecione...</option>
              {["QUEIMADA (O)", "TORCIDA (O)", "CONTAMINADA (O) COM AREIA", "SEM LUBRIFICAÇÃO", "NORMAL", "ELOS DE TRAÇÃO DANIFICADOS", "QUEBRADA", "PEÇA NÃO ENTREGUE", "PEÇA NÃO UTILIZADA", "MATERIAL DO KIT INCORRETO", "EMPENADO", "PONTEIRA FECHADA", "CANALETA DANIFICADA", "CANALETA FECHADA", "ROLLTOP DANIFICADO"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      );
    }

    if (tipo_formulario === "BAIXA DE MATERIAL CORRENTE") {
      return (
        <div className="space-y-4 mt-4 border-t pt-4">
          <h3 className="font-bold text-lg">BAIXA CORRENTE</h3>
          <div>
            <label className="block text-sm font-medium">CABEÇOTE*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.cabecote || ""} onChange={(e) => handleDetalhesChange("cabecote", e.target.value)}>
              <option value="">Selecione...</option>
              {["370E (OREGON)", "370E (MAQNOVA)", "370E (KOMATSU)"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">CORRENTE*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.corrente || ""} onChange={(e) => handleDetalhesChange("corrente", e.target.value)}>
              <option value="">Selecione...</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={`CORRENTE ${n}`}>CORRENTE {n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">MOTIVO DE SUBSTITUIÇÃO DE CORRENTE*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.motivo || ""} onChange={(e) => handleDetalhesChange("motivo", e.target.value)}>
              <option value="">Selecione...</option>
              {["MAL USO", "PERDA", "QUEBRA", "LUBRIFICAÇÃO", "VIDA ÚTIL", "ACIDENTE", "TORÇÃO", "MÁQ. EM INÍCIO DE OPERAÇÃO"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      );
    }

    if (tipo_formulario === "BAIXA DE MATERIAL SABRE") {
      return (
        <div className="space-y-4 mt-4 border-t pt-4">
          <h3 className="font-bold text-lg">SUBSTITUIÇÃO SABRE</h3>
          <div>
            <label className="block text-sm font-medium">CABEÇOTE*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.cabecote || ""} onChange={(e) => handleDetalhesChange("cabecote", e.target.value)}>
              <option value="">Selecione...</option>
              {["370E JET FIT", "SABRE MAQNOVA", "KOMATSU 370E", "SABRE ROTARY-AX"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">SABRE*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.sabre || ""} onChange={(e) => handleDetalhesChange("sabre", e.target.value)}>
              <option value="">Selecione...</option>
              {[1, 2, 3, 4].map(n => <option key={n} value={`SABRE ${n}`}>SABRE {n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">MOTIVO DE SUBSTITUIÇÃO DE SABRE*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.motivo || ""} onChange={(e) => handleDetalhesChange("motivo", e.target.value)}>
              <option value="">Selecione...</option>
              {["MAL USO", "PERDA", "QUEBRA", "LUBRIFICAÇÃO", "VIDA ÚTIL", "ACIDENTE", "TORÇÃO", "PONTEIRA QUEIMADA", "PONTEIRA FECHADA", "PONTEIRA QUEBRADA", "MÁQ. EM INÍCIO DE OPERAÇÃO"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      );
    }

    if (["BAIXA DE MATERIAL ROLLTOP", "BAIXA DE CHAPA MAQNOVA", "BAIXA DE CHAPA ROTARY-AX"].includes(tipo_formulario)) {
      return (
        <div className="space-y-4 mt-4 border-t pt-4">
          <h3 className="font-bold text-lg">SUBSTITUIÇÃO ROLLTOP / CHAPA</h3>
          <div>
            <label className="block text-sm font-medium">ROLLTOP / CHAPA*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.sabre || ""} onChange={(e) => handleDetalhesChange("sabre", e.target.value)}>
              <option value="">Selecione...</option>
              {[1, 2, 3, 4].map(n => <option key={n} value={`SABRE ${n}`}>SABRE {n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">MOTIVO DE SUBSTITUIÇÃO*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.motivo || ""} onChange={(e) => handleDetalhesChange("motivo", e.target.value)}>
              <option value="">Selecione...</option>
              {["MAL USO", "PERDA", "QUEBRA", "LUBRIFICAÇÃO", "VIDA ÚTIL", "ACIDENTE", "TORÇÃO"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      );
    }

    if (tipo_formulario === "BAIXAS DE EMENDAS E BOLSAS") {
      return (
        <div className="space-y-4 mt-4 border-t pt-4">
          <h3 className="font-bold text-lg">BAIXA EMENDAS E BOLSA</h3>
          <div>
            <label className="block text-sm font-medium">QUANTIDADE</label>
            <input required type="number" min="1" className="mt-1 block w-full p-2 border rounded" value={detalhes.quantidade || ""} onChange={(e) => handleDetalhesChange("quantidade", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">TIPO DE MATERIAL*</label>
            <select required className="mt-1 block w-full p-2 border rounded" value={detalhes.tipo_material || ""} onChange={(e) => handleDetalhesChange("tipo_material", e.target.value)}>
              <option value="">Selecione...</option>
              {["EMENDA MACHO", "EMENDA FEMEA", "BOLSAS", "REBITE"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 bg-white p-6 rounded shadow-sm border">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">DATA*</label>
          <input 
            type="date" 
            required 
            className="mt-1 block w-full p-2 border rounded"
            value={formData.data}
            onChange={(e) => handleChange("data", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">AFIADOR*</label>
          <select required className="mt-1 block w-full p-2 border rounded" value={formData.afiador} onChange={(e) => handleChange("afiador", e.target.value)}>
            <option value="">Selecione...</option>
            {["KHAYNAN FERNANDES FERREIRA", "FELYPE DANIEL MACEDO VIEIRA", "JOSIEL DA SILVA RIBEIRO", "GEOVANE DE ARAUJO MORAES", "LUCAS PEREIRA ALVES"].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">MÓDULO*</label>
          <select required className="mt-1 block w-full p-2 border rounded" value={formData.modulo} onChange={(e) => {
            handleChange("modulo", e.target.value);
            handleChange("maquina", ""); // reset maquina
          }}>
            <option value="">Selecione...</option>
            {["MA02", "MA04", "MA05", "MA06", "MA07"].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {formData.modulo && MAQUINAS_POR_MODULO[formData.modulo] && (
          <div>
            <label className="block text-sm font-medium">MÁQUINAS {formData.modulo}*</label>
            <div className="mt-2 space-y-2">
              {MAQUINAS_POR_MODULO[formData.modulo].map(maq => (
                <label key={maq} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="maquina"
                    value={maq}
                    checked={formData.maquina === maq}
                    onChange={(e) => handleChange("maquina", e.target.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    required
                  />
                  <span className="text-sm font-medium text-gray-700">{maq}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium">LETRA*</label>
          <select required className="mt-1 block w-full p-2 border rounded" value={formData.letra} onChange={(e) => handleChange("letra", e.target.value)}>
            <option value="">Selecione...</option>
            {["A", "B", "C", "D"].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">KIT*</label>
          <select required className="mt-1 block w-full p-2 border rounded" value={formData.kit} onChange={(e) => handleChange("kit", e.target.value)}>
            <option value="">Selecione...</option>
            {Array.from({length: 15}, (_, i) => i + 1).map(k => <option key={k} value={k.toString()}>{k}</option>)}
          </select>
        </div>
      </div>

      <div className="pt-4 border-t">
        <label className="block text-sm font-medium">SELECIONAR FORMULÁRIO*</label>
        <p className="text-sm text-gray-500 mb-2">Selecione qual o tipo de formulário que deseja lançar:</p>
        <select required className="mt-1 block w-full p-2 border rounded font-semibold" value={formData.tipo_formulario} onChange={(e) => {
          handleChange("tipo_formulario", e.target.value);
          // reset detalhes on change
          setFormData(prev => ({ ...prev, detalhes: {} }));
        }}>
          <option value="">Selecione...</option>
          {TIPO_FORMULARIO_OPCOES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {renderDetalhes()}

      <div className="pt-6">
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar Lançamento"}
        </button>
      </div>
    </form>
  );
}
