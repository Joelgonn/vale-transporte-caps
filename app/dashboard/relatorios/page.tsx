import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import { permissoesRelatorios } from "@/lib/domain/regras";
import { TIPOS_RELATORIO, type FiltrosRelatorio } from "@/lib/domain/relatorios/types";
import { consultarRelatorioAction } from "@/app/actions/relatorios";
import { listarPacientesAction } from "@/app/actions/pacientes";
import RelatoriosView from "./components/relatorios-view";
import { PageHeader } from "@/components/ui/page-header";
import { FeedbackErro } from "@/components/ui/feedback";

type RelatoriosSearchParams = {
  tipo?: string;
  de?: string;
  ate?: string;
  busca?: string;
  tl?: string;
  pagina?: string;
  paciente?: string;
  status?: string;
  origem?: string;
};

function somenteData(valor?: string): string | null {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<RelatoriosSearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fdashboard%2Frelatorios");
  }

  const usuario = await getUsuarioFuncional(supabase, user);
  const permissoes = permissoesRelatorios(
    usuario?.perfil ?? null,
    usuario?.statusAtivo ?? null
  );

  if (!permissoes.podeConsultar) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <main className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-brand-900">Acesso restrito</h1>
          <p className="mt-2 text-sm text-zinc-500">
            A consulta de relatórios é exclusiva do Gestor ativo. Seu usuário
            está inativo ou sem perfil funcional configurado — procure a gestão
            do CAPS.
          </p>
        </main>
      </div>
    );
  }

  const params = await searchParams;

  const tipo =
    (TIPOS_RELATORIO as readonly string[]).includes(params.tipo ?? "")
      ? (params.tipo as FiltrosRelatorio["tipo"])
      : "liberacoes";

  // === Fluxo do Histórico por Paciente (Sprint 38) ===
  if (tipo === "historico") {
    if (params.paciente) {
      // Paciente já selecionado — consultar o relatório histórico.
      const filtros: FiltrosRelatorio = {
        tipo: "historico",
        de: somenteData(params.de),
        ate: somenteData(params.ate),
        busca: null,
        tipoLiberacao: params.tl?.trim() || null,
        paciente: params.paciente,
        status: (params.status ?? "").trim() || null,
        origem: (params.origem ?? "").trim() || null,
        pagina: Number(params.pagina) || 1,
      };
      const resultado = await consultarRelatorioAction(filtros);
      return (
        <RelatoriosView
          filtros={filtros}
          resultado={resultado.ok ? resultado.data : null}
          erroInicial={resultado.ok ? null : resultado.error}
          candidatos={[]}
        />
      );
    }

    if (params.busca) {
      // Etapa de busca: sugerir pacientes correspondentes via v_pacientes.
      const buscaAcao = await listarPacientesAction(params.busca);
      if (buscaAcao.ok) {
        if (!buscaAcao.data || buscaAcao.data.length === 0) {
          return (
            <div className="flex flex-1 flex-col py-6">
              <PageHeader
                titulo="Relatórios"
                descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
              />
              <FeedbackErro>Nenhum paciente encontrado.</FeedbackErro>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-10 items-center rounded-md bg-brand-900 px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Buscar outro paciente
              </button>
            </div>
          );
        }
// Candidatos encontrados — renderizar com lista de seleção.
        const filtros: FiltrosRelatorio = {
          tipo: "historico",
          pagina: 1,
        };
        return (
          <RelatoriosView
            filtros={filtros}
            resultado={null}
            erroInicial={null}
            candidatos={buscaAcao.data}
          />
        );
      }
      // Em caso de erro na ação.
      return (
        <div className="flex flex-1 flex-col py-6">
          <PageHeader
            titulo="Relatórios"
            descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
          />
          <FeedbackErro>
            {buscaAcao.error ?? "Ocorreu um erro inesperado."}
          </FeedbackErro>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-10 items-center rounded-md bg-brand-900 px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Buscar outro paciente
          </button>
        </div>
      );
    }

    // Etapa inicial: nenhum termo digitado ainda.
    const filtros: FiltrosRelatorio = {
      tipo: "historico",
      pagina: 1,
    };
    return (
      <RelatoriosView
        filtros={filtros}
        resultado={null}
        erroInicial={null}
        candidatos={[]}
      />
    );
  }

  // Fluxo padrão (liberacoes / retiradas / consolidado).
  const filtros: FiltrosRelatorio = {
    tipo,
    de: somenteData(params.de),
    ate: somenteData(params.ate),
    busca: params.busca?.trim() || null,
    tipoLiberacao: params.tl?.trim() || null,
    pagina: Number(params.pagina) || 1,
  };

  const resultado = await consultarRelatorioAction(filtros);

  return (
    <RelatoriosView
      filtros={filtros}
      resultado={resultado.ok ? resultado.data : null}
      erroInicial={resultado.ok ? null : resultado.error}
      candidatos={[]}
    />
  );
}