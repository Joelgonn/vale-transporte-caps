// Testes de INTEGRAÇÃO — fluxo real de liberações (Sprints 18/19).
//
// Exercitam o banco REAL com RLS/triggers habilitados, usando os mesmos
// componentes de produção (LiberacaoService + LiberacaoRepositoryPostgres) e os
// usuários de teste do seed (scripts/seed-test-users.mjs). São ENV-GUARDED
// (describe.skipIf) e NUNCA acumulam liberações: as criadas são removidas no
// `finally` (service role), apagando renovações antes das originais. Os logs de
// auditoria NÃO são removidos — auditoria_logs é append-only por design.
//
// Requer no ambiente: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SERVICE_ROLE_KEY e as credenciais TEST_GESTOR_/TEST_AUTORIZADOR_/
// TEST_RECEPCIONISTA_/TEST_INATIVO_*. Também exige o seed aplicado (paciente de
// teste gestor_sus=0000000001), a migration 20 (fix do fn_auditoria) e a
// migration 20260813000002 (RLS: renovação somente pela recepção no banco).
//
// Sprint 37 — Fase A: uma ÚNICA sessão por perfil é criada no `beforeAll`
// (helpers/supabase-clients.ts) e reutilizada por todos os testes — 4 signIns
// no lugar de 11.

import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/domain/app-error";
import { TIPOS_LIBERACAO } from "@/lib/domain/enums";
import type { NovaLiberacao } from "@/lib/domain/liberacoes/types";
import { LiberacaoService } from "@/lib/services/liberacao-service";
import { LiberacaoRepositoryPostgres } from "@/lib/repositories/liberacao-repository";
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

// public.usuario_atual_id() — a mesma infraestrutura usada em produção para
// resolver o profissional autorizador a partir da sessão.
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

async function limparLiberacoes(admin: SupabaseClient, ids: string[]) {
  // Ordem importa: renovacao_de_id tem FK para liberacoes(id) — apaga as
  // renovações (filhas) antes das originais. auditoria_logs é append-only
  // (fn_auditoria_imutavel bloqueia update/delete mesmo para service role) e os
  // logs gerados ficam como registro permanente do teste — comportamento
  // intencional do sistema.
  const { error: errFilhas } = await admin
    .from("liberacoes")
    .delete()
    .in("renovacao_de_id", ids);
  if (errFilhas) throw errFilhas;
  const { error: errLib } = await admin.from("liberacoes").delete().in("id", ids);
  if (errLib) throw errLib;
}

async function erroDe(
  promessa: Promise<unknown>
): Promise<unknown> {
  try {
    await promessa;
    return null;
  } catch (e) {
    return e;
  }
}

