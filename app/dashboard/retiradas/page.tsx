import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import { permissoesRetiradas } from "@/lib/domain/regras";
import { listarRetiradasAction } from "@/app/actions/retiradas";
import RetiradasView from "./components/retiradas-view";

export default async function RetiradasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O proxy.ts já protege /dashboard; aqui reforçamos para a rota nunca renderizar
  // dados sem sessão real (não há segunda estratégia de autenticação).
  if (!user) {
    redirect("/login?next=%2Fdashboard%2Fretiradas");
  }

  const usuario = await getUsuarioFuncional(supabase, user);
  const permissoes = permissoesRetiradas(
    usuario?.perfil ?? null,
    usuario?.statusAtivo ?? null
  );

  // Acesso às retiradas: somente recepcionista/gestor ATIVOS (RLS). O
  // autorizador não acessa o módulo; aqui evitamos consultas desnecessárias e
  // orientamos o usuário.
  if (!permissoes.podeAcessar) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <main className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-brand-900">Acesso restrito</h1>
          <p className="mt-2 text-sm text-zinc-500">
            O módulo de retiradas é destinado à recepção e à gestão. Seu usuário
            está inativo ou sem perfil funcional configurado — procure a gestão
            do CAPS.
          </p>
        </main>
      </div>
    );
  }

  const resultado = await listarRetiradasAction();

  return (
    <RetiradasView
      perfil={usuario!.perfil!}
      statusAtivo={usuario!.statusAtivo === true}
      retiradasIniciais={resultado.ok ? resultado.data : []}
      erroInicial={resultado.ok ? null : resultado.error}
    />
  );
}