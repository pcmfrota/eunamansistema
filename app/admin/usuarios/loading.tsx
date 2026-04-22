import { Loader2, Users } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
      <div className="p-4 rounded-full bg-blue-500/10 mb-2">
        <Users className="w-8 h-8 text-blue-500 animate-pulse" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Gestão de Usuários</h2>
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando perfis...</span>
        </div>
      </div>
      
      <div className="w-full max-w-4xl mt-8 space-y-4 opacity-10">
        <div className="h-10 w-48 bg-zinc-400 rounded-lg" />
        <div className="h-96 bg-zinc-400 rounded-3xl" />
      </div>
    </div>
  );
}
