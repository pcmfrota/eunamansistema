import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import HistoricoExclusoesClient from "./HistoricoExclusoesClient";

export const metadata = {
  title: "Histórico de Exclusões | Eunaman",
};

export default async function HistoricoExclusoesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  return <HistoricoExclusoesClient />;
}
