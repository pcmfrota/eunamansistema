"use client";

import FotosUploader from "./FotosUploader";
import CalendarioProgramacao from "./CalendarioProgramacao";
import { ExecucaoProgramacao, FotoEvidencia, VeiculoFrotaPesada } from "./types";

interface Props {
  frota: VeiculoFrotaPesada[];
  execucoes: ExecucaoProgramacao[];
  onExecucoesChange: (updater: (prev: ExecucaoProgramacao[]) => ExecucaoProgramacao[]) => void;
  canEdit: boolean;
  canDelete: boolean;
}

function renderCampos(dadosExtra: Record<string, any>, setDadosExtra: (d: Record<string, any>) => void) {
  const fotosAntes: FotoEvidencia[] = dadosExtra.fotos_antes || [];
  const fotosDepois: FotoEvidencia[] = dadosExtra.fotos_depois || [];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">Fotos — Antes da Lavagem</p>
        <FotosUploader fotos={fotosAntes} onChange={fotos => setDadosExtra({ ...dadosExtra, fotos_antes: fotos })} max={5} />
      </div>
      <div>
        <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">Fotos — Depois da Lavagem</p>
        <FotosUploader fotos={fotosDepois} onChange={fotos => setDadosExtra({ ...dadosExtra, fotos_depois: fotos })} max={5} />
      </div>
    </div>
  );
}

export default function LavagemTab({ frota, execucoes, onExecucoesChange, canEdit, canDelete }: Props) {
  return (
    <CalendarioProgramacao
      tipo_programacao="lavagem"
      tipoLabel="Lavagem dos Caminhões"
      periodicidade="semanal"
      frota={frota}
      execucoes={execucoes}
      onExecucoesChange={onExecucoesChange}
      canEdit={canEdit}
      canDelete={canDelete}
      camposExtrasTitulo="Evidências da Lavagem"
      renderCamposExtras={renderCampos}
    />
  );
}
