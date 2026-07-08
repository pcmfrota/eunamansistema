"use client";

import { useState, useMemo, useCallback } from "react";
import { atualizarAfiacao, deletarAfiacao } from "./actions";
import {
  MAQUINAS_POR_MODULO,
  AFIADORES,
  MODULOS,
  renderCamposDetalhes,
  TIPO_FORMULARIO_OPCOES,
} from "./AfiacaoForm";

// ─────────────────────────────────────────────
// Cores por tipo
// ─────────────────────────────────────────────
const TIPO_COLORS: Record<string, string> = {
  "ESTADO DE RECEBIMENTO CORRENTE": "bg-blue-100 text-blue-800",
  "ESTADO DE RECEBIMENTO SABRE":    "bg-sky-100 text-sky-800",
  "BAIXA DE MATERIAL CORRENTE":     "bg-orange-100 text-orange-800",
  "BAIXA DE MATERIAL SABRE":        "bg-amber-100 text-amber-800",
  "BAIXA DE MATERIAL ROLLTOP":      "bg-yellow-100 text-yellow-800",
  "BAIXA DE CHAPA MAQNOVA":         "bg-purple-100 text-purple-800",
  "BAIXA DE CHAPA ROTARY-AX":       "bg-violet-100 text-violet-800",
  "BAIXAS DE EMENDAS E BOLSAS":     "bg-green-100 text-green-800",
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatarData(data: string) {
  if (!data) return "-";
  const partes = data.split("T")[0].split("-");
  if (partes.length < 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarDetalhes(detalhes: any): string {
  if (!detalhes || typeof detalhes !== "object") return "-";
  return Object.entries(detalhes)
    .filter(([, v]) => v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => `${k.replace(/_/g, " ").toUpperCase()}: ${v}`)
    .join(" | ");
}

// ─────────────────────────────────────────────
// Modal de Detalhes (somente leitura)
// ─────────────────────────────────────────────
function ModalDetalhes({ registro, onClose }: { registro: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <span className="text-xl">👁️</span>
            <h3 className="text-lg font-bold text-gray-800">Detalhes do Registro</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-bold">×</button>
        </div>
        <div className="p-5 space-y-2.5">
          <InfoRow label="Data"    value={formatarData(registro.data)} />
          <InfoRow label="Afiador" value={registro.afiador} />
          <InfoRow label="Módulo"  value={registro.modulo} />
          <InfoRow label="Máquina" value={registro.maquina || "—"} />
          <InfoRow label="Letra"   value={registro.letra} />
          <InfoRow label="Kit"     value={registro.kit} />
          <InfoRow label="Tipo"    value={registro.tipo_formulario} />
          {registro.detalhes && typeof registro.detalhes === "object" && Object.keys(registro.detalhes).length > 0 && (
            <div className="border-t pt-3 mt-3">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Detalhes Específicos</p>
              {Object.entries(registro.detalhes)
                .filter(([, v]) => v !== "" && v !== null)
                .map(([k, v]) => (
                  <InfoRow key={k} label={k.replace(/_/g, " ").toUpperCase()} value={String(v)} />
                ))}
            </div>
          )}
          <div className="border-t pt-3 mt-2">
            <p className="text-xs text-gray-300">ID: {registro.id}</p>
            {registro.created_at && (
              <p className="text-xs text-gray-300">Criado: {new Date(registro.created_at).toLocaleString("pt-BR")}</p>
            )}
          </div>
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose}
            className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs font-semibold text-gray-500 w-36 shrink-0 pt-0.5">{label}:</span>
      <span className="text-sm text-gray-800 flex-1">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Modal de Edição COMPLETO (igual ao formulário)
// ─────────────────────────────────────────────
function ModalEdicao({
  registro,
  auxiliares = [],
  onClose,
  onSalvar,
}: {
  registro: any;
  auxiliares?: any[];
  onClose: () => void;
  onSalvar: (updated: any) => void;
}) {
  const [form, setForm] = useState({
    data:            registro.data?.split("T")[0] || "",
    afiador:         registro.afiador || "",
    modulo:          registro.modulo || "",
    maquina:         registro.maquina || "",
    letra:           registro.letra || "",
    kit:             String(registro.kit || ""),
    tipo_formulario: registro.tipo_formulario || "",
    detalhes:        { ...(registro.detalhes || {}) },
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const set = (field: string, value: string) =>
    setForm(p => ({ ...p, [field]: value }));

  const setDetalhes = (field: string, value: string) => {
    setForm(p => {
      const isRecebimento = p.tipo_formulario.includes("RECEBIMENTO");
      let updatedDetalhes = { ...p.detalhes, [field]: value };
      
      // Auto-atualizar Qtd. Expedida e Qtd Baixas ao alterar a quantidade
      if (field === "corrente" || field === "sabre" || field === "quantidade") {
        const valNum = parseFloat(value) || 0;
        updatedDetalhes.qtd_expedida = String(valNum);
        updatedDetalhes.qtd_baixas = isRecebimento ? "0" : String(valNum);
      }
      
      return { ...p, detalhes: updatedDetalhes };
    });
  };

  const handleSalvar = async () => {
    if (!form.data || !form.afiador || !form.modulo || !form.letra || !form.kit || !form.tipo_formulario) {
      setErro("Preencha todos os campos obrigatórios (*).");
      return;
    }
    setLoading(true);
    setErro("");
    try {
      const result = await atualizarAfiacao(registro.id, form);
      if (result.success) {
        onSalvar(result.data);
      } else {
        setErro(result.error || "Erro desconhecido ao salvar.");
      }
    } catch (e: any) {
      setErro(e.message);
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

  const maquinas = maquinasDoModulo(form.modulo);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-amber-50 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✏️</span>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Editar Registro</h3>
              <p className="text-xs text-gray-500">{registro.afiador} — {formatarData(registro.data)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-bold">×</button>
        </div>

        {/* Corpo com scroll */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {erro && (
            <div className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-lg px-4 py-2.5">
              ⚠️ {erro}
            </div>
          )}

          {/* Data + Afiador */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data*</label>
              <input type="date" required
                className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                value={form.data}
                onChange={(e) => set("data", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Afiador*</label>
              <select required
                className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                value={form.afiador}
                onChange={(e) => set("afiador", e.target.value)}
              >
                <option value="">Selecione...</option>
                {listaAfiadores.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Módulo + Letra + Kit */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Módulo*</label>
              <select required
                className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                value={form.modulo}
                onChange={(e) => { set("modulo", e.target.value); set("maquina", ""); }}
              >
                <option value="">Módulo...</option>
                {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Letra*</label>
              <select required
                className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                value={form.letra}
                onChange={(e) => set("letra", e.target.value)}
              >
                <option value="">Letra...</option>
                {["A","B","C","D"].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nª Kit*</label>
              <select required
                className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                value={form.kit}
                onChange={(e) => set("kit", e.target.value)}
              >
                <option value="">Kit...</option>
                {Array.from({ length: 15 }, (_, i) => i + 1).map(k => (
                  <option key={k} value={k.toString()}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Máquinas — igual ao formulário */}
          {form.modulo && (
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-3">
                🚜 Equipamentos do {form.modulo}*
              </label>
              {maquinas.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {maquinas.map(maq => (
                    <label
                      key={maq}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-all ${
                        form.maquina === maq
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-white border-gray-300 text-gray-700 hover:border-amber-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="maquina_edit"
                        value={maq}
                        checked={form.maquina === maq}
                        onChange={(e) => set("maquina", e.target.value)}
                        className="sr-only"
                      />
                      {maq}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Ex: HVE-0000"
                  className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                  value={form.maquina}
                  onChange={(e) => set("maquina", e.target.value)}
                />
              )}
            </div>
          )}

          {/* Tipo de formulário */}
          <div className="border-t pt-4">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipo de Formulário*</label>
            <select required
              className="block w-full p-2.5 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-amber-400 outline-none"
              value={form.tipo_formulario}
              onChange={(e) => {
                setForm(p => ({ ...p, tipo_formulario: e.target.value, detalhes: {} }));
              }}
            >
              <option value="">Selecione o tipo...</option>
              {TIPO_FORMULARIO_OPCOES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Campos específicos do tipo — reutiliza a mesma função do AfiacaoForm */}
          {renderCamposDetalhes(form.tipo_formulario, form.detalhes, setDetalhes, auxiliares)}

          {/* Campos de Controle da Ficha */}
          {form.tipo_formulario && (
            <div className="space-y-4 border-t pt-4 mt-4 bg-slate-50/50 p-4 rounded-xl border border-gray-100">
              <h3 className="font-bold text-xs text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                📋 Informações de Controle da Ficha
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Nª FICHA*</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: 761560269"
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 outline-none bg-white font-mono"
                    value={form.detalhes.num_ficha || ""}
                    onChange={(e) => setDetalhes("num_ficha", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">FICHA FÍSICA*</label>
                  <select
                    required
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                    value={form.detalhes.ficha_fisica || "OK"}
                    onChange={(e) => setDetalhes("ficha_fisica", e.target.value)}
                  >
                    <option value="OK">OK</option>
                    <option value="PENDENTE">PENDENTE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">NOVO/VELHO*</label>
                  <select
                    required
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 outline-none bg-white font-bold text-slate-700"
                    value={form.detalhes.novo_velho || "NOVO"}
                    onChange={(e) => setDetalhes("novo_velho", e.target.value)}
                  >
                    <option value="NOVO">NOVO</option>
                    <option value="VELHO">VELHO</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">CARGA*</label>
                  <input
                    required
                    type="text"
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 outline-none bg-white font-mono"
                    value={form.detalhes.carga || "1"}
                    onChange={(e) => setDetalhes("carga", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">UNI*</label>
                  <input
                    required
                    type="text"
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 outline-none bg-white font-mono"
                    value={form.detalhes.uni || "20"}
                    onChange={(e) => setDetalhes("uni", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Qtd. Expedida*</label>
                  <input
                    required
                    type="number"
                    step="any"
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 outline-none bg-white font-mono"
                    value={form.detalhes.qtd_expedida !== undefined ? form.detalhes.qtd_expedida : "1"}
                    onChange={(e) => setDetalhes("qtd_expedida", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Qtd Baixas*</label>
                  <input
                    required
                    type="number"
                    step="any"
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 outline-none bg-white font-mono"
                    value={form.detalhes.qtd_baixas !== undefined ? form.detalhes.qtd_baixas : "1"}
                    onChange={(e) => setDetalhes("qtd_baixas", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Centro de Custo (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Auto-calculado por padrão"
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 outline-none bg-white font-mono"
                    value={form.detalhes.cc || ""}
                    onChange={(e) => setDetalhes("cc", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Status Baixa (Opcional)</label>
                  <input
                    type="text"
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                    value={form.detalhes.status_baixa || ""}
                    onChange={(e) => setDetalhes("status_baixa", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Un. (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: PC"
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                    value={form.detalhes.un || ""}
                    onChange={(e) => setDetalhes("un", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer fixo */}
        <div className="flex gap-3 p-5 border-t shrink-0">
          <button onClick={onClose} disabled={loading}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={loading}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl font-bold transition disabled:opacity-50">
            {loading ? "⏳ Salvando..." : "💾 Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Modal de Confirmação de Exclusão
// ─────────────────────────────────────────────
function ModalExclusao({ registro, onClose, onConfirmar }: {
  registro: any;
  onClose: () => void;
  onConfirmar: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirmar = async () => {
    setLoading(true);
    await onConfirmar();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h3 className="text-xl font-bold text-gray-800 mb-1">Confirmar Exclusão</h3>
          <p className="text-gray-500 text-sm mb-4">Esta ação não pode ser desfeita.</p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left text-sm space-y-1">
            <p><span className="font-semibold text-gray-600">Data:</span> {formatarData(registro.data)}</p>
            <p><span className="font-semibold text-gray-600">Afiador:</span> {registro.afiador}</p>
            <p><span className="font-semibold text-gray-600">Módulo:</span> {registro.modulo} — {registro.maquina || "—"}</p>
            <p><span className="font-semibold text-gray-600">Tipo:</span> {registro.tipo_formulario}</p>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} disabled={loading}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleConfirmar} disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold transition disabled:opacity-50">
            {loading ? "⏳ Excluindo..." : "🗑️ Sim, Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente Principal: BancoDadosAfiacao
// ─────────────────────────────────────────────
interface Props {
  afiacoes: any[];
  auxiliares?: any[];
  onUpdate: (updated: any) => void;
  onDelete: (id: string) => void;
}

export default function BancoDadosAfiacao({ afiacoes, auxiliares = [], onUpdate, onDelete }: Props) {
  const [busca, setBusca] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroAfiador, setFiltroAfiador] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 15;

  const [modalDetalhes, setModalDetalhes] = useState<any | null>(null);
  const [modalEdicao, setModalEdicao] = useState<any | null>(null);
  const [modalExclusao, setModalExclusao] = useState<any | null>(null);

  // Filtragem
  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return (afiacoes || []).filter((a) => {
      const texto =
        (a.afiador || "").toLowerCase().includes(q) ||
        (a.modulo || "").toLowerCase().includes(q) ||
        (a.maquina || "").toLowerCase().includes(q) ||
        (a.tipo_formulario || "").toLowerCase().includes(q) ||
        (a.letra || "").toLowerCase().includes(q) ||
        (a.data || "").includes(q);
      if (!texto) return false;
      if (filtroModulo  && a.modulo          !== filtroModulo)  return false;
      if (filtroTipo    && a.tipo_formulario  !== filtroTipo)    return false;
      if (filtroAfiador && a.afiador          !== filtroAfiador) return false;
      if (filtroDataInicio && a.data < filtroDataInicio) return false;
      if (filtroDataFim    && a.data > filtroDataFim)    return false;
      return true;
    });
  }, [afiacoes, busca, filtroModulo, filtroTipo, filtroAfiador, filtroDataInicio, filtroDataFim]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / itensPorPagina));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const paginados    = filtrados.slice((paginaSegura - 1) * itensPorPagina, paginaSegura * itensPorPagina);

  const limparFiltros = useCallback(() => {
    setBusca(""); setFiltroModulo(""); setFiltroTipo("");
    setFiltroAfiador(""); setFiltroDataInicio(""); setFiltroDataFim("");
    setPaginaAtual(1);
  }, []);

  const handleExcluir = async () => {
    if (!modalExclusao) return;
    const result = await deletarAfiacao(modalExclusao.id);
    if (result.success) {
      onDelete(modalExclusao.id);
      setModalExclusao(null);
    } else {
      alert("Erro ao excluir: " + result.error);
    }
  };

  const temFiltros = busca || filtroModulo || filtroTipo || filtroAfiador || filtroDataInicio || filtroDataFim;

  return (
    <div className="space-y-4">

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total de Registros" value={(afiacoes || []).length}  color="blue"   icon="📋" />
        <StatCard label="Filtrados"           value={filtrados.length} color="green"  icon="🔍" />
        <StatCard label="Módulos Ativos"
          value={[...new Set((afiacoes || []).map(a => a.modulo))].filter(Boolean).length}
          color="purple" icon="🏭" />
        <StatCard label="Afiadores"
          value={[...new Set((afiacoes || []).map(a => a.afiador))].filter(Boolean).length}
          color="orange" icon="👷" />
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Buscar por afiador, máquina, módulo, tipo..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPaginaAtual(1); }}
            />
          </div>
          {temFiltros && (
            <button onClick={limparFiltros}
              className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-xl hover:bg-red-50 transition font-semibold whitespace-nowrap">
              ✕ Limpar
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={filtroModulo} onChange={(e) => { setFiltroModulo(e.target.value); setPaginaAtual(1); }}>
            <option value="">Todos os módulos</option>
            {[...new Set((afiacoes || []).map(a => a.modulo))].filter(Boolean).sort().map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={filtroAfiador} onChange={(e) => { setFiltroAfiador(e.target.value); setPaginaAtual(1); }}>
            <option value="">Todos os afiadores</option>
            {[...new Set((afiacoes || []).map(a => a.afiador))].filter(Boolean).sort().map(a => (
              <option key={a} value={a}>{a.split(" ")[0]} {a.split(" ").slice(-1)[0]}</option>
            ))}
          </select>

          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none col-span-2 md:col-span-1"
            value={filtroTipo} onChange={(e) => { setFiltroTipo(e.target.value); setPaginaAtual(1); }}>
            <option value="">Todos os tipos</option>
            {TIPO_FORMULARIO_OPCOES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 whitespace-nowrap">De:</span>
            <input type="date" className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm outline-none"
              value={filtroDataInicio} onChange={(e) => { setFiltroDataInicio(e.target.value); setPaginaAtual(1); }} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 whitespace-nowrap">Até:</span>
            <input type="date" className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm outline-none"
              value={filtroDataFim} onChange={(e) => { setFiltroDataFim(e.target.value); setPaginaAtual(1); }} />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-800 text-white text-xs">
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Afiador</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Módulo</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Máquina</th>
                <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Letra</th>
                <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Kit</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Detalhes</th>
                <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="text-4xl mb-2">📭</div>
                    <p className="text-gray-500 font-medium">Nenhum registro encontrado</p>
                    {temFiltros && (
                      <button onClick={limparFiltros} className="mt-2 text-sm text-blue-600 hover:underline">
                        Limpar filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : paginados.map((a, idx) => (
                <tr key={a.id || idx} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 whitespace-nowrap">
                    {formatarData(a.data)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 max-w-[180px] truncate" title={a.afiador}>
                    {a.afiador}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                      {a.modulo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600 whitespace-nowrap">
                    {a.maquina || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                      {a.letra}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-semibold text-gray-700">{a.kit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold leading-tight ${TIPO_COLORS[a.tipo_formulario] || "bg-gray-100 text-gray-700"}`}>
                      {a.tipo_formulario}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate" title={formatarDetalhes(a.detalhes)}>
                    {formatarDetalhes(a.detalhes)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <ActionBtn onClick={() => setModalDetalhes(a)} title="Ver detalhes" color="blue">👁️</ActionBtn>
                      <ActionBtn onClick={() => setModalEdicao(a)}   title="Editar"       color="amber">✏️</ActionBtn>
                      <ActionBtn onClick={() => setModalExclusao(a)} title="Excluir"      color="red">🗑️</ActionBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {filtrados.length > itensPorPagina && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-sm">
            <p className="text-gray-500">
              {((paginaSegura-1)*itensPorPagina)+1}–{Math.min(paginaSegura*itensPorPagina, filtrados.length)} de {filtrados.length} registros
            </p>
            <div className="flex gap-1">
              <PagBtn onClick={() => setPaginaAtual(1)}                               disabled={paginaSegura===1}>«</PagBtn>
              <PagBtn onClick={() => setPaginaAtual(p => Math.max(1,p-1))}            disabled={paginaSegura===1}>‹</PagBtn>
              {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                let p = paginaSegura - 2 + i;
                if (p < 1) p = i + 1;
                if (p > totalPaginas) p = totalPaginas - (4 - i);
                if (p < 1 || p > totalPaginas) return null;
                return (
                  <button key={p} onClick={() => setPaginaAtual(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition ${p===paginaSegura ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-200"}`}>
                    {p}
                  </button>
                );
              })}
              <PagBtn onClick={() => setPaginaAtual(p => Math.min(totalPaginas,p+1))} disabled={paginaSegura===totalPaginas}>›</PagBtn>
              <PagBtn onClick={() => setPaginaAtual(totalPaginas)}                     disabled={paginaSegura===totalPaginas}>»</PagBtn>
            </div>
          </div>
        )}
      </div>

      {filtrados.length <= itensPorPagina && filtrados.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          {filtrados.length} registro{filtrados.length!==1?"s":""} encontrado{filtrados.length!==1?"s":""}
        </p>
      )}

      {/* Modais */}
      {modalDetalhes && <ModalDetalhes registro={modalDetalhes} onClose={() => setModalDetalhes(null)} />}

      {modalEdicao && (
        <ModalEdicao
          registro={modalEdicao}
          auxiliares={auxiliares}
          onClose={() => setModalEdicao(null)}
          onSalvar={(updated) => { onUpdate(updated); setModalEdicao(null); }}
        />
      )}

      {modalExclusao && (
        <ModalExclusao
          registro={modalExclusao}
          onClose={() => setModalExclusao(null)}
          onConfirmar={handleExcluir}
        />
      )}
    </div>
  );
}

// Botão de ação
function ActionBtn({ onClick, title, color, children }: {
  onClick: () => void; title: string; color: string; children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    blue:  "hover:bg-blue-100 hover:text-blue-700",
    amber: "hover:bg-amber-100 hover:text-amber-700",
    red:   "hover:bg-red-100 hover:text-red-700",
  };
  return (
    <button onClick={onClick} title={title}
      className={`p-1.5 rounded-lg text-gray-400 transition ${colors[color]}`}>
      {children}
    </button>
  );
}

// Botão de paginação
function PagBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-8 h-8 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition disabled:opacity-30 disabled:cursor-not-allowed">
      {children}
    </button>
  );
}

// Card de estatística
function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  const cls: Record<string, string> = {
    blue:   "bg-blue-50 border-blue-200 text-blue-700",
    green:  "bg-green-50 border-green-200 text-green-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
  };
  return (
    <div className={`border rounded-xl p-4 ${cls[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium opacity-70">{label}</p>
          <p className="text-2xl font-bold mt-0.5">{value}</p>
        </div>
        <span className="text-3xl opacity-50">{icon}</span>
      </div>
    </div>
  );
}
