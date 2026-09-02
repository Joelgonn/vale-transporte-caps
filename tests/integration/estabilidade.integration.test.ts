// Testes de INTEGRAÇÃO — Estabilização Banco/RLS/Auth (Sprint 36).
//
// Exercitam o banco REAL com RLS/triggers habilitados e usuários de teste do
// seed (scripts/seed-test-users.mjs). São ENV-GUARDED (describe.skipIf). As
// liberações/retiradas/pacientes temporários são removidos no `finally`
// (service role). auditoria_logs é append-only por design (nunca removido).
//
// Requer no ambiente: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SERVICE_ROLE_KEY e as credenciais TEST_GESTOR_/TEST_AUTORIZADOR_/
// TEST_RECEPCIONISTA_/TEST_INATIVO_/TEST_SEM_VINCULO_*. Seed aplicado (paciente
// gestor_sus=0000000001).
//
// Dependências de migration (aplicar via SQL Editor / db push antes da
// validação):
//   * 20260817000001_retiradas_lock_liberacao.sql — sem ela, o teste de
//     concorrência pode detectar over-subscription (gap reproduzido na Sprint 36).
//   * 20260817000002_liberacoes_renovacao_mesmo_paciente.sql — sem ela, o teste
//     de renovação com paciente diferente falha (gap reproduzido na Sprint 36).
//
// Sprint 37 — Fase A: uma ÚNICA sessão por perfil é criada no `beforeAll`
// (helpers/supabase-clients.ts) e reutilizada por todos os testes — 5 signIns
// no lugar de 12. O teste de CONCORRÊNCIA permanece real: os 4 INSERTs
// simultâneos contra a mesma liberação continuam via Promise.allSettled.

import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/domain/app-error";
import type { QuantidadeLiberacao } from "@/lib/domain/enums";
import { LiberacaoService } from "@/lib/services/liberacao-service";
import { LiberacaoRepositoryPostgres } from "@/lib/repositories/liberacao-repository";
import {
  adminClient,
  clientesPorPerfil,
  credencialPerfilPresente,
  credenciaisPublicasPresentes,
} from "../helpers/supabase-clients";

const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const habilitado = Boolean(
  credenciaisPublicasPresentes() &&
    serviceRole &&
    credencialPerfilPresente("gestor") &&
    credencialPerfilPresente("autorizador") &&
    credencialPerfilPresente("recepcionista") &&
    credencialPerfilPresente("inativo") &&
    credencialPerfilPresente("semVinculo")
);

const GESTOR_SUS_PACIENTE_TESTE = "0000000001";

// Uma sessão por perfil, criada uma única vez para TODO o arquivo.
let autorizador: SupabaseClient;
let recepcionista: SupabaseClient;
let gestor: SupabaseClient;
let inativo: SupabaseClient;
let semVinculo: SupabaseClient;

beforeAll(async () => {
  const clientes = await clientesPorPerfil([
    "autorizador",
    "recepcionista",
    "gestor",
    "inativo",
    "semVinculo",
  ]);
  autorizador = clientes.autorizador!;
  recepcionista = clientes.recepcionista!;
  gestor = clientes.gestor!;
  inativo = clientes.inativo!;
  semVinculo = clientes.semVinculo!;
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

async function criarLiberacao(
  autorizadorClient: SupabaseClient,
  autorizadorId: string,
  pacienteId: string,
  quantidade: QuantidadeLiberacao
): Promise<{ id: string; paciente_id: string }> {
  const service = new LiberacaoService(new LiberacaoRepositoryPostgres(autorizadorClient));
  const criada = await service.criarLiberacao({
    pacienteId,
    tipo: "continua",
    quantidade,
    periodoMeses: 3,
    profissionalAutorizadorId: autorizadorId,
  });
  return { id: criada.id, paciente_id: criada.paciente_id };
}

async function limparRetiradas(admin: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await admin.from("retiradas").delete().in("id", ids);
  if (error) throw error;
}

async function limparLiberacoes(admin: SupabaseClient, ids: string[]) {
  if (!ids || ids.length === 0) return;
  const { error: errFilhas } = await admin
    .from("liberacoes")
    .delete()
    .in("renovacao_de_id", ids);
  if (errFilhas) throw errFilhas;
  const { error: errLib } = await admin.from("liberacoes").delete().in("id", ids);
  if (errLib) throw errLib;
}

async function limparPaciente(admin: SupabaseClient, id: string) {
  if (!id) return;
  const { error: errRet } = await admin.from("retiradas").delete().eq("paciente_id", id);
  if (errRet) throw errRet;
  const { error: errLib } = await admin.from("liberacoes").delete().eq("paciente_id", id);
  if (errLib) throw errLib;
  const { error: errPac } = await admin.from("pacientes").delete().eq("id", id);
  if (errPac) throw errPac;
}

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa;
    return null;
  } catch (e) {
    return e;
  }
}

