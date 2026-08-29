import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import TentativasAcessoClient from "./TentativasAcessoClient";

export const metadata = {
  title: "Tentativas de Acesso | Eunaman",
};

export default async function TentativasAcessoPage() {
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

  return <TentativasAcessoClient />;
}
