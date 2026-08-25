"use server";

import { AppError } from "@/lib/domain/app-error";
import { PERFIS } from "@/lib/domain/enums";
import type {
  FiltrosRelatorio,
  ResultadoListaRelatorio,
  ResultadoResumoRelatorio,
} from "@/lib/domain/relatorios/types";
import { RelatorioService } from "@/lib/services/relatorio-service";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import type { AcaoResultado } from "@/app/actions/resultado";

// Só mensagens de domínio (AppError) são exibíveis. Qualquer erro não mapeado
// vira mensagem genérica — SQLSTATE/stack/RLS nunca chegam à UI.
function mensagemDaAcao(erro: unknown): string {
  return erro instanceof AppError
    ? erro.message
    : "Ocorreu um erro inesperado.";
}

// Bloqueio operacional comum: usuário deve estar autenticado, vinculado a um
// registro funcional e ATIVO. A autoridade final continua no banco (RLS/trigger);
// aqui apenas antecipamos a checagem de forma segura — mesmo padrão das ações
// de retiradas e auditoria.
async function exigirUsuarioAtivo(): Promise<{
  perfil: string | null;
  statusAtivo: boolean | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("ACESSO_NEGADO", "Sessão não autenticada.");
  }

  const usuario = await getUsuarioFuncional(supabase, user);
  if (!usuario || usuario.statusAtivo !== true || usuario.perfil == null) {
    throw new AppError(
      "ACESSO_NEGADO",
      "Usuário inativo ou sem perfil funcional. Procure a gestão do CAPS."
    );
  }

  return {
    perfil: usuario.perfil,
    statusAtivo: usuario.statusAtivo,
  };
}

// Consulta de relatórios (Sprint 37 — Fase 8). Somente o Gestor ATIVO pode
// consultar (REPORTS.md: acesso a relatórios restrito ao Gestor; o acesso do
// autorizador é decisão institucional pendente — não implementado). Os filtros
// e a paginação são aplicados no PostgREST (eq/gte/lte + range) — nunca no
// navegador. Nenhum relatório inclui CPF.
export async function consultarRelatorioAction(
  filtros: FiltrosRelatorio
): Promise<AcaoResultado<ResultadoListaRelatorio>> {
  try {
    const usuario = await exigirUsuarioAtivo();

    if (usuario.perfil !== PERFIS.GESTOR) {
      throw new AppError(
        "ACESSO_NEGADO",
        "Somente o Gestor pode consultar relatórios."
      );
    }

    const service = await RelatorioService.create();
    return { ok: true, data: await service.consultar(filtros) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

// Resumo gerencial de vales (Sprint 40). Mesmo gate do Gestor ativo; a
// agregação é feita no servidor sobre dados já existentes (sem migration/RLS
// novas). Semântica do período documentada em DOMAIN.md e no repositório.
export async function relatorioResumoAction(
  filtros: FiltrosRelatorio
): Promise<AcaoResultado<ResultadoResumoRelatorio>> {
  try {
    const usuario = await exigirUsuarioAtivo();

    if (usuario.perfil !== PERFIS.GESTOR) {
      throw new AppError(
        "ACESSO_NEGADO",
        "Somente o Gestor pode consultar relatórios."
      );
    }

    const service = await RelatorioService.create();
    return { ok: true, data: await service.obterResumo(filtros) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}