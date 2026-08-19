// Testes de INTEGRAÇÃO — fluxo real de retiradas (Sprint 20).
//
// Exercitam o banco REAL com RLS/triggers habilitados, usando os mesmos
// componentes de produção (RetiradaService + RetiradaRepositoryPostgres) e os
// usuários de teste do seed (scripts/seed-test-users.mjs). São ENV-GUARDED
// (describe.skipIf). As retiradas criadas são removidas no `finally` (service
// role — o trigger fn_retiradas_before é before insert/update e não bloqueia
// DELETE; RLS é ignorada pelo service role). As liberações usadas são criadas
// e removidas no próprio teste. Os logs de auditoria NÃO são removidos —
// auditoria_logs é append-only por design.
//
// Requer no ambiente: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SERVICE_ROLE_KEY e as credenciais TEST_GESTOR_/TEST_AUTORIZADOR_/
// TEST_RECEPCIONISTA_/TEST_INATIVO_*. Também exige o seed aplicado (paciente de
// teste gestor_sus=0000000001).
//
// Sprint 37 — Fase A: uma ÚNICA sessão por perfil é criada no `beforeAll`
// (helpers/supabase-clients.ts) e reutilizada por todos os testes — 4 signIns
// no lugar de 11.

import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/domain/app-error";
import { TIPOS_LIBERACAO, type QuantidadeLiberacao } from "@/lib/domain/enums";
import { LiberacaoService } from "@/lib/services/liberacao-service";
import { LiberacaoRepositoryPostgres } from "@/lib/repositories/liberacao-repository";
import { RetiradaService } from "@/lib/services/retirada-service";
import { RetiradaRepositoryPostgres } from "@/lib/repositories/retirada-repository";
import {
  adminClient,
  clientesPorPerfil,
  credencialPerfilPresente,
  credenciaisPublicasPresentes,
  type ClientesPerfil,
} from "../helpers/supabase-clients";

const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const habilitado = Boolean(
  credenciaisPublicasPresentes() &&
    serviceRole &&
    credencialPerfilPresente("gestor") &&
    credencialPerfilPresente("autorizador") &&
    credencialPerfilPresente("recepcionista") &&
    credencialPerfilPresente("inativo")
);

const GESTOR_SUS_PACIENTE_TESTE = "0000000001";

// Uma sessão por perfil, criada uma única vez para TODO o arquivo.
let autorizador: SupabaseClient;
let recepcionista: SupabaseClient;
let gestor: SupabaseClient;
let inativo: SupabaseClient;

beforeAll(async () => {
  const perfis: (keyof ClientesPerfil)[] = [];
  if (credencialPerfilPresente("autorizador")) perfis.push("autorizador");
  if (credencialPerfilPresente("recepcionista")) perfis.push("recepcionista");
  if (credencialPerfilPresente("gestor")) perfis.push("gestor");
  if (credencialPerfilPresente("inativo")) perfis.push("inativo");
  const clientes = await clientesPorPerfil(perfis);
  autorizador = clientes.autorizador!;
  recepcionista = clientes.recepcionista!;
  gestor = clientes.gestor!;
  inativo = clientes.inativo!;
});

async function usuarioAtualId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.rpc("usuario_atual_id");
  if (error) throw error;
  if (!data) throw new Error("usuario_atual_id retornou nulo — seed não aplicado?");
  return data as string;
}

async function pacienteTeste(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin
    .from("pacientes")
    .select("id")
    .eq("gestor_sus", GESTOR_SUS_PACIENTE_TESTE)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      `Paciente de teste ${GESTOR_SUS_PACIENTE_TESTE} ausente — rode scripts/seed-test-users.mjs --confirm.`
    );
  }
  return data.id as string;
}

