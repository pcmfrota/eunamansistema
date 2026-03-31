import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getUsers } from "./actions";
import UsuariosClient from "./UsuariosClient";

export const metadata = {
  title: "Gestão de Usuários | Eunaman",
};

export default async function UsuariosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verifica papel do usuário
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const { profiles = [], error } = await getUsers();

  return (
    <UsuariosClient initialProfiles={profiles} />
  );
}
