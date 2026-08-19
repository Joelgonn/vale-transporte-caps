// Testes de integração dos RELATÓRIOS (Sprint 37 — Fase 8) contra o Supabase
// real. Exercitam EXATAMENTE as consultas PostgREST que o repositório faz
// (embeds com alias de FK, v_pacientes para busca, sem CPF) através da RLS —
// usando somente credenciais públicas + sessão compartilhada do global-setup.
//
// Sprint 37 — Fase A: uma ÚNICA sessão por perfil é criada no `beforeAll`
// (helpers/supabase-clients.ts). Blocos são pulados quando as credenciais do
// perfil correspondente não existem no ambiente.
//
// Nota de segurança: o GATE de relatórios é de aplicação (action/page — Gestor
// ativo). O banco não é a barreira (autorizador ainda lê liberações via RLS);
// por isso estes testes confirmam o que a RLS de fato expõe para cada perfil.

import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient,
  clientesPorPerfil,
  credenciaisPublicasPresentes,
  credencialPerfilPresente,
  type ClientesPerfil,
} from "../helpers/supabase-clients";

const anonHabilitado = credenciaisPublicasPresentes();
const gestorHabilitado = credenciaisPublicasPresentes() && credencialPerfilPresente("gestor");
const autorizadorHabilitado = credenciaisPublicasPresentes() && credencialPerfilPresente("autorizador");
const recepcionistaHabilitado = credenciaisPublicasPresentes() && credencialPerfilPresente("recepcionista");
const inativoHabilitado = credenciaisPublicasPresentes() && credencialPerfilPresente("inativo");
const semVinculoHabilitado = credenciaisPublicasPresentes() && credencialPerfilPresente("semVinculo");

let gestor: SupabaseClient;
let autorizador: SupabaseClient;
let recepcionista: SupabaseClient;
let inativo: SupabaseClient;
let semVinculo: SupabaseClient;

// Consultas idênticas às do RelatorioRepositoryPostgres (não duplicar aqui):
const SELECT_LIBERACOES =
  "*, pacientes(id, gestor_sus, nome), autorizador:usuarios!liberacoes_profissional_autorizador_id_fkey(id, nome), retiradas(quantidade)";
const SELECT_RETIRADAS =
  "*, pacientes(id, gestor_sus, nome), liberacoes(id, tipo, quantidade), recepcionista:usuarios!retiradas_recepcionista_id_fkey(id, nome)";
const SELECT_CONSOLIDADO = "*, pacientes(id, gestor_sus, nome), retiradas(quantidade)";

beforeAll(async () => {
  const perfis: (keyof ClientesPerfil)[] = [];
  if (gestorHabilitado) perfis.push("gestor");
  if (autorizadorHabilitado) perfis.push("autorizador");
  if (recepcionistaHabilitado) perfis.push("recepcionista");
  if (inativoHabilitado) perfis.push("inativo");
  if (semVinculoHabilitado) perfis.push("semVinculo");
  const clientes = await clientesPorPerfil(perfis);
  gestor = clientes.gestor!;
  autorizador = clientes.autorizador!;
  recepcionista = clientes.recepcionista!;
  inativo = clientes.inativo!;
  semVinculo = clientes.semVinculo!;
});

function totalLinhas(data: unknown): number {
  return Array.isArray(data) ? data.length : 0;
}

function semCpf(linha: Record<string, unknown>): boolean {
  return !("cpf" in linha) && !("cpf" in (linha.pacientes as Record<string, unknown> ?? {}));
}

describe.skipIf(!anonHabilitado)("Relatórios — anon", () => {
  it("ANON não lê liberações/retiradas com os embeds dos relatórios", async () => {
    const supabase = anonClient();
    const liberacoes = await supabase.from("liberacoes").select(SELECT_LIBERACOES);
    const retiradas = await supabase.from("retiradas").select(SELECT_RETIRADAS);
    expect(totalLinhas(liberacoes.data)).toBe(0);
    expect(totalLinhas(retiradas.data)).toBe(0);
  });
});

