import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import AtendimentoView from "./components/atendimento-view";

export default async function AtendimentoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fdashboard%2Fatendimento");
  }

  const usuario = await getUsuarioFuncional(supabase, user);

  if (!usuario || usuario.statusAtivo !== true || !usuario.perfil) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <main className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-brand-900">Acesso restrito</h1>
          <p className="mt-2 text-sm text-zinc-500">Seu usuário está inativo ou sem perfil — procure a gestão.</p>
        </main>
      </div>
    );
  }

  return <AtendimentoView perfil={usuario.perfil} />;
}
