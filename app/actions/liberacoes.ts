"use server";

import { AppError } from "@/lib/domain/app-error";
import { PERFIS } from "@/lib/domain/enums";
import type {
  CriarLiberacaoDados,
  LiberacaoComPaciente,
  NovaLiberacao,
} from "@/lib/domain/liberacoes/types";
import { LiberacaoService } from "@/lib/services/liberacao-service";
import { PacienteService } from "@/lib/services/paciente-service";
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
// aqui apenas antecipamos a checagem de forma segura.
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

export async function listarLiberacoesAction(
  busca?: string
): Promise<AcaoResultado<LiberacaoComPaciente[]>> {
  try {
    await exigirUsuarioAtivo();
    const service = await LiberacaoService.create();
    return { ok: true, data: await service.listarLiberacoes(busca) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

export async function buscarLiberacaoAction(
  id: string
): Promise<AcaoResultado<LiberacaoComPaciente | null>> {
  try {
    await exigirUsuarioAtivo();
    const service = await LiberacaoService.create();
    return { ok: true, data: await service.buscarLiberacao(id) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

// Criação de liberação. A identidade vem da SESSÃO (nunca do cliente):
//   * NOVA liberação → somente profissional_autorizador ativo; o
//     profissional_autorizador_id é resolvido aqui via public.usuario_atual_id()
//     (getUsuarioFuncional.usuarioId) — o cliente não informa.
//   * RENOVAÇÃO → somente recepcionista ativa; o autorizador ORIGINAL e os
//     parâmetros (paciente/tipo/quantidade/período) são copiados da liberação
//     original pelo servidor (buscarLiberacao + renovacao_de_id). O cliente
//     envia APENAS renovacaoDeId — nunca profissional_autorizador_id.
// RN29 (Sprint 38): a origem do paciente é lida no servidor e repassada à
// validação — paciente esporádico somente liberação avulsa. A autoridade final
// continua no banco (RLS liberacoes_insert_* + trigger fn_liberacoes_before).
// Entrada: RenovacaoLiberacao ({ renovacaoDeId }) OU NovaLiberacao ({ pacienteId,
// tipo, quantidade, periodoMeses }) — a união é discriminada pela presença de
// pacienteId.
export async function criarLiberacaoAction(
  dados: CriarLiberacaoDados
): Promise<AcaoResultado<LiberacaoComPaciente>> {
  try {
    const usuario = await exigirUsuarioAtivo();

    // Renovação pela recepção (liberacoes_insert_recepcao_renovacao).
    if (!("pacienteId" in dados)) {
      if (usuario.perfil !== PERFIS.RECEPCIONISTA) {
        throw new AppError(
          "ACESSO_NEGADO",
          "Somente a recepção pode renovar liberações."
        );
      }

      const service = await LiberacaoService.create();
      const original = await service.buscarLiberacao(dados.renovacaoDeId);
      if (!original) {
        throw new AppError(
          "NAO_ENCONTRADO",
          "Liberação original não encontrada para renovação."
        );
      }

      const pacienteService = await PacienteService.create();
      const paciente = await pacienteService.buscarPaciente(
        original.paciente_id
      );

      const dadosRenovacao: NovaLiberacao = {
        pacienteId: original.paciente_id,
        tipo: original.tipo,
        quantidade: original.quantidade,
        periodoMeses: original.periodo_meses,
        profissionalAutorizadorId: original.profissional_autorizador_id,
        renovacaoDeId: original.id,
      };

      return {
        ok: true,
        data: await service.criarLiberacao(dadosRenovacao, paciente?.origem),
      };
    }

    // Nova liberação pelo próprio autorizador (liberacoes_insert_autorizador).
    if (usuario.perfil !== PERFIS.PROFISSIONAL_AUTORIZADOR) {
      throw new AppError(
        "ACESSO_NEGADO",
        "Somente o profissional autorizador pode criar liberações."
      );
    }
    if (!usuario.usuarioId) {
      throw new AppError(
        "ACESSO_NEGADO",
        "Usuário sem registro funcional. Procure a gestão do CAPS."
      );
    }

    const service = await LiberacaoService.create();
    const pacienteService = await PacienteService.create();
    const paciente = await pacienteService.buscarPaciente(dados.pacienteId);

    const dadosFinais: NovaLiberacao = {
      pacienteId: dados.pacienteId,
      tipo: dados.tipo,
      quantidade: dados.quantidade,
      periodoMeses: dados.periodoMeses ?? null,
      profissionalAutorizadorId: usuario.usuarioId,
    };

    return {
      ok: true,
      data: await service.criarLiberacao(dadosFinais, paciente?.origem),
    };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}