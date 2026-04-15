import { getCalendario } from "./actions";
import CalendarioClient from "./CalendarioClient";

export default async function CalendarioPage() {
  const data = await getCalendario();
  
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Calendário Suzano</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Definição dos períodos de fechamento mensal</p>
      </div>

      <CalendarioClient initialData={data} />
    </div>
  );
}
