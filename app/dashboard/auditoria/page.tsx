import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import { permissoesAuditoria } from "@/lib/domain/regras";
import type { FiltrosAuditoria } from "@/lib/domain/auditoria/types";
import { listarAuditoriaAction } from "@/app/actions/auditoria";
import { listarUsuariosAction } from "@/app/actions/usuarios";
import AuditoriaView from "./components/auditoria-view";

type AuditoriaSearchParams = {
  acao?: string;
  entidade?: string;
  usuario?: string;
  de?: string;
  ate?: string;
  pagina?: string;
};

// Inputs date nativos enviam "2026-08-13"; qualquer outro valor de data é
// ignorado (o PostgREST rejeitaria string arbitrária no gte/lte).
function somenteData(valor?: string): string | null {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<AuditoriaSearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O proxy.ts já protege /dashboard; aqui reforçamos para a rota nunca renderizar
  // dados sem sessão real (não há segunda estratégia de autenticação).
  if (!user) {
    redirect("/login?next=%2Fdashboard%2Fauditoria");
  }

  const usuario = await getUsuarioFuncional(supabase, user);
  const permissoes = permissoesAuditoria(
    usuario?.perfil ?? null,
    usuario?.statusAtivo ?? null
  );

  // A auditoria é exclusiva do Gestor ATIVO (policy auditoria_select_gestor).
  // Aqui evitamos consultas desnecessárias e orientamos o usuário.
  if (!permissoes.podeConsultar) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <main className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-brand-900">Acesso restrito</h1>
          <p className="mt-2 text-sm text-zinc-500">
            A consulta de auditoria é exclusiva do Gestor ativo. Seu usuário está
            inativo ou sem perfil funcional configurado — procure a gestão do CAPS.
          </p>
        </main>
      </div>
    );
  }

  const params = await searchParams;
  const pagina = Number(params.pagina);
  const filtros: FiltrosAuditoria = {
    acao: params.acao?.trim() || null,
    entidadeTipo: params.entidade?.trim() || null,
    dataDe: somenteData(params.de),
    dataAte: somenteData(params.ate),
    usuarioId: params.usuario?.trim() || null,
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
  };

  const resultado = await listarAuditoriaAction(filtros);

  // Nomes dos usuários para o filtro "Responsável" — o Gestor já os vê no
  // módulo Usuários; aqui apenas reutilizamos a action sancionada de listagem.
  const usuariosResultado = await listarUsuariosAction();
  const responsaveis = usuariosResultado.ok
    ? usuariosResultado.data.map((u) => ({ id: u.id, nome: u.nome }))
    : [];

  return (
    <AuditoriaView
      filtros={filtros}
      eventos={resultado.ok ? resultado.data.eventos : []}
      total={resultado.ok ? resultado.data.total : 0}
      porPagina={resultado.ok ? resultado.data.porPagina : 20}
      erroInicial={resultado.ok ? null : resultado.error}
      responsaveis={responsaveis}
    />
  );
}
