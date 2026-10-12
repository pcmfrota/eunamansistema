"use client";

import { useEffect, useState } from "react";
import { Plus, X, Database, Layers, Package, Truck, Users, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getModulosCadastro, salvarModulo, ModuloCadastro,
  getMateriaisCadastro, salvarMaterial, MaterialCadastro,
  getMaquinasCadastro, salvarMaquina, MaquinaCadastro,
  getColaboradoresCadastro, salvarColaborador, ColaboradorCadastro,
  getImpedimentosCadastro, salvarImpedimento, ImpedimentoCadastro,
  getFrotaCadastro, salvarFrotaInsumos, FrotaCadastro,
} from "./cadastroActions";

const inputCls = "w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 outline-none focus:border-amber-500";
const labelCls = "text-[10px] font-black text-zinc-500 uppercase tracking-wider block mb-1.5";

const APLICACAO_OPCOES = [
  { value: "DIESEL", label: "Diesel" }, { value: "CORRENTE", label: "Corrente" }, { value: "GRAXA", label: "Graxa" },
  { value: "TRANSMISSAO", label: "Transmissão" }, { value: "FLUIDO", label: "Fluido de Radiador" },
  { value: "HIDRAULICO_MOTOR", label: "Hidráulico / Motor" }, { value: "DIFERENCIAL", label: "Diferencial" }, { value: "ADITIVO", label: "Aditivo (Arla)" },
];
const TIPO_COLABORADOR_OPCOES = [
  { value: "MOTORISTA", label: "Motorista" }, { value: "LUBRIFICADOR", label: "Lubrificador" }, { value: "MECÂNICO", label: "Mecânico" }, { value: "OUTRO", label: "Outro" },
];

type Campo = {
  key: string;
  label: string;
  tipo: "text" | "number" | "select" | "checkbox";
  opcoes?: { value: string; label: string }[];
  placeholder?: string;
};

