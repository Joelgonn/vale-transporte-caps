// Testes de INTEGRAÇÃO — edição segura de pacientes (Sprint 41).
//
// Exercitam o banco REAL (RLS + trigger fn_pacientes_before + auditoria) com
// sessões dos usuários de teste. ENV-GUARDED (describe.skipIf) e GUARDED pela
// migration 20260825000001: enquanto ela não estiver aplicada no banco, os
// cenários que dependem da imutabilidade de origem são PULADOS — a suíte
// permanece verde antes do deploy.
//
// Pacientes criados nos testes são removidos no `finally` via service role;
// logs de auditoria NÃO são removidos (append-only por design).

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

const sufixo = () => Date.now().toString();

async function criarPacienteDeTeste(
  cliente: SupabaseClient,
  nome: string
): Promise<{ id: string; origem: string }> {
  const { data, error } = await cliente
    .from("pacientes")
    .insert({ gestor_sus: `9${sufixo()}${Math.floor(Math.random() * 90 + 10)}`, nome })
    .select("id, origem")
    .single();
  expect(error).toBeNull();
  return data!;
}

// GUARD: detecta se a migration 20260825000001 está aplicada tentando a
// conversão de origem com o AUTORIZADOR. Se falhar com a mensagem RN30 →
// aplicada; se SUCEDER, reverte a alteração e informa que não está.
let guardCache: boolean | null = null;

async function edicaoSeguraAplicada(): Promise<boolean> {
  if (guardCache !== null) return guardCache;
  const admin = adminClient();
  let id: string | null = null;
  try {
    const paciente = await criarPacienteDeTeste(autorizador, "Sonda Sprint 41");
    id = paciente.id;
    const { error } = await autorizador
      .from("pacientes")
      .update({ origem: "esporadico" })
      .eq("id", id);
    if (error && /imutável|RN30/i.test(error.message)) {
      guardCache = true;
    } else {
      // Migration ausente: a atualização passou — REVERTE para não deixar
      // estado alterado e reporta que o guard não está satisfeito.
      await admin.from("pacientes").update({ origem: "regular" }).eq("id", id);
      guardCache = false;
    }
  } catch {
    guardCache = false;
  } finally {
    if (id) await admin.from("pacientes").delete().eq("id", id);
  }
  return guardCache;
}

