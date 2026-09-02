import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import { permissoesRelatorios } from "@/lib/domain/regras";
import type { FiltrosRelatorio } from "@/lib/domain/relatorios/types";
import { consultarRelatorioAction } from "@/app/actions/relatorios";
import { listarPacientesAction } from "@/app/actions/pacientes";
import HistoricoView from "./components/historico-view";

type SearchParams = {
  paciente?: string;
  busca?: string;
  de?: string;
  ate?: string;
  tl?: string;
  status?: string;
  origem?: string;
  pagina?: string;
};

function somenteData(valor?: string): string | null {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fdashboard%2Fhistorico");
  }

  const usuario = await getUsuarioFuncional(supabase, user);
  const permissoes = permissoesRelatorios(usuario?.perfil ?? null, usuario?.statusAtivo ?? null);

  if (!permissoes.podeConsultar) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <main className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-brand-900">Acesso restrito</h1>
          <p className="mt-2 text-sm text-zinc-500">
            O histórico é exclusivo do Gestor ativo. Seu usuário está inativo ou sem perfil funcional — procure a
            gestão do CAPS.
          </p>
        </main>
      </div>
    );
  }

  const params = await searchParams;

  // Paciente já selecionado → carrega histórico
  if (params.paciente) {
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
      <HistoricoView
        filtros={filtros}
        resultado={resultado.ok ? resultado.data : null}
        erroInicial={resultado.ok ? null : resultado.error}
        candidatos={[]}
      />
    );
  }

  // Busca por paciente → lista candidatos
  if (params.busca) {
    const buscaAcao = await listarPacientesAction(params.busca);
    if (buscaAcao.ok) {
      if (!buscaAcao.data || buscaAcao.data.length === 0) {
        return (
          <HistoricoView
            filtros={{ tipo: "historico", pagina: 1 }}
            resultado={null}
            erroInicial="Nenhum paciente encontrado."
            candidatos={[]}
          />
        );
      }
      return (
        <HistoricoView
          filtros={{ tipo: "historico", pagina: 1 }}
          resultado={null}
          erroInicial={null}
          candidatos={buscaAcao.data}
        />
      );
    }
    return (
      <HistoricoView
        filtros={{ tipo: "historico", pagina: 1 }}
        resultado={null}
        erroInicial={buscaAcao.error ?? "Ocorreu um erro inesperado."}
        candidatos={[]}
      />
    );
  }

  // Estado inicial — sem paciente
  return (
    <HistoricoView filtros={{ tipo: "historico", pagina: 1 }} resultado={null} erroInicial={null} candidatos={[]} />
  );
}