describe.skipIf(!gestorHabilitado)("Relatórios — Gestor ativo (leitura completa)", () => {
  it("GESTOR consulta liberações com embeds de paciente, autorizador e retiradas — sem erro e sem CPF", async () => {
    const { data, error } = await gestor
      .from("liberacoes")
      .select(SELECT_LIBERACOES, { count: "exact" })
      .limit(20);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    for (const linha of (data ?? []) as Record<string, unknown>[]) {
      expect(semCpf(linha)).toBe(true);
    }
  });

  it("GESTOR consulta retiradas com embeds (inclui recepcionista via FK) — sem erro e sem CPF", async () => {
    const { data, error } = await gestor
      .from("retiradas")
      .select(SELECT_RETIRADAS, { count: "exact" })
      .limit(20);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    for (const linha of (data ?? []) as Record<string, unknown>[]) {
      expect(semCpf(linha)).toBe(true);
    }
  });

  it("GESTOR consulta o consolidado (liberações + retiradas agregadas) — sem erro", async () => {
    const { data, error } = await gestor
      .from("liberacoes")
      .select(SELECT_CONSOLIDADO, { count: "exact" })
      .limit(20);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GESTOR resolve busca por nome/Gestor SUS via v_pacientes", async () => {
    const { data, error } = await gestor
      .from("v_pacientes")
      .select("id")
      .or("nome.ilike.%Silva%,gestor_sus.ilike.%Silva%")
      .limit(100);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GESTOR filtra liberações por período (gte/lte em data_inicio) e tipo", async () => {
    const { data, error } = await gestor
      .from("liberacoes")
      .select(SELECT_LIBERACOES)
      .gte("data_inicio", "2000-01-01")
      .lte("data_inicio", "2099-12-31T23:59:59.999")
      .eq("tipo", "continua")
      .order("data_inicio", { ascending: false })
      .limit(20);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe.skipIf(!autorizadorHabilitado)("Relatórios — autorizador (RLS permite leitura de liberações; gate é de aplicação)", () => {
  it("AUTORIZADOR lê liberações, mas NÃO recebe o nome do autorizador (usuarios é invisível para ele)", async () => {
    const { data, error } = await autorizador
      .from("liberacoes")
      .select(SELECT_LIBERACOES)
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    for (const linha of (data ?? []) as Record<string, unknown>[]) {
      const autorizador = linha.autorizador as { id?: string } | unknown[] | null | undefined;
      const alvo = Array.isArray(autorizador)
        ? (autorizador[0] as { id?: string } | undefined)
        : (autorizador as { id?: string } | null | undefined);
      // Se houver liberações, o nome do responsável não vaza para o autorizador.
      expect(alvo?.id ?? null).toBeNull();
    }
  });

  it("AUTORIZADOR NÃO recebe retiradas (política restrita a recepção/gestão)", async () => {
    const { data, error } = await autorizador.from("retiradas").select("*").limit(10);
    expect(error).toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });
});

describe.skipIf(!recepcionistaHabilitado)("Relatórios — recepcionista (lê liberações ativas e retiradas; sem usuarios)", () => {
  it("RECEPCIONISTA NÃO recebe o nome do autorizador nos embeds", async () => {
    const { data, error } = await recepcionista
      .from("liberacoes")
      .select(SELECT_LIBERACOES)
      .limit(10);

    expect(error).toBeNull();
    for (const linha of (data ?? []) as Record<string, unknown>[]) {
      const autorizador = linha.autorizador as { id?: string } | unknown[] | null | undefined;
      const alvo = Array.isArray(autorizador)
        ? (autorizador[0] as { id?: string } | undefined)
        : (autorizador as { id?: string } | null | undefined);
      expect(alvo?.id ?? null).toBeNull();
    }
  });

  it("RECEPCIONISTA lê retiradas com embeds (menos usuarios) sem erro", async () => {
    const { data, error } = await recepcionista.from("retiradas").select(SELECT_RETIRADAS).limit(10);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe.skipIf(!inativoHabilitado || !semVinculoHabilitado)("Relatórios — sem acesso (gate de aplicação)", () => {
  it("INATIVO não lê liberações/retiradas (RLS bloqueia)", async () => {
    const liberacoes = await inativo.from("liberacoes").select(SELECT_LIBERACOES);
    const retiradas = await inativo.from("retiradas").select(SELECT_RETIRADAS);
    expect(totalLinhas(liberacoes.data)).toBe(0);
    expect(totalLinhas(retiradas.data)).toBe(0);
  });

  it("SEM VÍNCULO não lê liberações/retiradas", async () => {
    const liberacoes = await semVinculo.from("liberacoes").select(SELECT_LIBERACOES);
    const retiradas = await semVinculo.from("retiradas").select(SELECT_RETIRADAS);
    expect(totalLinhas(liberacoes.data)).toBe(0);
    expect(totalLinhas(retiradas.data)).toBe(0);
  });
});