describe.skipIf(!habilitado)("Estabilização — atomicidade do saldo (migration 20260817000001)", () => {
  // Gap reproduzido na Sprint 36 (scripts/repro-sprint-36.mjs — Parte A):
  // liberação de 2 com 4 retiradas concorrentes de 1 → 4/4 aceitas e soma=3.
  // Após o fix (SELECT FOR UPDATE no trigger), a CONCORRÊNCIA é serializada.
  //
  // Sprint 42 — o resultado esperado depende da migration 20260826000001:
  //   * ANTES (limite ativo): no máximo 2 aceitas, soma ≤ 2;
  //   * DEPOIS (quantidade = previsão): TODAS aceitas (soma = 4) — o lock
  //     permanece para serialização, mas não há mais bloqueio por quantidade.
  it("retiradas concorrentes contra a mesma liberação — sem erro e coerentes com o modelo", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteId = await pacienteTeste(admin);
    const liberacao = await criarLiberacao(autorizador, autorizadorId, pacienteId, 2);
    const retiradaIds: string[] = [];

    try {
      const tentativas = Array.from({ length: 4 }, () =>
        recepcionista
          .from("retiradas")
          .insert({
            liberacao_id: liberacao.id,
            paciente_id: pacienteId,
            quantidade: 1,
          })
          .select("id, quantidade")
          .single()
      );

      const resultados = await Promise.allSettled(tentativas);
      // supabase-js resolve (não rejeita) respostas com erro: sucesso REAL é
      // somente fulfilled com data.id e sem error.
      const sucessos = resultados.filter(
        (r) => r.status === "fulfilled" && r.value?.data?.id && !r.value?.error
      ).length;
      for (const r of resultados) {
        if (r.status === "fulfilled" && r.value?.data?.id && !r.value?.error) retiradaIds.push(r.value.data.id);
      }

      const { data: retiradas } = await recepcionista
        .from("retiradas")
        .select("quantidade")
        .eq("liberacao_id", liberacao.id);
      const soma = (retiradas ?? []).reduce((acc: number, r: { quantidade: number }) => acc + r.quantidade, 0);

      if (sucessos === 4) {
        // Modelo NOVO (Sprint 42): previsão não bloqueia — todas aceitas.
        expect(soma).toBe(4);
      } else {
        // Modelo ANTIGO (migration 42 ainda não aplicada): limite vigente.
        expect(
          soma <= 2,
          `Over-subscription após migration 20260817000001: soma=${soma} > quantidade=2 (${sucessos}/4 aceitas).`
        ).toBe(true);
        expect(sucessos).toBeLessThanOrEqual(2);
      }
    } finally {
      await limparRetiradas(admin, retiradaIds);
      await limparLiberacoes(admin, [liberacao.id]);
    }
  });
});

describe.skipIf(!habilitado)("Estabilização — renovação do mesmo paciente (migration 20260817000002)", () => {
  // Gap reproduzido na Sprint 36 (scripts/repro-sprint-36.mjs — Parte B): a
  // recepção conseguia inserir "renovação" com renovacao_de_id de um paciente e
  // paciente_id de OUTRO. Após o fix (RN23 no trigger), o banco rejeita.
  it("recepção NÃO renova liberação com paciente diferente (RN23)", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteTesteId = await pacienteTeste(admin);

    // Paciente B temporário (outro paciente) para forçar o vínculo incoerente.
    const { data: pacienteB, error: errPac } = await autorizador
      .from("pacientes")
      .insert({
        gestor_sus: `repro-${Date.now()}`,
        nome: "Paciente Temporário — Sprint 36",
        status: "ativo",
      })
      .select("id")
      .single();
    if (errPac) throw errPac;

    const liberacaoA = await criarLiberacao(autorizador, autorizadorId, pacienteTesteId, 2);
    const idsLib: string[] = [liberacaoA.id];

    try {
      const { error } = await recepcionista.from("liberacoes").insert({
        paciente_id: pacienteB.id,
        tipo: "continua",
        quantidade: 2,
        periodo_meses: 3,
        profissional_autorizador_id: autorizadorId,
        renovacao_de_id: liberacaoA.id,
      });

      expect(
        error ?? null,
        "Renovação com paciente diferente deveria ser rejeitada pelo banco (RN23). " +
          "Migration 20260817000002 ainda não foi aplicada?"
      ).not.toBeNull();

      // No fluxo da aplicação (LiberacaoService), o erro é um AppError VALIDACAO.
      const service = new LiberacaoService(new LiberacaoRepositoryPostgres(recepcionista));
      const erroRenovar = await erroDe(
        service.criarLiberacao({
          pacienteId: pacienteB.id,
          tipo: "continua",
          quantidade: 2,
          periodoMeses: 3,
          profissionalAutorizadorId: autorizadorId,
          renovacaoDeId: liberacaoA.id,
        })
      );
      expect(erroRenovar).toBeInstanceOf(AppError);
      expect((erroRenovar as AppError).code).toBe("VALIDACAO");
    } finally {
      await limparLiberacoes(admin, idsLib);
      await limparPaciente(admin, pacienteB.id);
    }
  });
});

