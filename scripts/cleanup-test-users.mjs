// Sprint 44 — Limpeza dos usuários de teste do Supabase Auth (Admin API)
//
// Remove de auth.users os 6 usuários criados por ferramentas de teste:
//   * 5 do seed (scripts/seed-test-users.mjs):
//       gestor.teste@caps.local, autorizador.teste@caps.local,
//       recepcionista.teste@caps.local, inativo.teste@caps.local,
//       semvinculo.teste@caps.local
//   * 1 da verificação de Primeiro Acesso (Sprints 42/43):
//       primeiro-acesso-teste@caps.local
//
// IMPORTANTE:
//   * Rodar APÓS o scripts/cleanup-test-data.sql (public.usuarios já sem os
//     vínculos de teste — a FK usuarios.auth_user_id é ON DELETE RESTRICT).
//   * Usa EXCLUSIVAMENTE o Admin API (mesmo padrão do seed) — não altera
//     estruturas internas de auth via SQL e evita órfãos em identities/sessions.
//   * Não remove usuários reais (joelgonn@gmail.com, joelgonn@hotmail.com):
//     o script recusa se um dos alvos não for reconhecido como usuário de teste.
//
// Uso (PowerShell):
//   node --env-file=.env.local scripts/cleanup-test-users.mjs --check   # simular
//   node --env-file=.env.local scripts/cleanup-test-users.mjs --confirm # aplicar
//
// Exige no ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAILS_TESTE = [
  "gestor.teste@caps.local",
  "autorizador.teste@caps.local",
  "recepcionista.teste@caps.local",
  "inativo.teste@caps.local",
  "semvinculo.teste@caps.local",
  "primeiro-acesso-teste@caps.local",
];

function fail(msg) {
  console.error(`[cleanup] ERRO: ${msg}`);
  process.exit(1);
}

if (!URL) fail("NEXT_PUBLIC_SUPABASE_URL ausente (use --env-file=.env.local).");
if (!SERVICE_ROLE) fail("SUPABASE_SERVICE_ROLE_KEY ausente — somente para provisionamento de dev.");

const confirmar = process.argv.includes("--confirm");
if (!confirmar) {
  console.log("[cleanup] Modo simulação. Rode com --confirm para excluir.");
}

const admin = createClient(URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) fail(`listUsers: ${error.message}`);

  const alvo = data.users.filter((u) => EMAILS_TESTE.includes(String(u.email).toLowerCase()));
  const conhecidos = new Set(alvo.map((u) => String(u.email).toLowerCase()));

  for (const e of EMAILS_TESTE) {
    if (!conhecidos.has(e)) {
      console.log(`[cleanup] aviso: ${e} não encontrado em auth.users (nada a excluir)`);
    }
  }

  const naoTeste = data.users.filter((u) => !knownFor(EMAILS_TESTE, u.email));
  if (naoTeste.length === 0) {
    fail("nenhum usuário fora dos testes encontrado — interrompendo por segurança.");
  }
  console.log(`[cleanup] preservando ${naoTeste.length} usuário(s) real(is):`);
  for (const u of naoTeste) console.log(`   - ${u.email}`);

  if (alvo.length === 0) {
    console.log("[cleanup] nenhum usuário de teste para excluir.");
    return;
  }

  console.log(`[cleanup] ${confirmar ? "excluindo" : "(simular) excluir"} ${alvo.length} usuário(s) de teste:`);
  for (const u of alvo) {
    if (!confirmar) {
      console.log(`   (simular) ${u.email}`);
      continue;
    }
    const { error: err } = await admin.auth.admin.deleteUser(u.id);
    if (err) fail(`deleteUser ${u.email}: ${err.message}`);
    console.log(`   excluído ${u.email}`);
  }

  if (confirmar) {
    console.log("[cleanup] Concluído. auth.users agora contém apenas os usuários reais.");
  }
}

function knownFor(lista, email) {
  return lista.some((e) => e.toLowerCase() === String(email).toLowerCase());
}

main().catch((err) => fail(err.message));