// Cria uma liberação ATIVA para o paciente de teste (autorizador ativo).
async function criarLiberacaoTeste(
  autorizadorClient: SupabaseClient,
  autorizadorId: string,
  pacienteId: string,
  quantidade: QuantidadeLiberacao
): Promise<string> {
  const service = new LiberacaoService(new LiberacaoRepositoryPostgres(autorizadorClient));
  const criada = await service.criarLiberacao({
    pacienteId,
    tipo: TIPOS_LIBERACAO.CONTINUA,
    quantidade,
    periodoMeses: 3,
    profissionalAutorizadorId: autorizadorId,
  });
  return criada.id;
}

async function limparRetiradas(admin: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await admin.from("retiradas").delete().in("id", ids);
  if (error) throw error;
}

async function limparLiberacoes(admin: SupabaseClient, ids: string[]) {
  const { error: errFilhas } = await admin
    .from("liberacoes")
    .delete()
    .in("renovacao_de_id", ids);
  if (errFilhas) throw errFilhas;
  const { error: errLib } = await admin.from("liberacoes").delete().in("id", ids);
  if (errLib) throw errLib;
}

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa;
    return null;
  } catch (e) {
    return e;
  }
}

describe.skipIf(!habilitado)("Integração — retiradas (Sprint 20)", () => {
  it("recepcionista ativa registra retirada; identidade e data_hora vêm do banco", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const recepcionistaId = await usuarioAtualId(recepcionista);
    const pacienteId = await pacienteTeste(admin);
    const service = new RetiradaService(new RetiradaRepositoryPostgres(recepcionista));
    let liberacaoId: string | null = null;
    const retiradaIds: string[] = [];

    try {
      liberacaoId = await criarLiberacaoTeste(autorizador, autorizadorId, pacienteId, 4);

      const registrada = await service.registrarRetirada({
        liberacaoId,
        pacienteId,
        quantidade: 2,
      });

      expect(registrada.recepcionista_id).toBe(recepcionistaId);
      expect(registrada.data_hora).toBeTruthy();
      expect(new Date(registrada.data_hora).getTime()).toBeGreaterThan(0);
      expect(registrada.quantidade).toBe(2);
      expect(registrada.paciente_id).toBe(pacienteId);
      retiradaIds.push(registrada.id);

      const { data: logs } = await admin
        .from("auditoria_logs")
        .select("acao, usuario_id")
        .eq("entidade_id", registrada.id)
        .eq("acao", "retirada.registrada");
      expect(logs?.length).toBeGreaterThan(0);
      expect(logs?.[0].usuario_id).toBe(recepcionistaId);
    } finally {
      await limparRetiradas(admin, retiradaIds);
      if (liberacaoId) await limparLiberacoes(admin, [liberacaoId]);
    }
  });

  it("gestor ativo lista retiradas com as FKs embutidas (paciente/liberação/responsável)", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteId = await pacienteTeste(admin);
    const recepService = new RetiradaService(new RetiradaRepositoryPostgres(recepcionista));
    const gestorService = new RetiradaService(new RetiradaRepositoryPostgres(gestor));
    let liberacaoId: string | null = null;
    const retiradaIds: string[] = [];

    try {
      liberacaoId = await criarLiberacaoTeste(autorizador, autorizadorId, pacienteId, 4);

      const registrada = await recepService.registrarRetirada({
        liberacaoId,
        pacienteId,
        quantidade: 1,
      });
      retiradaIds.push(registrada.id);

      const todas = await gestorService.listarRetiradas();
      const alvo = todas.find((r) => r.id === registrada.id);
      expect(alvo).toBeTruthy();
      expect(alvo!.paciente?.nome).toBe("Paciente de Teste — Vale Transporte");
      expect(alvo!.paciente?.gestor_sus).toBe(GESTOR_SUS_PACIENTE_TESTE);
      expect(alvo!.paciente).not.toHaveProperty("cpf");
      expect(JSON.stringify(alvo)).not.toContain("cpf");
      expect(alvo!.liberacao?.id).toBe(liberacaoId);
      expect(alvo!.liberacao?.quantidade).toBe(4);
      expect(alvo!.recepcionista?.nome?.length).toBeGreaterThan(0);

      const porId = await gestorService.buscarRetirada(registrada.id);
      expect(porId?.id).toBe(registrada.id);
    } finally {
      await limparRetiradas(admin, retiradaIds);
      if (liberacaoId) await limparLiberacoes(admin, [liberacaoId]);
    }
  });

  it("recepção não registra além do saldo — o trigger é a autoridade", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteId = await pacienteTeste(admin);
    const service = new RetiradaService(new RetiradaRepositoryPostgres(recepcionista));
    let liberacaoId: string | null = null;
    const retiradaIds: string[] = [];

    try {
      liberacaoId = await criarLiberacaoTeste(autorizador, autorizadorId, pacienteId, 1);

      const registrada = await service.registrarRetirada({
        liberacaoId,
        pacienteId,
        quantidade: 1,
      });
      retiradaIds.push(registrada.id);

      const erro = await erroDe(
        service.registrarRetirada({
          liberacaoId,
          pacienteId,
          quantidade: 1,
        })
      );
      expect(erro).toBeInstanceOf(AppError);
      expect((erro as AppError).code).toBe("SALDO_INSUFICIENTE");
    } finally {
      await limparRetiradas(admin, retiradaIds);
      if (liberacaoId) await limparLiberacoes(admin, [liberacaoId]);
    }
  });

  // Para o gestor alcançar o RLS de INSERT é preciso uma liberação REAL: o
  // trigger fn_retiradas_before (before insert) roda ANTES da checagem RLS
  // (WITH CHECK) e, com uma liberação inexistente, ele próprio levantaria
  // NAO_ENCONTRADO. Com liberação válida o trigger passa e a policy
  // retiradas_insert_recepcao (perfil = recepcionista) é quem rejeita.
  it("gestor ativo NÃO registra retirada (RLS de INSERT)", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteId = await pacienteTeste(admin);
    const service = new RetiradaService(new RetiradaRepositoryPostgres(gestor));
    let liberacaoId: string | null = null;

    try {
      liberacaoId = await criarLiberacaoTeste(autorizador, autorizadorId, pacienteId, 4);

      const erro = await erroDe(
        service.registrarRetirada({
          liberacaoId,
          pacienteId,
          quantidade: 1,
        })
      );

      expect(erro).toBeInstanceOf(AppError);
      expect((erro as AppError).code).toBe("ACESSO_NEGADO");
    } finally {
      if (liberacaoId) await limparLiberacoes(admin, [liberacaoId]);
    }
  });

  // RLS de SELECT filtra silenciosamente (sem erro): autorizador fora de
  // retiradas_select_recepcao_gestor recebe lista vazia.
  it("profissional autorizador NÃO enxerga retiradas (RLS de SELECT)", async () => {
    const service = new RetiradaService(new RetiradaRepositoryPostgres(autorizador));

    const todas = await service.listarRetiradas();

    expect(todas).toEqual([]);
  });

  // Usuário inativo não enxerga nenhuma liberação (RLS de leitura exige
  // usuario_ativo_atual em todas as policies de liberacoes), então o trigger
  // before insert levanta NAO_ENCONTRADO antes de o RLS de INSERT ser avaliado
  // — o bloqueio continua efetivo e não vaza informação (o código é o mesmo
  // para liberação existente ou não).
  it("usuário inativo NÃO registra retirada (bloqueado na leitura da liberação)", async () => {
    const service = new RetiradaService(new RetiradaRepositoryPostgres(inativo));

    const erro = await erroDe(
      service.registrarRetirada({
        liberacaoId: "00000000-0000-0000-0000-000000000000",
        pacienteId: "00000000-0000-0000-0000-000000000000",
        quantidade: 1,
      })
    );

    expect(erro).toBeInstanceOf(AppError);
    expect((erro as AppError).code).toBe("NAO_ENCONTRADO");
  });
});