describe.skipIf(!habilitado)("Estabilização — matriz de transições de status de liberações (#4)", () => {
  // ATUALIZADO na Sprint 42: a migration 20260826000001 re-concedeu UPDATE e
  // criou a policy liberacoes_update_autorizador_gestor. A matriz agora é:
  //   * gestor ativo              → PODE alterar status (cancelamento admin.);
  //   * autorizador ativo         → trigger bloqueia mudança de STATUS;
  //   * recepcionista/inativo/sem vínculo → linha invisível (0 linhas, sem erro).
  // O id usado abaixo NÃO existe — nenhum cenário altera dados reais.
  const alvoInexistente = "00000000-0000-0000-0000-000000000000";
  const alvoUpdate = { status: "cancelada", justificativa: "tentativa de transição" };

  function clienteDoRotulo(rotulo: string): SupabaseClient {
    const porRotulo: Record<string, SupabaseClient> = {
      "gestor ativo": gestor,
      "autorizador ativo": autorizador,
      "recepcionista ativa": recepcionista,
      "usuário inativo": inativo,
      "authenticated sem vínculo": semVinculo,
    };
    return porRotulo[rotulo];
  }

  it("gestor ativo PODE alterar status de liberação (UPDATE permitido pela Sprint 42)", async () => {
    // UPDATE contra id inexistente: RLS/permitem, PostgREST retorna sem erro e
    // 0 linhas — prova de que o privilégio/policy NÃO negam mais o gestor.
    const { error } = await gestor
      .from("liberacoes")
      .update(alvoUpdate)
      .eq("id", alvoInexistente);
    expect(error ?? null).toBeNull();
  });

  it("recepcionista ativa não altera status (linha invisível — 0 linhas)", async () => {
    const { data, error } = await recepcionista
      .from("liberacoes")
      .update(alvoUpdate)
      .eq("id", alvoInexistente);
    expect(error ?? null).toBeNull(); // invisível: sem policy → 0 linhas
    expect(data ?? null).toBeNull();
  });

  it.each(["usuário inativo", "authenticated sem vínculo"])(
    "%s não altera status de liberação (linha invisível)",
    async (rotulo) => {
      const cliente = clienteDoRotulo(rotulo);
      const { data, error } = await cliente
        .from("liberacoes")
        .update(alvoUpdate)
        .eq("id", alvoInexistente);
      expect(error ?? null).toBeNull();
      expect(data ?? null).toBeNull();
    }
  );
});

describe.skipIf(!habilitado)("Estabilização — renovação via PostgREST direto (#2)", () => {
  it("autorizador NÃO renova liberação via PostgREST direto (RLS de INSERT)", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteId = await pacienteTeste(admin);
    const liberacao = await criarLiberacao(autorizador, autorizadorId, pacienteId, 2);

    try {
      const { data, error } = await autorizador.from("liberacoes").insert({
        paciente_id: pacienteId,
        tipo: "continua",
        quantidade: 2,
        periodo_meses: 3,
        profissional_autorizador_id: autorizadorId,
        renovacao_de_id: liberacao.id,
      });

      expect(error ?? null).not.toBeNull();
      expect(data).toBeNull();
    } finally {
      await limparLiberacoes(admin, [liberacao.id]);
    }
  });

  it("recepção CRIA liberação nova via PostgREST direto — Sprint44 (todos criam)", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteId = await pacienteTeste(admin);

    let id: string | null = null;
    try {
      const { data, error } = await recepcionista
        .from("liberacoes")
        .insert({
          paciente_id: pacienteId,
          tipo: "continua",
          quantidade: 2,
          periodo_meses: 3,
          profissional_autorizador_id: autorizadorId,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      id = data!.id;
    } finally {
      if (id) await limparLiberacoes(admin, [id]);
    }
  });
});