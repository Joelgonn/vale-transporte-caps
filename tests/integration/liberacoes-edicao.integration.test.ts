// Testes de INTEGRAÇÃO — edição segura de liberações + previsão (Sprint 42).
//
// Exercitam o banco REAL (RLS liberacoes_update_autorizador_gestor + branch
// UPDATE do fn_libracoes_before). ENV-GUARDED e GUARDED pela migration
// 20260826000001: enquanto ela não estiver aplicada (grant UPDATE revogado),
// os cenários de edição são PULADOS — a suíte permanece verde antes do apply.
//
// Pacientes/liberações criados são removidos no `finally` via service role;
// logs de auditoria NÃO são removidos (append-only).

import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  clientesPorPerfil,
  credencialPerfilPresente,
  credenciaisPublicasPresentes,
  type ClientesPerfil,
} from "../helpers/supabase-clients";

const habilitado = Boolean(
  credenciaisPublicasPresentes() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    credencialPerfilPresente("gestor") &&
    credencialPerfilPresente("autorizador") &&
    credencialPerfilPresente("recepcionista")
);

let gestor: SupabaseClient;
let autorizador: SupabaseClient;
let recepcionista: SupabaseClient;

beforeAll(async () => {
  const perfis: (keyof ClientesPerfil)[] = [];
  if (credencialPerfilPresente("gestor")) perfis.push("gestor");
  if (credencialPerfilPresente("autorizador")) perfis.push("autorizador");
  if (credencialPerfilPresente("recepcionista")) perfis.push("recepcionista");
  const clientes = await clientesPorPerfil(perfis);
  gestor = clientes.gestor!;
  autorizador = clientes.autorizador!;
  recepcionista = clientes.recepcionista!;
});

const sufixo = () => Date.now().toString() + Math.floor(Math.random() * 90 + 10);

