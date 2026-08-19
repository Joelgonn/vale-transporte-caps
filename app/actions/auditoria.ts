"use server";

import { AppError } from "@/lib/domain/app-error";
import { PERFIS } from "@/lib/domain/enums";
import type {
  FiltrosAuditoria,
  ResultadoListaAuditoria,
} from "@/lib/domain/auditoria/types";
import { AuditoriaService } from "@/lib/services/auditoria-service";
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
// aqui apenas antecipamos a checagem de forma segura — mesmo padrão das actions
// de retiradas.
async function exigirUsuarioAtivo(): Promise<{
  perfil: string | null;
  statusAtivo: boolean | null;
  usuarioId: string | null;
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
    usuarioId: usuario.usuarioId,
  };
}

// Consulta da trilha de auditoria (Sprint 21). Somente o Gestor ATIVO pode
// consultar (policy auditoria_select_gestor); os demais recebem acesso negado
// já no servidor. Os filtros são aplicados no PostgREST (eq/gte/lte) — nunca no
// navegador.
export async function listarAuditoriaAction(
  filtros: FiltrosAuditoria
): Promise<AcaoResultado<ResultadoListaAuditoria>> {
  try {
    const usuario = await exigirUsuarioAtivo();

    if (usuario.perfil !== PERFIS.GESTOR) {
      throw new AppError(
        "ACESSO_NEGADO",
        "Somente o Gestor pode consultar a auditoria."
      );
    }

    const service = await AuditoriaService.create();
    return { ok: true, data: await service.listarEventos(filtros) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}
