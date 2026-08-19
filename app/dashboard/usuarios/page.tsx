import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import { permissoesUsuarios } from "@/lib/domain/regras";
import { normalizarBusca } from "@/lib/repositories/paciente-repository";
import { listarUsuariosAction } from "@/app/actions/usuarios";
import UsuariosView from "./components/usuarios-view";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fdashboard%2Fusuarios");
  }

  const usuario = await getUsuarioFuncional(supabase, user);
  const permissoes = permissoesUsuarios(
    usuario?.perfil ?? null,
    usuario?.statusAtivo ?? null
  );

  // Gestão de usuários é exclusiva do Gestor ATIVO (usuarios_select_gestor/
  // usuarios_update_gestor). Autorizador, recepcionista, inativo e sem vínculo
  // não acessam — a autoridade final é o banco (RLS); aqui apenas evitamos a
  // consulta e orientamos o usuário.
  if (!permissoes.podeAcessar) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <main className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-brand-900">Acesso restrito</h1>
          <p className="mt-2 text-sm text-zinc-500">
            A gestão de usuários é exclusiva do Gestor ativo. Procure a gestão do
            CAPS para regularizar seu acesso.
          </p>
        </main>
      </div>
    );
  }

  const { q } = await searchParams;
  const busca = normalizarBusca(q);

  const resultado = await listarUsuariosAction(busca);

  return (
    <UsuariosView
      busca={busca}
      usuariosIniciais={resultado.ok ? resultado.data : []}
      erroInicial={resultado.ok ? null : resultado.error}
    />
  );
}