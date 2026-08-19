"use server";

import { AppError } from "@/lib/domain/app-error";
import type {
  AtualizacaoPaciente,
  NovoPaciente,
  PacienteSemCpf,
} from "@/lib/domain/pacientes/types";
import { PacienteService } from "@/lib/services/paciente-service";
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

export async function criarPacienteAction(
  dados: NovoPaciente
): Promise<AcaoResultado<PacienteSemCpf>> {
  try {
    const service = await PacienteService.create();
    return { ok: true, data: await service.criarPaciente(dados) };
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