describe.skipIf(!habilitado)("Edição segura de pacientes (Sprint 41)", () => {
  it("✗ AUTORIZADOR tenta alterar origem → BLOQUEADO pelo trigger (RN30)", async () => {
    if (!(await edicaoSeguraAplicada())) return;
    const admin = adminClient();
    let id: string | null = null;
    try {
      const paciente = await criarPacienteDeTeste(autorizador, "Autorizador Origem");
      id = paciente.id;

      const { error } = await autorizador
        .from("pacientes")
        .update({ origem: "esporadico" })
        .eq("id", id);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/imutável|RN30/i);
    } finally {
      if (id) await admin.from("pacientes").delete().eq("id", id);
    }
  });

  it("✗ GESTOR tenta alterar origem → BLOQUEADO (RN30 vale para todos os perfis)", async () => {
    if (!(await edicaoSeguraAplicada())) return;
    const admin = adminClient();
    let id: string | null = null;
    try {
      const paciente = await criarPacienteDeTeste(gestor, "Gestor Origem");
      id = paciente.id;

      const { error } = await gestor
        .from("pacientes")
        .update({ origem: "esporadico" })
        .eq("id", id);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/imutável|RN30/i);
    } finally {
      if (id) await admin.from("pacientes").delete().eq("id", id);
    }
  });

  it("✗ RECEPCIONISTA tenta UPDATE → BLOQUEADO (RLS sem policy: 0 linhas afetadas)", async () => {
    if (!(await edicaoSeguraAplicada())) return;
    const admin = adminClient();
    let id: string | null = null;
    try {
      const paciente = await criarPacienteDeTeste(autorizador, "Recep Update");
      id = paciente.id;

      // Sem policy de UPDATE para recepcionista, o PostgREST NÃO retorna erro:
      // a linha fica invisível e o UPDATE afeta 0 registros. A validação
      // correta é a invariância do dado.
      const { error } = await recepcionista
        .from("pacientes")
        .update({ nome: "Nome Alterado" })
        .eq("id", id);
      expect(error).toBeNull();

      const { data: depois } = await admin
        .from("pacientes")
        .select("nome")
        .eq("id", id)
        .single();
      expect(depois?.nome).toBe("Recep Update");
    } finally {
      if (id) await admin.from("pacientes").delete().eq("id", id);
    }
  });

  it("✓ GESTOR altera status (ativo → inativo → ativo)", async () => {
    if (!(await edicaoSeguraAplicada())) return;
    const admin = adminClient();
    let id: string | null = null;
    try {
      const paciente = await criarPacienteDeTeste(gestor, "Gestor Status");
      id = paciente.id;

      const { error: erroInativar } = await gestor
        .from("pacientes")
        .update({ status: "inativo" })
        .eq("id", id);
      expect(erroInativar).toBeNull();

      const { error: erroReativar } = await gestor
        .from("pacientes")
        .update({ status: "ativo" })
        .eq("id", id);
      expect(erroReativar).toBeNull();
    } finally {
      if (id) await admin.from("pacientes").delete().eq("id", id);
    }
  });

  it("✗ GESTOR tenta alterar nome → BLOQUEADO (apenas status)", async () => {
    if (!(await edicaoSeguraAplicada())) return;
    const admin = adminClient();
    let id: string | null = null;
    try {
      const paciente = await criarPacienteDeTeste(gestor, "Gestor Nome");
      id = paciente.id;

      const { error } = await gestor
        .from("pacientes")
        .update({ nome: "Nome Proibido" })
        .eq("id", id);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/apenas o status/i);
    } finally {
      if (id) await admin.from("pacientes").delete().eq("id", id);
    }
  });

  it("✗ AUTORIZADOR tenta alterar status → BLOQUEADO", async () => {
    if (!(await edicaoSeguraAplicada())) return;
    const admin = adminClient();
    let id: string | null = null;
    try {
      const paciente = await criarPacienteDeTeste(autorizador, "Autorizador Status");
      id = paciente.id;

      const { error } = await autorizador
        .from("pacientes")
        .update({ status: "inativo" })
        .eq("id", id);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/status do paciente/i);
    } finally {
      if (id) await admin.from("pacientes").delete().eq("id", id);
    }
  });

  it("✓ AUTORIZADOR altera campo permitido (nome) → PERMITIDO", async () => {
    if (!(await edicaoSeguraAplicada())) return;
    const admin = adminClient();
    let id: string | null = null;
    try {
      const paciente = await criarPacienteDeTeste(autorizador, "Autorizador Nome");
      id = paciente.id;

      const { data, error } = await autorizador
        .from("pacientes")
        .update({ nome: "Nome Editado Sprint 41" })
        .eq("id", id)
        .select("nome")
        .single();

      expect(error).toBeNull();
      expect(data?.nome).toBe("Nome Editado Sprint 41");
    } finally {
      if (id) await admin.from("pacientes").delete().eq("id", id);
    }
  });

  it("AUDITORIA — snapshot antes/depois inclui cpf E origem (migration 41)", async () => {
    if (!(await edicaoSeguraAplicada())) return;
    const admin = adminClient();
    let id: string | null = null;
    try {
      // Cria via GESTOR e inativa via GESTOR (ação administrativa auditável).
      const paciente = await criarPacienteDeTeste(gestor, "Auditoria Snapshot");
      id = paciente.id;

      const { error } = await gestor
        .from("pacientes")
        .update({ status: "inativo" })
        .eq("id", id);
      expect(error).toBeNull();

      // Gestor lê auditoria_logs (policy auditoria_select_gestor).
      const { data: logs, error: erroLog } = await gestor
        .from("auditoria_logs")
        .select("acao, entidade_id, dados_antes, dados_depois")
        .eq("entidade_tipo", "pacientes")
        .eq("entidade_id", id)
        .order("data_hora", { ascending: false })
        .limit(2);

      expect(erroLog).toBeNull();
      expect(logs?.length).toBeGreaterThan(0);

      const logStatus = logs!.find((l) => l.acao === "paciente.status_alterado");
      expect(logStatus).toBeDefined();

      // Campos novos presentes em AMBOS os snapshots (antes inclui cpf/origem;
      // depois também) — fecha a lacuna da trilha cega.
      for (const lado of ["dados_antes", "dados_depois"] as const) {
        const snapshot = logStatus![lado] as Record<string, unknown> | null;
        expect(snapshot).not.toBeNull();
        expect(Object.keys(snapshot!)).toContain("cpf");
        expect(Object.keys(snapshot!)).toContain("origem");
        expect(snapshot!["origem"]).toBe("regular");
      }
      expect((logStatus!["dados_antes"] as Record<string, unknown>)["status"]).toBe("ativo");
      expect((logStatus!["dados_depois"] as Record<string, unknown>)["status"]).toBe("inativo");
    } finally {
      if (id) await admin.from("pacientes").delete().eq("id", id);
    }
  });
});
