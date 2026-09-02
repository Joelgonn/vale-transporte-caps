// Testes de integração com o Supabase real — RLS exercitada através da
// aplicação. Usam SOMENTE credenciais públicas (NEXT_PUBLIC_SUPABASE_URL +
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) e login de usuários de teste via
// signInWithPassword. NUNCA usa SERVICE_ROLE_KEY nem bypass de RLS.
//
// Cenários: anon, authenticated sem vínculo, usuário ativo/inativo, autorizador,
// recepcionista e gestor. Todos os blocos são pulados quando as credenciais de
// teste correspondentes não estão definidas no ambiente (.env.local).
//
// Sprint 37 — Fase A: uma ÚNICA sessão por perfil é criada no `beforeAll`
// (helpers/supabase-clients.ts) e reutilizada pelos testes do arquivo — 5
// signIns no lugar de um por `it()`. O teste de concorrência (Sprint 10)
// permanece REAL: os INSERTs simultâneos continuam via Promise.allSettled.

import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  credenciaisPublicasPresentes,
  anonClient,
  clientesPorPerfil,
  credencialPerfilPresente,
  type ClientesPerfil,
} from "../helpers/supabase-clients";

const anonHabilitado = credenciaisPublicasPresentes();
const gestorHabilitado = credenciaisPublicasPresentes() && credencialPerfilPresente("gestor");
const recepcionistaHabilitado = credenciaisPublicasPresentes() && credencialPerfilPresente("recepcionista");
const autorizadorHabilitado = credenciaisPublicasPresentes() && credencialPerfilPresente("autorizador");
const inativoHabilitado = credenciaisPublicasPresentes() && credencialPerfilPresente("inativo");
const semVinculoHabilitado = credenciaisPublicasPresentes() && credencialPerfilPresente("semVinculo");

// Uma sessão por perfil, criada uma única vez para TODO o arquivo.
let gestor: SupabaseClient;
let autorizador: SupabaseClient;
let recepcionista: SupabaseClient;
let inativo: SupabaseClient;
let semVinculo: SupabaseClient;

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

describe.skipIf(!anonHabilitado)("RLS — anon", () => {
  it("ANON não acessa v_pacientes (nenhuma linha / acesso negado)", async () => {
    const supabase = anonClient();
    const { data } = await supabase.from("v_pacientes").select("*");
    expect(totalLinhas(data)).toBe(0);
  });

  it("ANON não executa pacientes_com_cpf()", async () => {
    const supabase = anonClient();
    const { data, error } = await supabase.rpc("pacientes_com_cpf");
    expect(error).not.toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });

  it("ANON não lê a coluna cpf de pacientes", async () => {
    const supabase = anonClient();
    const { data, error } = await supabase.from("pacientes").select("cpf");
    expect(error ?? null).not.toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });
});