function ModalCadastro({
  titulo, campos, valoresIniciais, onSalvar, onFechar,
}: {
  titulo: string;
  campos: Campo[];
  valoresIniciais: Record<string, any>;
  onSalvar: (dados: Record<string, any>) => Promise<{ error?: string }>;
  onFechar: () => void;
}) {
  const [valores, setValores] = useState<Record<string, any>>(valoresIniciais);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const result = await onSalvar(valores);
      if (result.error) { setErro(result.error); return; }
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-50">{titulo}</h3>
          <button onClick={onFechar} className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={16} /></button>
        </div>
        {erro && <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg p-2">{erro}</div>}
        {campos.map((campo) => (
          <div key={campo.key}>
            {campo.tipo === "checkbox" ? (
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={!!valores[campo.key]} onChange={(e) => setValores((p) => ({ ...p, [campo.key]: e.target.checked }))} className="w-4 h-4" />
                {campo.label}
              </label>
            ) : (
              <>
                <label className={labelCls}>{campo.label}</label>
                {campo.tipo === "select" ? (
                  <select className={inputCls} value={valores[campo.key] ?? ""} onChange={(e) => setValores((p) => ({ ...p, [campo.key]: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {campo.opcoes?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    type={campo.tipo === "number" ? "number" : "text"} className={inputCls}
                    value={valores[campo.key] ?? ""} placeholder={campo.placeholder}
                    onChange={(e) => setValores((p) => ({ ...p, [campo.key]: e.target.value }))}
                  />
                )}
              </>
            )}
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onFechar} className="px-4 py-2.5 text-sm font-bold text-zinc-500">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="px-4 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-50">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListaCadastro<T extends { id: string }>({
  itens, colunas, campos, tituloModal, valorVazio, onSalvar, onRecarregar,
}: {
  itens: T[];
  colunas: { key: string; label: string; render?: (item: T) => React.ReactNode; className?: string }[];
  campos: Campo[];
  tituloModal: string;
  valorVazio: Record<string, any>;
  onSalvar: (id: string | null, dados: Record<string, any>) => Promise<{ error?: string }>;
  onRecarregar: () => void;
}) {
  const [modal, setModal] = useState<{ id: string | null; valores: Record<string, any> } | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{itens.length} registro(s)</div>
        <button onClick={() => setModal({ id: null, valores: valorVazio })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-600 text-white hover:bg-amber-700">
          <Plus size={13} /> Adicionar
        </button>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-400 uppercase text-[10px] font-black border-b border-zinc-100 dark:border-zinc-800">
              {colunas.map((c) => <th key={c.key} className={cn("text-left p-3", c.className)}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {itens.map((item) => (
              <tr key={item.id} onClick={() => setModal({ id: item.id, valores: item as any })} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                {colunas.map((c) => <td key={c.key} className={cn("p-3", c.className)}>{c.render ? c.render(item) : (item as any)[c.key] ?? "-"}</td>)}
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan={colunas.length} className="p-8 text-center text-zinc-400">Nenhum registro.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <ModalCadastro
          titulo={modal.id ? `Editar ${tituloModal}` : `Novo ${tituloModal}`}
          campos={campos} valoresIniciais={modal.valores}
          onSalvar={async (dados) => {
            const result = await onSalvar(modal.id, dados);
            if (!result.error) { onRecarregar(); setModal(null); }
            return result;
          }}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}

function BadgeAtivo({ ativo }: { ativo: boolean }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase", ativo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800")}>
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}

const SUB_TABS = [
  { id: "MODULOS", label: "Módulos", icon: Layers },
  { id: "MATERIAIS", label: "Materiais", icon: Package },
  { id: "MAQUINAS", label: "Máquinas Suzano", icon: Database },
  { id: "FROTA", label: "Frota (Comboios/Skids)", icon: Truck },
  { id: "COLABORADORES", label: "Colaboradores", icon: Users },
  { id: "IMPEDIMENTOS", label: "Impedimentos", icon: AlertOctagon },
] as const;

export default function Cadastros() {
  const [subTab, setSubTab] = useState<(typeof SUB_TABS)[number]["id"]>("MODULOS");

  const [modulos, setModulos] = useState<ModuloCadastro[]>([]);
  const [materiais, setMateriais] = useState<MaterialCadastro[]>([]);
  const [maquinas, setMaquinas] = useState<MaquinaCadastro[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorCadastro[]>([]);
  const [impedimentos, setImpedimentos] = useState<ImpedimentoCadastro[]>([]);
  const [frota, setFrota] = useState<FrotaCadastro[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function recarregarTudo() {
    setCarregando(true);
    try {
      const [m, mat, maq, colab, imped, fr] = await Promise.all([
        getModulosCadastro(), getMateriaisCadastro(), getMaquinasCadastro(), getColaboradoresCadastro(), getImpedimentosCadastro(), getFrotaCadastro(),
      ]);
      setModulos(m); setMateriais(mat); setMaquinas(maq); setColaboradores(colab); setImpedimentos(imped); setFrota(fr);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { recarregarTudo(); }, []);

  const moduloNome = (id: string | null) => modulos.find((m) => m.id === id)?.nome || "-";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider", subTab === id ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="p-8 text-center text-sm text-zinc-400">Carregando...</div>
      ) : (
        <>
          {subTab === "MODULOS" && (
            <ListaCadastro
              itens={modulos}
              colunas={[
                { key: "codigo", label: "Código" }, { key: "nome", label: "Nome" }, { key: "centro", label: "Centro" },
                { key: "deposito", label: "Depósito" }, { key: "controle", label: "Controle" },
                { key: "ativo", label: "Status", render: (m) => <BadgeAtivo ativo={m.ativo} /> },
              ]}
              campos={[
                { key: "codigo", label: "Código", tipo: "text", placeholder: "Ex: MA02" },
                { key: "nome", label: "Nome", tipo: "text", placeholder: "Ex: Módulo 02" },
                { key: "centro", label: "Centro (SAP)", tipo: "text" },
                { key: "deposito", label: "Depósito (SAP)", tipo: "text" },
                { key: "controle", label: "Controle (SAP)", tipo: "text" },
                { key: "ativo", label: "Ativo", tipo: "checkbox" },
              ]}
              tituloModal="Módulo" valorVazio={{ codigo: "", nome: "", centro: "", deposito: "", controle: "", ativo: true }}
              onSalvar={(id, d) => salvarModulo(id, { codigo: d.codigo, nome: d.nome, centro: d.centro || null, deposito: d.deposito || null, controle: d.controle || null, ativo: !!d.ativo })}
              onRecarregar={recarregarTudo}
            />
          )}

          {subTab === "MATERIAIS" && (
            <ListaCadastro
              itens={materiais}
              colunas={[
                { key: "codigo", label: "Cód" }, { key: "ni", label: "NI" }, { key: "material", label: "Material" },
                { key: "unidade", label: "Un" },
                { key: "aplicacao", label: "Aplicação", render: (m) => APLICACAO_OPCOES.find((o) => o.value === m.aplicacao)?.label || m.aplicacao },
                { key: "ativo", label: "Status", render: (m) => <BadgeAtivo ativo={m.ativo} /> },
              ]}
              campos={[
                { key: "codigo", label: "Código (opcional)", tipo: "number" },
                { key: "ni", label: "NI", tipo: "text" },
                { key: "material", label: "Material", tipo: "text", placeholder: "Ex: DIESEL S10" },
                { key: "referencia", label: "Referência", tipo: "text" },
                { key: "unidade", label: "Unidade", tipo: "text", placeholder: "L, KG, UN..." },
                { key: "aplicacao", label: "Aplicação", tipo: "select", opcoes: APLICACAO_OPCOES as any },
                { key: "ativo", label: "Ativo", tipo: "checkbox" },
              ]}
              tituloModal="Material" valorVazio={{ codigo: "", ni: "", material: "", referencia: "", unidade: "L", aplicacao: "", ativo: true }}
              onSalvar={(id, d) => salvarMaterial(id, { codigo: d.codigo ? Number(d.codigo) : null, ni: d.ni, referencia: d.referencia, material: d.material, unidade: d.unidade, aplicacao: d.aplicacao, ativo: !!d.ativo })}
              onRecarregar={recarregarTudo}
            />
          )}

          {subTab === "MAQUINAS" && (
            <ListaCadastro
              itens={maquinas}
              colunas={[
                { key: "codigo", label: "Código" },
                { key: "modulo_id", label: "Módulo", render: (m) => moduloNome(m.modulo_id) },
                { key: "frente", label: "Frente" }, { key: "tipo", label: "Tipo" },
                { key: "origem", label: "Origem", render: (m) => m.origem === "MOTORISTA" ? "Cadastrada em campo" : "Cadastro" },
                { key: "ativo", label: "Status", render: (m) => <BadgeAtivo ativo={m.ativo} /> },
              ]}
              campos={[
                { key: "codigo", label: "Código/Placa", tipo: "text", placeholder: "Ex: HVE-0396" },
                { key: "modulo_id", label: "Módulo", tipo: "select", opcoes: modulos.map((m) => ({ value: m.id, label: m.nome })) },
                { key: "frente", label: "Frente", tipo: "select", opcoes: [{ value: "HV", label: "HV" }, { value: "FW", label: "FW" }] },
                { key: "tipo", label: "Tipo (livre)", tipo: "text", placeholder: "HV, FW, GRU..." },
                { key: "ativo", label: "Ativo", tipo: "checkbox" },
              ]}
              tituloModal="Máquina" valorVazio={{ codigo: "", modulo_id: "", frente: "", tipo: "", ativo: true }}
              onSalvar={(id, d) => salvarMaquina(id, { codigo: d.codigo, modulo_id: d.modulo_id || null, frente: d.frente || null, tipo: d.tipo || null, ativo: !!d.ativo })}
              onRecarregar={recarregarTudo}
            />
          )}

          {subTab === "COLABORADORES" && (
            <ListaCadastro
              itens={colaboradores}
              colunas={[
                { key: "nome", label: "Nome" }, { key: "matricula", label: "Matrícula" },
                { key: "tipo", label: "Tipo" },
                { key: "status", label: "Status", render: (c) => <BadgeAtivo ativo={c.status === "Ativo"} /> },
              ]}
              campos={[
                { key: "nome", label: "Nome", tipo: "text" },
                { key: "matricula", label: "Matrícula", tipo: "text" },
                { key: "cargo", label: "Cargo", tipo: "text" },
                { key: "tipo", label: "Tipo", tipo: "select", opcoes: TIPO_COLABORADOR_OPCOES },
                { key: "status", label: "Ativo", tipo: "checkbox" },
              ]}
              tituloModal="Colaborador" valorVazio={{ nome: "", matricula: "", cargo: "", tipo: "", status: "Ativo" }}
              onSalvar={(id, d) => salvarColaborador(id, { nome: d.nome, matricula: d.matricula || null, cargo: d.cargo || null, tipo: d.tipo || null, status: d.status === true || d.status === "Ativo" ? "Ativo" : "Inativo" })}
              onRecarregar={recarregarTudo}
            />
          )}

          {subTab === "IMPEDIMENTOS" && (
            <ListaCadastro
              itens={impedimentos}
              colunas={[
                { key: "codigo", label: "Código" }, { key: "descricao", label: "Descrição" },
                { key: "ativo", label: "Status", render: (i) => <BadgeAtivo ativo={i.ativo} /> },
              ]}
              campos={[
                { key: "codigo", label: "Código (opcional)", tipo: "text" },
                { key: "descricao", label: "Descrição", tipo: "text" },
                { key: "ativo", label: "Ativo", tipo: "checkbox" },
              ]}
              tituloModal="Impedimento" valorVazio={{ codigo: "", descricao: "", ativo: true }}
              onSalvar={(id, d) => salvarImpedimento(id, { codigo: d.codigo || null, descricao: d.descricao, ativo: !!d.ativo })}
              onRecarregar={recarregarTudo}
            />
          )}

          {subTab === "FROTA" && (
            <FrotaTab frota={frota} onRecarregar={recarregarTudo} />
          )}
        </>
      )}
    </div>
  );
}

function FrotaTab({ frota, onRecarregar }: { frota: FrotaCadastro[]; onRecarregar: () => void }) {
  const [editando, setEditando] = useState<FrotaCadastro | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Cadastro de placa/modelo/tipo é feito em Base de Frota. Aqui só os campos específicos do Controle de Insumos.
      </p>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-400 uppercase text-[10px] font-black border-b border-zinc-100 dark:border-zinc-800">
              <th className="text-left p-3">Placa</th><th className="text-left p-3">Modelo</th><th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Depósito Suzano</th><th className="text-right p-3">Tanques Diesel</th><th className="text-right p-3">Capacidade (L)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {frota.map((f) => (
              <tr key={f.id} onClick={() => setEditando(f)} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="p-3 font-mono font-bold">{f.placa}</td>
                <td className="p-3">{f.modelo || "-"}</td>
                <td className="p-3">{f.tipo}</td>
                <td className="p-3">{f.deposito_suzano || "-"}</td>
                <td className="p-3 text-right">{f.numero_tanques_diesel}</td>
                <td className="p-3 text-right">{f.capacidade_tanque_litros ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && (
        <ModalCadastro
          titulo={`Editar ${editando.placa}`}
          campos={[
            { key: "deposito_suzano", label: "Depósito Suzano (ex: CB10)", tipo: "text" },
            { key: "numero_tanques_diesel", label: "Número de Tanques de Diesel", tipo: "number" },
            { key: "capacidade_tanque_litros", label: "Capacidade do Tanque (L, opcional)", tipo: "number" },
          ]}
          valoresIniciais={editando as any}
          onSalvar={async (d) => {
            const result = await salvarFrotaInsumos(editando.id, {
              deposito_suzano: d.deposito_suzano || null,
              numero_tanques_diesel: Number(d.numero_tanques_diesel) || 1,
              capacidade_tanque_litros: d.capacidade_tanque_litros ? Number(d.capacidade_tanque_litros) : null,
            });
            if (!result.error) onRecarregar();
            return result;
          }}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}
