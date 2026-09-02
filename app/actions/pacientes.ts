"use server";

import { AppError } from "@/lib/domain/app-error";
import { PERFIS, type OrigemPaciente, type PerfilUsuario } from "@/lib/domain/enums";
import type {
  AtualizacaoPaciente,
  NovoPaciente,
  PacienteSemCpf,
} from "@/lib/domain/pacientes/types";
import {
  filtrarCamposEdicaoPaciente,
  origemPermitidaPorPerfil,
  validarAtualizacaoPaciente,
} from "@/lib/domain/regras";
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

    // Sprint 44 — todos os perfis podem criar as duas origens, exceto
    // recepcionista que NÃO cria regular independente.
    const origemSolicitada = dados.origem ?? origemPermitidaPorPerfil(usuario.perfil);
    const { podeCriarPacienteComOrigem } = await import("@/lib/domain/regras");
    if (!podeCriarPacienteComOrigem(usuario.perfil as PerfilUsuario, origemSolicitada as OrigemPaciente)) {
      throw new AppError(
        "ACESSO_NEGADO",
        "Seu perfil não pode cadastrar paciente com esta origem."
      );
    }
    // Recepcionista: se tentar regular, negar explicitamente (mesmo que a
    // policy negaria, mensagem mais clara na action)
    if (
      usuario.perfil === PERFIS.RECEPCIONISTA &&
      origemSolicitada === "regular"
    ) {
      throw new AppError(
        "ACESSO_NEGADO",
        "Recepcionista não pode cadastrar paciente regular como cadastro independente. Localize o paciente existente ou crie um paciente esporádico dentro do fluxo de liberação esporádica."
      );
    }

    const service = await PacienteService.create();
    return {
      ok: true,
      data: await service.criarPaciente({
        ...dados,
        origem: origemSolicitada as OrigemPaciente,
      }),
    };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

// Atualização de paciente (Sprint 41 — edição segura). O payload do cliente
// NUNCA chega cru ao repository:
//   1. sessão ativa obrigatória (identidade/perfil vêm da SESSÃO);
//   2. `origem` é rejeitada explicitamente — IMUTÁVEL após o cadastro (RN30,
//      garantida também no trigger fn_pacientes_before, migration
//      20260825000001);
//   3. whitelist por perfil (filtrarCamposEdicaoPaciente): gestor → somente
//      status; autorizador → dados cadastrais (nunca status/gestor_sus/cpf);
//      recepcionista → nenhuma edição;
//   4. validação de domínio do payload filtrado (validarAtualizacaoPaciente).
// A autoridade final continua no banco (RLS pacientes_update_* + trigger).
export async function atualizarPacienteAction(
  id: string,
  dados: AtualizacaoPaciente & Record<string, unknown>
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

    const perfil = usuario.perfil as PerfilUsuario;

    // RN30 — tentativa explícita de converter origem é rejeitada antes de
    // qualquer filtragem (a origem não existe em whitelist alguma).
    if ("origem" in dados) {
      throw new AppError(
        "VALIDACAO",
        "A origem do paciente é imutável após o cadastro (RN30)."
      );
    }

    if (perfil === PERFIS.RECEPCIONISTA) {
      throw new AppError(
        "ACESSO_NEGADO",
        "Recepcionista não pode editar pacientes."
      );
    }

    const payload = filtrarCamposEdicaoPaciente(
      perfil,
      dados as Record<string, unknown>
    );
    validarAtualizacaoPaciente(perfil, payload);

    const service = await PacienteService.create();
    return {
      ok: true,
      data: await service.atualizarPaciente(id, payload as AtualizacaoPaciente),
    };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}
