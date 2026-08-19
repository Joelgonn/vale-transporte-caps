import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import { permissoesPacientes } from "@/lib/domain/regras";
import { normalizarBusca } from "@/lib/repositories/paciente-repository";
import { listarPacientesAction } from "@/app/actions/pacientes";
import PacientesView from "./components/pacientes-view";

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O proxy.ts já protege /dashboard; aqui reforçamos para a rota nunca renderizar
  // dados sem sessão real (não há segunda estratégia de autenticação).
  if (!user) {
    redirect("/login?next=%2Fdashboard%2Fpacientes");
  }

  const usuario = await getUsuarioFuncional(supabase, user);
  const permissoes = permissoesPacientes(usuario?.perfil ?? null, usuario?.statusAtivo ?? null);

  // Usuário inativo / sem perfil funcional: NÃO acessa dados operacionais.
  // A autoridade é o banco (RLS exige perfil + usuario_ativo_atual()); aqui
  // apenas evitamos consultas desnecessárias e orientamos o usuário.
  if (!permissoes.podeAcessar) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <main className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-brand-900">Acesso restrito</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Seu usuário está inativo ou sem perfil funcional configurado. Procure a
            gestão do CAPS para regularizar seu acesso.
          </p>
        </main>
      </div>
    );
  }

  const { q } = await searchParams;
  const busca = normalizarBusca(q);

  const resultado = await listarPacientesAction(busca);

  return (
    <PacientesView
      perfil={usuario!.perfil!}
      statusAtivo={usuario!.statusAtivo === true}
      busca={busca}
      pacientesIniciais={resultado.ok ? resultado.data : []}
      erroInicial={resultado.ok ? null : resultado.error}
    />
  );
}
