import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import { permissoesLiberacoes } from "@/lib/domain/regras";
import { normalizarBusca } from "@/lib/repositories/paciente-repository";
import { listarLiberacoesAction } from "@/app/actions/liberacoes";
import { buscarPacienteAction } from "@/app/actions/pacientes";
import LiberacoesView from "./components/liberacoes-view";

export default async function LiberacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; paciente?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O proxy.ts já protege /dashboard; aqui reforçamos para a rota nunca renderizar
  // dados sem sessão real (não há segunda estratégia de autenticação).
  if (!user) {
    redirect("/login?next=%2Fdashboard%2Fliberacoes");
  }

  const usuario = await getUsuarioFuncional(supabase, user);
  const permissoes = permissoesLiberacoes(
    usuario?.perfil ?? null,
    usuario?.statusAtivo ?? null
  );

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

  const { q, paciente } = await searchParams;
  const busca = normalizarBusca(q);
  const pacienteId = typeof paciente === "string" && paciente.trim() ? paciente.trim() : null;

  let pacienteSelecionado: { id: string; gestor_sus: string; nome: string; origem?: string | null } | null = null;
  if (pacienteId) {
    const r = await buscarPacienteAction(pacienteId);
    if (r.ok && r.data) pacienteSelecionado = r.data as unknown as typeof pacienteSelecionado;
  }

  const resultado = pacienteId
    ? await listarLiberacoesAction(undefined, pacienteId)
    : await listarLiberacoesAction(busca);

  return (
    <LiberacoesView
      perfil={usuario!.perfil!}
      statusAtivo={usuario!.statusAtivo === true}
      busca={busca}
      pacienteSelecionado={pacienteSelecionado}
      liberacoesIniciais={resultado.ok ? resultado.data : []}
      erroInicial={resultado.ok ? null : resultado.error}
    />
  );
}