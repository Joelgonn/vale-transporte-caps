// Sprint 37 — Fase A: setup GLOBAL que cria UMA sessão real por perfil por
// execução da suíte (em vez de um signInWithPassword() por teste).
//
// A sessão é gravada em um arquivo temporário que os workers dos arquivos de
// teste leem para reconstruir clients autenticados via auth.setSession()
// (operação local, sem rede). Resultado: 5 signIns por execução no lugar de 59,
// deixando o rate limit do Supabase Auth longe do alcance — inclusive com
// execuções consecutivas (npm test ×3).
//
// IMPORTANTE: autenticação REAL, sem mocks e sem mascaramento — se um login
// falhar, o setup falha e a suíte inteira falha com a causa verdadeira.

import { createClient } from "@supabase/supabase-js";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnv } from "vite";

// O global-setup roda no processo principal do Vitest, onde o `.env.local` NÃO
// está carregado — carregamos explicitamente do diretório de trabalho.
const env = loadEnv("test", process.cwd(), "");

export const AUTH_SESSIONS_FILE = join(tmpdir(), "vale-transporte-caps-auth-sessions.json");

interface SessaoArmazenada {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

type PerfilGlobal =
  | "gestor"
  | "autorizador"
  | "recepcionista"
  | "inativo"
  | "semVinculo";

const PERFIL_ENV: Record<PerfilGlobal, { email: string; senha: string }> = {
  gestor: { email: "TEST_GESTOR_EMAIL", senha: "TEST_GESTOR_PASSWORD" },
  autorizador: { email: "TEST_AUTORIZADOR_EMAIL", senha: "TEST_AUTORIZADOR_PASSWORD" },
  recepcionista: { email: "TEST_RECEPCIONISTA_EMAIL", senha: "TEST_RECEPCIONISTA_PASSWORD" },
  inativo: { email: "TEST_INATIVO_EMAIL", senha: "TEST_INATIVO_PASSWORD" },
  semVinculo: { email: "TEST_SEM_VINCULO_EMAIL", senha: "TEST_SEM_VINCULO_PASSWORD" },
};

export default async function globalSetup(): Promise<() => Promise<void>> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return async () => {
      await rm(AUTH_SESSIONS_FILE, { force: true });
    };
  }

  const sessoes: Partial<Record<PerfilGlobal, SessaoArmazenada>> = {};

  // Autenticação SEQUENCIAL (nunca em paralelo) — uma sessão por perfil.
  for (const perfil of Object.keys(PERFIL_ENV) as PerfilGlobal[]) {
    const email = env[PERFIL_ENV[perfil].email];
    const senha = env[PERFIL_ENV[perfil].senha];
    if (!email || !senha) continue;

    const client = createClient(url, publishableKey);
    const { data, error } = await client.auth.signInWithPassword({ email, password: senha });
    if (error) {
      throw new Error(`globalSetup: falha ao autenticar perfil ${perfil}: ${error.message}`);
    }
    if (!data.session) {
      throw new Error(`globalSetup: sessão ausente para perfil ${perfil}`);
    }

    sessoes[perfil] = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    };
  }

  await writeFile(AUTH_SESSIONS_FILE, JSON.stringify(sessoes), "utf8");

  return async () => {
    await rm(AUTH_SESSIONS_FILE, { force: true });
  };
}