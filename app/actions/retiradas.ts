"use server";

import { AppError } from "@/lib/domain/app-error";
import { PERFIS } from "@/lib/domain/enums";
import type {
  NovaRetirada,
  Retirada,
  RetiradaComDetalhes,
} from "@/lib/domain/retiradas/types";
import { RetiradaService } from "@/lib/services/retirada-service";
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
// aqui apenas antecipamos a checagem de forma segura — mesmo padrão das
// actions de liberações.
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

export async function listarRetiradasAction(): Promise<
  AcaoResultado<RetiradaComDetalhes[]>
> {
  try {
    await exigirUsuarioAtivo();
    const service = await RetiradaService.create();
    return { ok: true, data: await service.listarRetiradas() };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

export async function buscarRetiradaAction(
  id: string
): Promise<AcaoResultado<RetiradaComDetalhes | null>> {
  try {
    await exigirUsuarioAtivo();
    const service = await RetiradaService.create();
    return { ok: true, data: await service.buscarRetirada(id) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

// Registro de retirada. A identidade vem da SESSÃO (nunca do cliente): o
// recepcionista_id e a data_hora são preenchidos pelo trigger a partir da
// sessão (RN28). Somente recepcionista ATIVA pode registrar (retiradas_insert_
// recepcao — RLS). A autoridade final do saldo/validade continua no trigger
// fn_retiradas_before.
export async function registrarRetiradaAction(
  dados: NovaRetirada
): Promise<AcaoResultado<Retirada>> {
  try {
    const usuario = await exigirUsuarioAtivo();

    // Sprint 44 — todos os perfis ativos podem registrar retirada (operação).
    // A distinção autorizador vs operação é conceitual; a entrega é
    // operacionalizada por quem estiver na recepção no momento.
    if (
      usuario.perfil !== PERFIS.GESTOR &&
      usuario.perfil !== PERFIS.PROFISSIONAL_AUTORIZADOR &&
      usuario.perfil !== PERFIS.RECEPCIONISTA
    ) {
      throw new AppError("ACESSO_NEGADO", "Perfil sem permissão para registrar retiradas.");
    }

    const service = await RetiradaService.create();
    // Sprint 44 P1/P2 — infraestrutura de estouro: detectar e logar (sem bloquear).
    // Best-effort: se a verificação falhar (ex.: mock de teste sem Supabase),
    // não impede o registro — RN31 garante que retirada nunca é bloqueada por previsão.
    try {
      const liberacao = await (await import("@/lib/services/liberacao-service")).LiberacaoService.create()
        .then((s) => s.buscarLiberacao(dados.liberacaoId));
      if (liberacao) {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();
        const { data: retiradasExistentes } = await supabase
          .from("retiradas")
          .select("quantidade")
          .eq("liberacao_id", dados.liberacaoId);
        const totalExistente = ((retiradasExistentes ?? []) as { quantidade: number }[]).reduce(
          (a, r) => a + (r.quantidade ?? 0),
          0
        );
        const { isEstouro } = await import("@/lib/domain/regras");
        const totalComNova = totalExistente + dados.quantidade;
        if (isEstouro(liberacao.quantidade, totalComNova)) {
          console.warn(
            `[Sprint44] Retirada em estouro de previsão: liberacao ${dados.liberacaoId} previsto ${liberacao.quantidade} totalComNova ${totalComNova}`
          );
        }
      }
    } catch {
      // Verificação opcional — nunca bloqueia o fluxo principal
    }

    return { ok: true, data: await service.registrarRetirada(dados) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}