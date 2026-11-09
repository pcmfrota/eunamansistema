import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ProgramacaoMecanicaClient from "./ProgramacaoMecanicaClient";

export const metadata = {
  title: "Programação Mecânica | EUNAMAN SISTEMA",
  description: "Inspeção quinzenal, lubrificação, calibragem e lavagem da frota pesada",
};

export default async function ProgramacaoMecanicaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: equipamentos } = await supabase
    .from("equipamentos")
    .select("id, placa, modelo, tipo, categoria, modulo, area, status");

  const { data: execucoes } = await supabase
    .from("programacao_mecanica_execucoes")
    .select("*")
    .order("data_programada", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role || "visitante").toLowerCase().trim();

  return (
    <div className="min-h-screen w-full flex flex-col pt-[70px] lg:pt-0 lg:pl-64 transition-all duration-300 relative overflow-hidden">
      <ProgramacaoMecanicaClient
        initialEquipamentos={equipamentos || []}
        initialExecucoes={execucoes || []}
        userRole={role}
      />
    </div>
  );
}
