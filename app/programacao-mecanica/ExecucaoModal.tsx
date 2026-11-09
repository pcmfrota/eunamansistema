"use client";

import { useState } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import FotosUploader from "./FotosUploader";
import { salvarExecucaoProgramacao, excluirExecucaoProgramacao } from "./actions";
import { ExecucaoProgramacao, FotoEvidencia, Periodicidade, StatusExecucao, TipoProgramacao } from "./types";

export interface ModalContexto {
  tipo_programacao: TipoProgramacao;
  tipoLabel: string;
  periodicidade: Periodicidade;
  placa: string;
  modelo: string | null;
  equipamentoId: string | null;
  dataProgramada: string; // YYYY-MM-DD
  registroExistente: ExecucaoProgramacao | null;
}

interface Props {
  contexto: ModalContexto;
  onClose: () => void;
  onSaved: (exec: ExecucaoProgramacao) => void;
  onDeleted: (id: string) => void;
  canDelete: boolean;
  camposExtrasTitulo?: string;
  renderCamposExtras?: (dadosExtra: Record<string, any>, setDadosExtra: (d: Record<string, any>) => void) => React.ReactNode;
}

function fmtFullBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_LABEL: Record<StatusExecucao, string> = {
  programado: "Programado",
  em_andamento: "Em andamento",
  executado: "Executado",
};

export default function ExecucaoModal({ contexto, onClose, onSaved, onDeleted, canDelete, camposExtrasTitulo, renderCamposExtras }: Props) {
  const existente = contexto.registroExistente;
  const [km, setKm] = useState(existente?.km != null ? String(existente.km) : "");
  const [horimetro, setHorimetro] = useState(existente?.horimetro != null ? String(existente.horimetro) : "");
  const [responsavelExecucao, setResponsavelExecucao] = useState(existente?.responsavel_execucao || "");
  const [responsavelAcompanhamento, setResponsavelAcompanhamento] = useState(existente?.responsavel_acompanhamento || "");
  const [observacoes, setObservacoes] = useState(existente?.observacoes || "");
  const [fotos, setFotos] = useState<FotoEvidencia[]>(existente?.fotos || []);
  const [dadosExtra, setDadosExtra] = useState<Record<string, any>>(existente?.dados_extra || {});
  const [saving, setSaving] = useState<StatusExecucao | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(status: StatusExecucao) {
    if (status === "executado" && !responsavelExecucao.trim()) {
      setErro("Informe o responsável pela execução.");
      return;
    }
    setSaving(status);
    setErro("");
    const result = await salvarExecucaoProgramacao({
      id: existente?.id,
      equipamento_id: contexto.equipamentoId,
      placa: contexto.placa,
      tipo_programacao: contexto.tipo_programacao,
      periodicidade: contexto.periodicidade,
      data_programada: contexto.dataProgramada,
      data_execucao: status === "programado" ? null : existente?.data_execucao || new Date().toISOString(),
      status,
      km: km.trim() === "" ? null : Number(km),
      horimetro: horimetro.trim() === "" ? null : Number(horimetro),
      responsavel_execucao: responsavelExecucao.trim() || null,
      responsavel_acompanhamento: responsavelAcompanhamento.trim() || null,
      observacoes: observacoes.trim() || null,
      fotos,
      dados_extra: dadosExtra,
    });
    setSaving(null);
    if (result?.error) {
      setErro(result.error);
      return;
    }
    onSaved(result.data as ExecucaoProgramacao);
  }

  async function excluir() {
    if (!existente) return;
    if (!confirm("Excluir este lançamento?")) return;
    setDeleting(true);
    const result = await excluirExecucaoProgramacao(existente.id);
    setDeleting(false);
    if (result?.error) {
      setErro(result.error);
      return;
    }
    onDeleted(existente.id);
  }

  const bloqueado = !!saving || deleting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-lg shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4 sticky top-0 bg-white dark:bg-zinc-950 pb-2 -mt-1 -mx-1 px-1 pt-1 z-10">
          <div>
            <h3 className="text-base font-bold dark:text-white">{contexto.tipoLabel} — {contexto.placa}</h3>
            <p className="text-xs text-zinc-500">
              {contexto.modelo ? `${contexto.modelo} · ` : ""}{fmtFullBR(contexto.dataProgramada)}
              {existente && <> · <span className="font-semibold">{STATUS_LABEL[existente.status]}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-full shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">KM atual</label>
              <input
                type="number"
                value={km}
                onChange={e => setKm(e.target.value)}
                placeholder="0"
                disabled={bloqueado}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Horímetro</label>
              <input
                type="number"
                value={horimetro}
                onChange={e => setHorimetro(e.target.value)}
                placeholder="0"
                disabled={bloqueado}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Responsável pela execução *</label>
            <input
              type="text"
              value={responsavelExecucao}
              onChange={e => setResponsavelExecucao(e.target.value)}
              placeholder="Nome do mecânico/colaborador"
              disabled={bloqueado}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-60"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Responsável pelo acompanhamento</label>
            <input
              type="text"
              value={responsavelAcompanhamento}
              onChange={e => setResponsavelAcompanhamento(e.target.value)}
              placeholder="Supervisor/líder (opcional)"
              disabled={bloqueado}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-60"
            />
          </div>

          {renderCamposExtras && (
            <div className="border-t border-zinc-100 dark:border-zinc-900 pt-3">
              {camposExtrasTitulo && <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">{camposExtrasTitulo}</p>}
              {renderCamposExtras(dadosExtra, setDadosExtra)}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Observações gerais</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={3}
              disabled={bloqueado}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none resize-y disabled:opacity-60"
            />
          </div>

          <FotosUploader fotos={fotos} onChange={setFotos} disabled={bloqueado} />

          {erro && <p className="text-xs text-red-600 font-medium">{erro}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
            {existente && canDelete ? (
              <button
                onClick={excluir}
                disabled={bloqueado}
                className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-1.5 hover:bg-red-100 disabled:opacity-60"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Excluir
              </button>
            ) : <span />}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => salvar("em_andamento")}
                disabled={bloqueado}
                className="px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 disabled:opacity-60 flex items-center gap-1.5"
              >
                {saving === "em_andamento" && <Loader2 size={13} className="animate-spin" />}
                Em Andamento
              </button>
              <button
                onClick={() => salvar("programado")}
                disabled={bloqueado}
                className="px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 disabled:opacity-60 flex items-center gap-1.5"
              >
                {saving === "programado" && <Loader2 size={13} className="animate-spin" />}
                Salvar como Pendente
              </button>
              <button
                onClick={() => salvar("executado")}
                disabled={bloqueado}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {saving === "executado" && <Loader2 size={13} className="animate-spin" />}
                Salvar Execução
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