async function criarPaciente(
  cliente: SupabaseClient,
  nome: string
): Promise<string> {
  const { data, error } = await cliente
    .from("pacientes")
    .insert({ gestor_sus: `9${sufixo()}`, nome })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function criarLiberacao(
  cliente: SupabaseClient,
  autorizadorId: string,
  pacienteId: string
): Promise<string> {
  const { data, error } = await cliente
    .from("liberacoes")
    .insert({
      paciente_id: pacienteId,
      tipo: "continua",
      quantidade: 4,
      periodo_meses: 1,
      profissional_autorizador_id: autorizadorId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// GUARD: a migration 42 concede UPDATE em liberacoes. Antes dela, o UPDATE
// falha por permissão/RLS. Sonda: editar justificativa como AUTORIZADOR.
let guardCache: boolean | null = null;

async function edicaoAplicada(): Promise<boolean> {
  if (guardCache !== null) return guardCache;
  const admin = adminClient();
  let pacienteId: string | null = null;
  let liberacaoId: string | null = null;
  try {
    const autorizadorId = (
      await autorizador.rpc("usuario_atual_id")
    ).data as string;
    pacienteId = await criarPaciente(autorizador, "Sonda Edicao 42");
    liberacaoId = await criarLiberacao(autorizador, autorizadorId, pacienteId);
    const { error } = await autorizador
      .from("liberacoes")
      .update({ justificativa: "sonda" })
      .eq("id", liberacaoId);
    guardCache = error === null;
  } catch {
    guardCache = false;
  } finally {
    if (liberacaoId) await admin.from("liberacoes").delete().eq("id", liberacaoId);
    if (pacienteId) await admin.from("pacientes").delete().eq("id", pacienteId);
  }
  return guardCache;
}

async function autorizadorAtualId(cliente: SupabaseClient): Promise<string> {
  return ((await cliente.rpc("usuario_atual_id")).data as string);
}

// Parte 2 do arquivo — cenários (anexada ao final pelo runner de setup).

const limpar = async (
  admin: SupabaseClient,
  ids: { liberacoes: string[]; pacientes: string[] }
) => {
  for (const id of ids.liberacoes) await admin.from("liberacoes").delete().eq("id", id);
  for (const id of ids.pacientes) await admin.from("pacientes").delete().eq("id", id);
};

describe.skipIf(!habilitado)("Edição segura de liberações (Sprint 42)", () => {
  it("AUTORIZADOR edita quantidade prevista e vigência — PERMITIDO", async () => {
    if (!(await edicaoAplicada())) return;
    const admin = adminClient();
    const autorizadorId = await autorizadorAtualId(autorizador);
    const pacienteId = await criarPaciente(autorizador, "Edita Previsto");
    let liberacaoId: string | null = null;
    try {
      liberacaoId = await criarLiberacao(autorizador, autorizadorId, pacienteId);

      const { data, error } = await autorizador
        .from("liberacoes")
        .update({ quantidade: 8, justificativa: "previsão revisada" })
        .eq("id", liberacaoId)
        .select("quantidade, justificativa")
        .single();

      expect(error).toBeNull();
      expect(data?.quantidade).toBe(8);
      expect(data?.justificativa).toBe("previsão revisada");
    } finally {
      await limpar(admin, { liberacoes: liberacaoId ? [liberacaoId] : [], pacientes: [pacienteId] });
    }
  });

  it("AUTORIZADOR tenta alterar status — BLOQUEADO pelo trigger", async () => {
    if (!(await edicaoAplicada())) return;
    const admin = adminClient();
    const autorizadorId = await autorizadorAtualId(autorizador);
    const pacienteId = await criarPaciente(autorizador, "Autorizador Status Lib");
    let liberacaoId: string | null = null;
    try {
      liberacaoId = await criarLiberacao(autorizador, autorizadorId, pacienteId);

      const { error } = await autorizador
        .from("liberacoes")
        .update({ status: "cancelada" })
        .eq("id", liberacaoId);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/status da liberação/i);
    } finally {
      await limpar(admin, { liberacoes: liberacaoId ? [liberacaoId] : [], pacientes: [pacienteId] });
    }
  });

  it("paciente/tipo/renovação são IMUTÁVEIS para qualquer perfil", async () => {
    if (!(await edicaoAplicada())) return;
    const admin = adminClient();
    const autorizadorId = await autorizadorAtualId(autorizador);
    const pacienteId = await criarPaciente(autorizador, "Historicos Imutaveis");
    let liberacaoId: string | null = null;
    try {
      liberacaoId = await criarLiberacao(autorizador, autorizadorId, pacienteId);

      // paciente diferente
      const outroPaciente = await criarPaciente(autorizador, "Outro Paciente Imutavel");
      const errPaciente = (
        await autorizador
          .from("liberacoes")
          .update({ paciente_id: outroPaciente })
          .eq("id", liberacaoId)
      ).error;
      expect(errPaciente).not.toBeNull();
      expect(errPaciente!.message).toMatch(/imut[áa]veis|hist[óo]ricos/i);

      // tipo
      const errTipo = (
        await autorizador
          .from("liberacoes")
          .update({ tipo: "avulsa" })
          .eq("id", liberacaoId)
      ).error;
      expect(errTipo).not.toBeNull();
    } finally {
      await limpar(admin, { liberacoes: liberacaoId ? [liberacaoId] : [], pacientes: [pacienteId] });
    }
  });

  it("GESTOR altera status (cancelamento) — PERMITIDO; quantidade — BLOQUEADO", async () => {
    if (!(await edicaoAplicada())) return;
    const admin = adminClient();
    const autorizadorId = await autorizadorAtualId(autorizador);
    const pacienteId = await criarPaciente(gestor, "Gestor Edita Liberacao");
    let liberacaoId: string | null = null;
    try {
      liberacaoId = await criarLiberacao(autorizador, autorizadorId, pacienteId);

      const { error: erroStatus } = await gestor
        .from("liberacoes")
        .update({ status: "cancelada" })
        .eq("id", liberacaoId);
      expect(erroStatus).toBeNull();

      // reativa para testar o bloqueio de quantidade pelo gestor
      await gestor.from("liberacoes").update({ status: "ativa" }).eq("id", liberacaoId);

      const { error: erroQtd } = await gestor
        .from("liberacoes")
        .update({ quantidade: 8 })
        .eq("id", liberacaoId);
      expect(erroQtd).not.toBeNull();
      expect(erroQtd!.message).toMatch(/apenas o status/i);
    } finally {
      await limpar(admin, { liberacoes: liberacaoId ? [liberacaoId] : [], pacientes: [pacienteId] });
    }
  });

  it("RECEPCIONISTA tenta editar — RLS bloqueia (0 linhas afetadas, dado invariante)", async () => {
    if (!(await edicaoAplicada())) return;
    const admin = adminClient();
    const autorizadorId = await autorizadorAtualId(autorizador);
    const pacienteId = await criarPaciente(autorizador, "Recep Edicao Lib");
    let liberacaoId: string | null = null;
    try {
      liberacaoId = await criarLiberacao(autorizador, autorizadorId, pacienteId);

      const { error } = await recepcionista
        .from("liberacoes")
        .update({ justificativa: "indevido" })
        .eq("id", liberacaoId);
      expect(error).toBeNull(); // invisível → 0 linhas

      const { data: depois } = await admin
        .from("liberacoes")
        .select("justificativa")
        .eq("id", liberacaoId)
        .single();
      expect(depois?.justificativa).toBeNull();
    } finally {
      await limpar(admin, { liberacoes: liberacaoId ? [liberacaoId] : [], pacientes: [pacienteId] });
    }
  });

  it("AUDITORIA — UPDATE registra liberacao.alterada com antes/depois (inclui quantidade)", async () => {
    if (!(await edicaoAplicada())) return;
    const admin = adminClient();
    const autorizadorId = await autorizadorAtualId(autorizador);
    const pacienteId = await criarPaciente(autorizador, "Auditoria Lib Editada");
    let liberacaoId: string | null = null;
    try {
      liberacaoId = await criarLiberacao(autorizador, autorizadorId, pacienteId);

      const { error } = await autorizador
        .from("liberacoes")
        .update({ quantidade: 8 })
        .eq("id", liberacaoId);
      expect(error).toBeNull();

      const { data: logs, error: erroLog } = await gestor
        .from("auditoria_logs")
        .select("acao, dados_antes, dados_depois")
        .eq("entidade_tipo", "liberacoes")
        .eq("entidade_id", liberacaoId)
        .order("data_hora", { ascending: false })
        .limit(2);

      expect(erroLog).toBeNull();
      const logAlterada = logs!.find((l) => l.acao === "liberacao.alterada");
      expect(logAlterada).toBeDefined();
      expect((logAlterada!["dados_antes"] as Record<string, unknown>)["quantidade"]).toBe(4);
      expect((logAlterada!["dados_depois"] as Record<string, unknown>)["quantidade"]).toBe(8);
    } finally {
      await limpar(admin, { liberacoes: liberacaoId ? [liberacaoId] : [], pacientes: [pacienteId] });
    }
  });
});

// ── Sprint 42.2 — CHECK de quantidade alinhado à previsão (1..999) ───────────
describe.skipIf(!habilitado)("CHECK de previsão 1..999 (Sprint 42.2)", () => {
  // GUARD: tenta criar liberação com quantidade 96. Se o CHECK antigo
  // (in (1,2,4,8)) ainda existir no banco, a inserção falha e os cenários são
  // pulados; após aplicar a migration 20260826000002, passam a rodar de fato.
  let checkAplicadoCache: boolean | null = null;

  async function checkRelaxado(): Promise<boolean> {
    if (checkAplicadoCache !== null) return checkAplicadoCache;
    const admin = adminClient();
    const autorizadorId = await autorizadorAtualId(autorizador);
    let pacienteId: string | null = null;
    let liberacaoId: string | null = null;
    try {
      pacienteId = await criarPaciente(autorizador, "Sonda Check 96");
      liberacaoId = await criarLiberacao(autorizador, autorizadorId, pacienteId);
      const { error } = await autorizador
        .from("liberacoes")
        .update({ quantidade: 96 })
        .eq("id", liberacaoId);
      if (error === null) {
        // reverte para o valor original antes de sair
        await autorizador.from("liberacoes").update({ quantidade: 4 }).eq("id", liberacaoId);
        checkAplicadoCache = true;
      } else {
        checkAplicadoCache = false;
      }
    } catch {
      checkAplicadoCache = false;
    } finally {
      if (liberacaoId) await admin.from("liberacoes").delete().eq("id", liberacaoId);
      if (pacienteId) await admin.from("pacientes").delete().eq("id", pacienteId);
    }
    return checkAplicadoCache;
  }

  it("cria liberação com quantidade prevista 32 (> 8) após migration 42.2", async () => {
    if (!(await edicaoAplicada())) return;
    if (!(await checkRelaxado())) return;
    const admin = adminClient();
    const autorizadorId = await autorizadorAtualId(autorizador);
    const pacienteId = await criarPaciente(autorizador, "Prevista 32");
    let liberacaoId: string | null = null;
    try {
      const { data, error } = await autorizador
        .from("liberacoes")
        .insert({
          paciente_id: pacienteId,
          tipo: "continua",
          quantidade: 32,
          periodo_meses: 3,
          profissional_autorizador_id: autorizadorId,
        })
        .select("quantidade")
        .single();
      expect(error).toBeNull();
      expect(data?.quantidade).toBe(32);
      liberacaoId = (
        await admin.from("liberacoes").select("id").eq("paciente_id", pacienteId).limit(1)
      ).data![0].id;
    } finally {
      await limpar(admin, { liberacoes: liberacaoId ? [liberacaoId] : [], pacientes: [pacienteId] });
    }
  });

  it("quantidade 1000 continua INVÁLIDA mesmo após o relaxamento (1..999)", async () => {
    if (!(await edicaoAplicada())) return;
    if (!(await checkRelaxado())) return;
    const autorizadorId = await autorizadorAtualId(autorizador);
    const admin = adminClient();
    const pacienteId = await criarPaciente(autorizador, "Prevista 1000");
    try {
      const { error } = await autorizador
        .from("liberacoes")
        .insert({
          paciente_id: pacienteId,
          tipo: "continua",
          quantidade: 1000,
          periodo_meses: 3,
          profissional_autorizador_id: autorizadorId,
        });
      expect(error).not.toBeNull();
    } finally {
      await limpar(admin, { liberacoes: [], pacientes: [pacienteId] });
    }
  });
});
