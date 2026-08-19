// Sprint 16 — Camada SERVER-ONLY para operações administrativas do Supabase Auth
// (Admin API / service role). Regras:
//   * usa SUPABASE_SERVICE_ROLE_KEY, que NUNCA pode chegar ao navegador;
//   * só pode ser importada em código de servidor — guard explícito abaixo falha
//     em runtime/build caso algum bundle client-side tente importar este módulo
//     (a chave nem chegaria ao cliente: variáveis não-NEXT_PUBLIC_* não são
//     embutidas em bundles do navegador, mas a falha deve ser barulhenta);
//   * NUNCA loga, retorna ou expõe a chave;
//   * client de uso restrito: persistSession: false (sem cookies/sessão).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase/admin.ts é exclusivo do servidor. Importe apenas em Server " +
      "Actions / Server Components / Route Handlers."
  );
}

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Provisionamento de usuários indisponível: configuração do servidor ausente."
    );
  }

  if (!cached) {
    cached = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return cached;
}
