import LavagensClient from "./LavagensClient";
import { getEquipamentos, getLavagens } from "./actions";

export const metadata = {
  title: "Controle de Lavagens | EUNAMAN",
  description: "Gestão de lavagens da frota EUNAMAN",
};

export default async function LavagensPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string };
}) {
  const now = new Date();
  const mes = searchParams.mes ? parseInt(searchParams.mes) : now.getMonth() + 1;
  const ano = searchParams.ano ? parseInt(searchParams.ano) : now.getFullYear();

  const [lavagens, equipamentos] = await Promise.all([
    getLavagens(mes, ano),
    getEquipamentos(),
  ]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <LavagensClient 
        initialLavagens={lavagens} 
        equipamentos={equipamentos}
        currentMes={mes}
        currentAno={ano}
      />
    </div>
  );
}
