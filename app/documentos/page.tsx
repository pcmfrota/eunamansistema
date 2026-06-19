import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import DocumentosClient from "./DocumentosClient";
import { 
  getTacografos, 
  getCivCipps, 
  getLaudosEletro, 
  getLaudosImplemento 
} from "./actions";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DocumentosPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isVisitante = profile?.role === 'visitante';

  // Buscar todos os dados iniciais
  const [tacografos, civCipps, laudosEletro, laudosImplemento] = await Promise.all([
    getTacografos(),
    getCivCipps(),
    getLaudosEletro(),
    getLaudosImplemento()
  ]);

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <DocumentosClient 
        isVisitante={isVisitante} 
        initialTacografos={tacografos}
        initialCivCipps={civCipps}
        initialLaudosEletro={laudosEletro}
        initialLaudosImplemento={laudosImplemento}
      />
    </div>
  );
}
