// Helpers de autenticação para os testes de INTEGRAÇÃO reais contra o Supabase.
//
// Sprint 37 — Fase A (estabilização do rate limit do Supabase Auth):
//   * Uma ÚNICA sessão por perfil por arquivo de teste (criada em beforeAll),
//     eliminando o padrão anterior de um signInWithPassword() por `it()`.
//   * Autenticação sequencial (nunca em paralelo) dentro de cada arquivo.
//   * Retry/backoff SOMENTE para HTTP 429 (rate limit) — nunca para outros erros.
//
// O isolamento de responsabilidades permanece: estes helpers são usados APENAS
// em testes de integração/RLS reais. Testes unitários e de componente continuam
// sem Supabase Auth (usam mocks).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function credenciaisPublicasPresentes(): boolean {
  return Boolean(url && publishableKey);
}

export function anonClient(): SupabaseClient {
  if (!url || !publishableKey) throw new Error("Credenciais públicas ausentes");
  return createClient(url, publishableKey);
}

export function adminClient(): SupabaseClient {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Perfil =
  | "gestor"
  | "autorizador"
  | "recepcionista"
  | "inativo"
  | "semVinculo";

export const PERFIS_TODOS: Perfil[] = [
  "gestor",
  "autorizador",
  "recepcionista",
  "inativo",
  "semVinculo",
];

const PERFIL_CREDENCIAIS: Record<Perfil, { email?: string; senha?: string }> = {
  gestor: {
    email: process.env.TEST_GESTOR_EMAIL,
    senha: process.env.TEST_GESTOR_PASSWORD,
  },
  autorizador: {
    email: process.env.TEST_AUTORIZADOR_EMAIL,
    senha: process.env.TEST_AUTORIZADOR_PASSWORD,
  },
  recepcionista: {
    email: process.env.TEST_RECEPCIONISTA_EMAIL,
    senha: process.env.TEST_RECEPCIONISTA_PASSWORD,
  },
  inativo: {
    email: process.env.TEST_INATIVO_EMAIL,
    senha: process.env.TEST_INATIVO_PASSWORD,
  },
  semVinculo: {
    email: process.env.TEST_SEM_VINCULO_EMAIL,
    senha: process.env.TEST_SEM_VINCULO_PASSWORD,
  },
};

export function credencialPerfilPresente(perfil: Perfil): boolean {
  const c = PERFIL_CREDENCIAIS[perfil];
  return Boolean(c.email && c.senha);
}

export function credencialPerfil(perfil: Perfil): { email: string; senha: string } {
  const c = PERFIL_CREDENCIAIS[perfil];
  if (!c.email || !c.senha) throw new Error(`Credenciais ausentes para perfil ${perfil}`);
  return { email: c.email, senha: c.senha };
}

const ATRASO_INICIAL_MS = 1500;
const MAX_TENTATIVAS = 3;

// Diagnóstico opcional (TEST_AUTH_DEBUG=1): contabiliza os signIns reais por
// execução. Cada arquivo de teste roda em um worker próprio do Vitest, então o
// contador é por arquivo — útil para auditar o consumo do rate limit.
const debugAutenticacao = process.env.TEST_AUTH_DEBUG === "1";
let contadorAutenticacoes = 0;

async function aguardar(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function ehRateLimit(status: number | undefined, mensagem: string): boolean {
  return status === 429 || /rate limit|too many|limit reached/i.test(mensagem);
}

// Autentica com retry/backoff SOMENTE para 429. Qualquer outro erro (ex:
// credenciais inválidas, usuário inexistente) falha imediatamente — o teste
// precisa continuar validando esses casos reais.
export async function autenticar(email: string, senha: string): Promise<SupabaseClient> {
  if (!url || !publishableKey) throw new Error("Credenciais públicas ausentes");
  let ultimoErro: Error | null = null;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    contadorAutenticacoes++;
    if (debugAutenticacao) {
      console.log(`[auth-debug] signIn #${contadorAutenticacoes} (tentativa ${tentativa}): ${email}`);
    }
    const client = createClient(url, publishableKey);
    const { error } = await client.auth.signInWithPassword({ email, password: senha });
    if (!error) return client;

    ultimoErro = new Error(error.message);
    if (ehRateLimit(error.status, error.message) && tentativa < MAX_TENTATIVAS) {
      await aguardar(ATRASO_INICIAL_MS * tentativa);
      continue;
    }
    throw ultimoErro;
  }

  throw ultimoErro;
}

// Uma sessão por perfil, memoizada por módulo (um cache por arquivo/worker do
// Vitest — cada arquivo de teste tem seus próprios clients, sem compartilhar
// sessão entre arquivos que rodam em paralelo).
const cache = new Map<Perfil, Promise<SupabaseClient>>();

// Sessão compartilhada gravada pelo global-setup (tests/global-setup.ts): uma
// sessão real por perfil por execução da suíte. setSession() é local (sem rede)
// — não consome o rate limit do Auth.
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const AUTH_SESSIONS_FILE = join(tmpdir(), "vale-transporte-caps-auth-sessions.json");

interface SessaoArmazenada {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

async function sessaoCompartilhada(perfil: Perfil): Promise<SessaoArmazenada | null> {
  try {
    const raw = await readFile(AUTH_SESSIONS_FILE, "utf8");
    const sessoes = JSON.parse(raw) as Record<string, SessaoArmazenada | undefined>;
    return sessoes[perfil] ?? null;
  } catch {
    return null;
  }
}

async function clienteComSessao(sessao: SessaoArmazenada): Promise<SupabaseClient> {
  if (!url || !publishableKey) throw new Error("Credenciais públicas ausentes");
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.setSession({
    access_token: sessao.access_token,
    refresh_token: sessao.refresh_token,
  });
  if (error) throw error;
  return client;
}

function obterClient(perfil: Perfil): Promise<SupabaseClient> {
  if (!cache.has(perfil)) {
    cache.set(
      perfil,
      sessaoCompartilhada(perfil).then((sessao) => {
        // Sessão compartilhada primeiro; fallback para login real apenas se o
        // global-setup não tiver rodado (ex.: execução parcial).
        if (sessao?.access_token) return clienteComSessao(sessao);
        const { email, senha } = credencialPerfil(perfil);
        return autenticar(email, senha);
      })
    );
  }
  return cache.get(perfil)!;
}

export interface ClientesPerfil {
  gestor?: SupabaseClient;
  autorizador?: SupabaseClient;
  recepcionista?: SupabaseClient;
  inativo?: SupabaseClient;
  semVinculo?: SupabaseClient;
}

// Cria uma sessão por perfil, de forma SEQUENCIAL (nunca em paralelo), para os
// perfis cujas credenciais existem no ambiente. Use em `beforeAll`.
export async function clientesPorPerfil(perfis: Perfil[]): Promise<ClientesPerfil> {
  const resultado: ClientesPerfil = {};
  for (const perfil of perfis) {
    if (!credencialPerfilPresente(perfil)) continue;
    resultado[perfil] = await obterClient(perfil);
  }
  return resultado;
}