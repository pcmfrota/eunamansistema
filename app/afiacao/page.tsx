import AfiacaoClient from './AfiacaoClient';
import { listarAfiacoes } from './actions';

export default async function AfiacaoPage() {
  const afiacoes = await listarAfiacoes();

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Afiação</h2>
      </div>
      <AfiacaoClient initialAfiacoes={afiacoes} />
    </div>
  );
}
