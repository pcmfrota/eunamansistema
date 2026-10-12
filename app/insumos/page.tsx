import { getInsumosBaseData, getEquipamentosParaAbastecimento } from "./actions";
import InsumosClient from "./InsumosClient";

export default async function InsumosPage() {
  const [baseData, equipamentos] = await Promise.all([
    getInsumosBaseData(),
    getEquipamentosParaAbastecimento(),
  ]);

  return (
    <InsumosClient
      initialComboios={baseData.comboios}
      modulos={baseData.modulos}
      materiais={baseData.materiais}
      impedimentos={baseData.impedimentos}
      colaboradores={baseData.colaboradores}
      equipamentos={equipamentos}
      error={baseData.error}
    />
  );
}