describe.skipIf(!habilitado)("Integração — liberações (Sprints 18/19)", () => {
  it("autorizador ativo cria liberação contínua; identidade e auditoria vêm do banco", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteId = await pacienteTeste(admin);
    const service = new LiberacaoService(new LiberacaoRepositoryPostgres(autorizador));
    let criadaId: string | null = null;

    try {
      const criada = await service.criarLiberacao({
        pacienteId,
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 4,
        periodoMeses: 3,
        profissionalAutorizadorId: autorizadorId,
      });
      criadaId = criada.id;

      expect(criada.status).toBe("ativa");
      expect(criada.registrado_por_id).toBe(autorizadorId);
      expect(criada.profissional_autorizador_id).toBe(autorizadorId);
      expect(criada.periodo_meses).toBe(3);
      expect(criada.renovacao_de_id).toBeNull();
      expect(new Date(criada.data_fim).getTime()).toBeGreaterThan(
        new Date(criada.data_inicio).getTime()
      );
      expect(criada.paciente?.nome).toBe("Paciente de Teste — Vale Transporte");
      expect(criada.paciente?.gestor_sus).toBe(GESTOR_SUS_PACIENTE_TESTE);
      expect(criada.paciente).not.toHaveProperty("cpf");
      expect(JSON.stringify(criada)).not.toContain("cpf");

      const { data: logs } = await admin
        .from("auditoria_logs")
        .select("acao, usuario_id")
        .eq("entidade_id", criada.id)
        .eq("acao", "liberacao.criada");
      expect(logs?.length).toBeGreaterThan(0);
      expect(logs?.[0].usuario_id).toBe(autorizadorId);
    } finally {
      if (criadaId) await limparLiberacoes(admin, [criadaId]);
    }
  });

  it("recepcionista ativa renova liberação ativa mantendo autorizador e parâmetros", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const recepcionistaId = await usuarioAtualId(recepcionista);
    const pacienteId = await pacienteTeste(admin);
    const autorizadorService = new LiberacaoService(
      new LiberacaoRepositoryPostgres(autorizador)
    );
    const ids: string[] = [];

    try {
      const original = await autorizadorService.criarLiberacao({
        pacienteId,
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 2,
        periodoMeses: 6,
        profissionalAutorizadorId: autorizadorId,
      });
      ids.push(original.id);

      const recepcionistaService = new LiberacaoService(
        new LiberacaoRepositoryPostgres(recepcionista)
      );
      const renovada = await recepcionistaService.criarLiberacao({
        pacienteId: original.paciente_id,
        tipo: original.tipo,
        quantidade: original.quantidade,
        periodoMeses: original.periodo_meses,
        profissionalAutorizadorId: original.profissional_autorizador_id,
        renovacaoDeId: original.id,
      });
      ids.push(renovada.id);

      expect(renovada.renovacao_de_id).toBe(original.id);
      expect(renovada.profissional_autorizador_id).toBe(original.profissional_autorizador_id);
      expect(renovada.paciente_id).toBe(original.paciente_id);
      expect(renovada.tipo).toBe(original.tipo);
      expect(renovada.quantidade).toBe(original.quantidade);
      expect(renovada.periodo_meses).toBe(original.periodo_meses);
      expect(renovada.status).toBe("ativa");
      expect(renovada.registrado_por_id).toBe(recepcionistaId);

      const { data: logs } = await admin
        .from("auditoria_logs")
        .select("acao")
        .eq("entidade_id", renovada.id)
        .eq("acao", "liberacao.renovada");
      expect(logs?.length).toBeGreaterThan(0);
    } finally {
      if (ids.length) await limparLiberacoes(admin, ids);
    }
  });

  it("gestor ativo lista e busca as liberações (todas)", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteId = await pacienteTeste(admin);
    const autorizadorService = new LiberacaoService(
      new LiberacaoRepositoryPostgres(autorizador)
    );
    const ids: string[] = [];

    try {
      const criada = await autorizadorService.criarLiberacao({
        pacienteId,
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 1,
        periodoMeses: 3,
        profissionalAutorizadorId: autorizadorId,
      });
      ids.push(criada.id);

      const gestorService = new LiberacaoService(new LiberacaoRepositoryPostgres(gestor));
      const todas = await gestorService.listarLiberacoes();
      expect(todas.some((l) => l.id === criada.id)).toBe(true);

      const porBusca = await gestorService.listarLiberacoes("Paciente de Teste");
      expect(porBusca.some((l) => l.id === criada.id)).toBe(true);

      const porId = await gestorService.buscarLiberacao(criada.id);
      expect(porId?.id).toBe(criada.id);
    } finally {
      if (ids.length) await limparLiberacoes(admin, ids);
    }
  });

  it("recepcionista ativa só enxerga liberações ativas (RLS)", async () => {
    const service = new LiberacaoService(new LiberacaoRepositoryPostgres(recepcionista));

    const lista = await service.listarLiberacoes();
    expect(Array.isArray(lista)).toBe(true);
    for (const liberacao of lista) {
      expect(liberacao.status).toBe("ativa");
    }
  });

  // A RLS liberacoes_insert_autorizador NÃO habilita INSERT da recepção (só a
  // policy liberacoes_insert_recepcao_renovacao, que exige renovacao_de_id).
  // Este teste valida o que a RLS DE FATO impõe: a recepção NÃO cria liberação nova.
  it("recepção NÃO cria liberação nova (RLS de INSERT)", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteId = await pacienteTeste(admin);
    const recepcionistaService = new LiberacaoService(
      new LiberacaoRepositoryPostgres(recepcionista)
    );

    const novaPelaRecepcao: NovaLiberacao = {
      pacienteId,
      tipo: TIPOS_LIBERACAO.CONTINUA,
      quantidade: 1,
      periodoMeses: 3,
      profissionalAutorizadorId: autorizadorId,
    };
    const erroCriar = await erroDe(
      recepcionistaService.criarLiberacao(novaPelaRecepcao)
    );
    expect(erroCriar).toBeInstanceOf(AppError);
    expect((erroCriar as AppError).code).toBe("ACESSO_NEGADO");
  });

  // Migration 20260813000002 (aplicada): a policy liberacoes_insert_autorizador
  // agora exige `renovacao_de_id is null` — o banco fecha o gap da Sprint 18 e
  // a renovação passa a viver 100% na RLS, além da action. Este teste prova o
  // bloqueio real: o autorizador NÃO consegue renovar (INSERT com renovacao_de_id).
  it("autorizador NÃO renova liberação (RLS de INSERT — migration 20260813000002)", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteId = await pacienteTeste(admin);
    const autorizadorService = new LiberacaoService(
      new LiberacaoRepositoryPostgres(autorizador)
    );
    let originalId: string | null = null;

    try {
      const original = await autorizadorService.criarLiberacao({
        pacienteId,
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 2,
        periodoMeses: 3,
        profissionalAutorizadorId: autorizadorId,
      });
      originalId = original.id;

      const erroRenovar = await erroDe(
        autorizadorService.criarLiberacao({
          pacienteId: original.paciente_id,
          tipo: original.tipo,
          quantidade: original.quantidade,
          periodoMeses: original.periodo_meses,
          profissionalAutorizadorId: original.profissional_autorizador_id,
          renovacaoDeId: original.id,
        })
      );

      expect(erroRenovar).toBeInstanceOf(AppError);
      expect((erroRenovar as AppError).code).toBe("ACESSO_NEGADO");
    } finally {
      if (originalId) await limparLiberacoes(admin, [originalId]);
    }
  });

  it("usuário inativo NÃO cria liberação (RLS)", async () => {
    const admin = adminClient();
    const autorizadorId = await usuarioAtualId(autorizador);
    const pacienteId = await pacienteTeste(admin);
    const inativoService = new LiberacaoService(
      new LiberacaoRepositoryPostgres(inativo)
    );

    const erro = await erroDe(
      inativoService.criarLiberacao({
        pacienteId,
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 1,
        periodoMeses: 3,
        profissionalAutorizadorId: autorizadorId,
      })
    );

    expect(erro).toBeInstanceOf(AppError);
    expect((erro as AppError).code).toBe("ACESSO_NEGADO");
  });
});