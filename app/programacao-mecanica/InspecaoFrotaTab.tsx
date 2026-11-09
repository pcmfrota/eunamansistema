"use client";

import CalendarioProgramacao from "./CalendarioProgramacao";
import { ExecucaoProgramacao, VeiculoFrotaPesada } from "./types";

interface Props {
  frota: VeiculoFrotaPesada[];
  execucoes: ExecucaoProgramacao[];
  onExecucoesChange: (updater: (prev: ExecucaoProgramacao[]) => ExecucaoProgramacao[]) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export default function InspecaoFrotaTab({ frota, execucoes, onExecucoesChange, canEdit, canDelete }: Props) {
  return (
    <CalendarioProgramacao
      tipo_programacao="inspecao"
      tipoLabel="Inspeção da Frota"
      periodicidade="quinzenal"
      frota={frota}
      execucoes={execucoes}
      onExecucoesChange={onExecucoesChange}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}