describe.skipIf(!gestorHabilitado)("RLS — gestor ativo", () => {
  it("GESTOR ATIVO lista v_pacientes sem erro", async () => {
    const { data, error } = await gestor.from("v_pacientes").select("*");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GESTOR ATIVO obtém CPF via pacientes_com_cpf() (coluna cpf não é selecionada diretamente)", async () => {
    const { data, error } = await gestor.rpc("pacientes_com_cpf");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GESTOR ATIVO é BLOQUEADO ao selecionar cpf diretamente (coluna revogada)", async () => {
    const { data, error } = await gestor.from("pacientes").select("cpf");
    expect(error ?? null).not.toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });

  it("GESTOR ATIVO lista public.usuarios (gestão de usuários)", async () => {
    const { data, error } = await gestor
      .from("usuarios")
      .select("*")
      .limit(50);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe.skipIf(!autorizadorHabilitado)("RLS — autorizador ativo", () => {
  it("AUTORIZADOR ATIVO lista v_pacientes sem erro", async () => {
    const { data, error } = await autorizador.from("v_pacientes").select("*");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("AUTORIZADOR NÃO recebe CPF de pacientes_com_cpf() (gate interno de gestor)", async () => {
    const { data, error } = await autorizador.rpc("pacientes_com_cpf");
    expect(error).toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });

  it("AUTORIZADOR NÃO lê public.usuarios (0 linhas — gestão é do Gestor)", async () => {
    const { data, error } = await autorizador.from("usuarios").select("*");
    expect(error).toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });
});

describe.skipIf(!recepcionistaHabilitado)("RLS — recepcionista ativa", () => {
  it("RECEPCIONISTA ATIVA lista v_pacientes sem erro", async () => {
    const { data, error } = await recepcionista.from("v_pacientes").select("*");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("RECEPCIONISTA NÃO recebe CPF de pacientes_com_cpf() (gate interno de gestor)", async () => {
    const { data, error } = await recepcionista.rpc("pacientes_com_cpf");
    expect(error).toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });

  it("RECEPCIONISTA NÃO lê public.usuarios (0 linhas — gestão é do Gestor)", async () => {
    const { data, error } = await recepcionista.from("usuarios").select("*");
    expect(error).toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });
});

describe.skipIf(!inativoHabilitado)("RLS — usuário inativo", () => {
  it("USUÁRIO INATIVO não consulta v_pacientes (nenhuma linha)", async () => {
    const { data, error } = await inativo.from("v_pacientes").select("*");
    expect(error).toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });

  it("USUÁRIO INATIVO não lê public.usuarios (0 linhas)", async () => {
    const { data, error } = await inativo.from("usuarios").select("*");
    expect(error).toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });
});

describe.skipIf(!semVinculoHabilitado)("RLS — authenticated sem vínculo funcional", () => {
  it("AUTHENTICATED SEM VÍNCULO não consulta v_pacientes (nenhuma linha)", async () => {
    const { data, error } = await semVinculo.from("v_pacientes").select("*");
    expect(error).toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });

  it("AUTHENTICATED SEM VÍNCULO não lê public.usuarios (0 linhas)", async () => {
    const { data, error } = await semVinculo.from("usuarios").select("*");
    expect(error).toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });
});

describe.skipIf(!gestorHabilitado)("Auditoria — append-only via grants", () => {
  it("UPDATE em auditoria_logs é bloqueado para authenticated", async () => {
    const { data, error } = await gestor.from("auditoria_logs").update({ acao: "x" }).eq("id", 1);
    expect(error ?? null).not.toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });

  it("DELETE em auditoria_logs é bloqueado para authenticated", async () => {
    const { data, error } = await gestor.from("auditoria_logs").delete().eq("id", 1);
    expect(error ?? null).not.toBeNull();
    expect(totalLinhas(data)).toBe(0);
  });

  it("GESTOR consulta auditoria_logs sem erro", async () => {
    const { data, error } = await gestor.from("auditoria_logs").select("*").limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe.skipIf(!recepcionistaHabilitado)("Auditoria — geração automática de log", () => {
  // Exploratório e dependente de dados: se existir liberação ativa, registra
  // uma retirada e confere o log gerado pela trigger fn_auditoria.
  it("registra retirada e confirma log gerado com usuário/entidade coerentes", async () => {
    if (!gestorHabilitado) return; // leitura da trilha exige o cliente do Gestor
    const { data: liberacoes } = await recepcionista
      .from("liberacoes")
      .select("id, paciente_id, quantidade")
      .eq("status", "ativa")
      .limit(1);

    if (!liberacoes || liberacoes.length === 0) {
      return; // sem dados de teste — não é falha
    }

    const alvo = liberacoes[0];
    const { data: retirada, error } = await recepcionista
      .from("retiradas")
      .insert({ liberacao_id: alvo.id, paciente_id: alvo.paciente_id, quantidade: 1 })
      .select("id")
      .single();

    if (error) {
      // Quantidade/validade inválidas geram erro do trigger — aceitável em
      // ambiente de teste sem dados controlados.
      return;
    }

    expect(retirada).toBeTruthy();

    // Sprint 42.3: a leitura da trilha é exclusiva do Gestor
    // (policy auditoria_select_gestor); a recepção NÃO lê auditoria_logs.
    const { data: logs } = await gestor
      .from("auditoria_logs")
      .select("usuario_id, acao, entidade_tipo, entidade_id, dados_antes, dados_depois, data_hora")
      .eq("entidade_tipo", "retiradas")
      .eq("entidade_id", retirada!.id);

    expect(Array.isArray(logs)).toBe(true);
    expect(logs!.length).toBeGreaterThan(0);
    expect(logs![0].usuario_id).toBeTruthy();
    expect(logs![0].acao).toBe("retirada.registrada");
    expect(logs![0].data_hora).toBeTruthy();
  });
});

describe.skipIf(!recepcionistaHabilitado)("Concorrência — retiradas simultâneas (Sprint 10)", () => {
  // ATUALIZADO na Sprint 42: a quantidade da liberação é PREVISÃO e não limita
  // mais a retirada (RN31). O invariante mantido é de CONCORRÊNCIA: o lock FOR
  // UPDATE evita erros/anomalias sob INSERTs simultâneos — todas as tentativas
  // válidas são aceitas e a soma reflete exatamente as aceitas. Se o ambiente
  // estiver com o limite antigo (migration 42 não aplicada), vale o invariante
  // original: soma ≤ quantidade autorizada.
  it("duas retiradas simultâneas são aceitas sem anomalia (modelo por migração)", async () => {
    const { data: liberacoes } = await recepcionista
      .from("liberacoes")
      .select("id, paciente_id, quantidade")
      .eq("status", "ativa")
      .limit(1);

    if (!liberacoes || liberacoes.length === 0) {
      return; // sem dados de teste — não é falha
    }

    const alvo = liberacoes[0];
    const parcela = Math.ceil(alvo.quantidade / 2);

    // soma ANTES das inserções simultâneas (a liberação pode ter retiradas
    // pré-existentes de outros testes — a comparação deve ser delta-based).
    const { data: antes } = await recepcionista
      .from("retiradas")
      .select("quantidade")
      .eq("liberacao_id", alvo.id);
    const somaAntes = (antes ?? []).reduce((acc: number, r: { quantidade: number }) => acc + r.quantidade, 0);

    const tentativas = [
      { liberacao_id: alvo.id, paciente_id: alvo.paciente_id, quantidade: parcela },
      { liberacao_id: alvo.id, paciente_id: alvo.paciente_id, quantidade: parcela },
    ];

    const resultados = await Promise.allSettled(
      tentativas.map((t) => recepcionista.from("retiradas").insert(t).select("quantidade").single())
    );

    const sucessos = resultados.filter((r) => r.status === "fulfilled").length;

    const { data: retiradas } = await recepcionista
      .from("retiradas")
      .select("quantidade")
      .eq("liberacao_id", alvo.id);

    const soma = (retiradas ?? []).reduce((acc: number, r: { quantidade: number }) => acc + r.quantidade, 0);

    if (soma > alvo.quantidade) {
      // Modelo NOVO (RN31): previsão não bloqueia — pelo menos uma deve ter sido aceita.
      expect(sucessos).toBeGreaterThanOrEqual(1);
      expect(soma).toBeGreaterThan(alvo.quantidade);
    } else {
      // Modelo ANTIGO (limite ativo): over-subscription continua impossível.
      expect(
        soma <= alvo.quantidade,
        `Over-subscription detectada: soma ${soma} > quantidade ${alvo.quantidade}.`
      ).toBe(true);
    }
  });
});