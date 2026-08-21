"use server";

import { AppError } from "@/lib/domain/app-error";
import type { OrigemPaciente } from "@/lib/domain/enums";
import type {
  AtualizacaoPaciente,
  NovoPaciente,
  PacienteSemCpf,
} from "@/lib/domain/pacientes/types";
import { origemPermitidaPorPerfil } from "@/lib/domain/regras";
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

export async function listarPacientesAction(
  busca?: string
): Promise<AcaoResultado<PacienteSemCpf[]>> {
  try {
    const service = await PacienteService.create();
    return { ok: true, data: await service.listarPacientes(busca) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

export async function buscarPacienteAction(
  id: string
): Promise<AcaoResultado<PacienteSemCpf | null>> {
  try {
    const service = await PacienteService.create();
    return { ok: true, data: await service.buscarPaciente(id) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

// Criação de paciente (Sprint 38). A ORIGEM é derivada do perfil da SESSÃO —
// o cliente não escolhe:
//   * gestor / profissional_autorizador → 'regular';
//   * recepcionista → 'esporadico'.
// Se o cliente enviar uma origem diferente da permitida ao seu perfil, a ação é
// negada; se não enviar, a origem permitida é aplicada. A autoridade final
// continua no banco (policies pacientes_insert_regular /
// pacientes_insert_recepcao_esporadico).
export async function criarPacienteAction(
  dados: NovoPaciente
): Promise<AcaoResultado<PacienteSemCpf>> {
  try {
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

    const origemPermitida: OrigemPaciente = origemPermitidaPorPerfil(
      usuario.perfil
    );
    if (dados.origem != null && dados.origem !== origemPermitida) {
      throw new AppError(
        "ACESSO_NEGADO",
        "Seu perfil não pode cadastrar paciente com esta origem."
      );
    }

    const service = await PacienteService.create();
    return {
      ok: true,
      data: await service.criarPaciente({
        ...dados,
        origem: origemPermitida,
      }),
    };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

export async function atualizarPacienteAction(
  id: string,
  dados: AtualizacaoPaciente
): Promise<AcaoResultado<PacienteSemCpf>> {
  try {
    const service = await PacienteService.create();
    return { ok: true, data: await service.atualizarPaciente(id, dados) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}
