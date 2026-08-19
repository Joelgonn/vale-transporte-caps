// Sprint 45 — Provisionamento de usuários REAIS no projeto de PRODUÇÃO
//
// Cria (somente) os usuários reais necessários no Supabase de produção, SEM
// senha definida por mim: o usuário recebe um convite (email) e define a própria
// senha ao aceitar. Não carrega nenhum dado/credencial de desenvolvimento.
//
// DIFERENÇA vs seed-test-users.mjs:
//   * O seed cria usuários de teste (TEST_*) com senha fixa — NÃO usar em prod.
//   * Este script recusa qualquer email de teste (final @caps.local) e recusa
//     rodar sem SUPABASE_SERVICE_ROLE_KEY explícita do projeto de PRODUÇÃO.
//
// Uso (PowerShell), com as chaves do projeto de PRODUÇÃO no ambiente:
//   node scripts/provision-real-users.mjs --check   # simular (mostra o que faria)
//   node scripts/provision-real-users.mjs --confirm # aplicar (envia convites)
//
// Exige no ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
// apontando para o projeto de PRODUÇÃO (NUNCA o .env.local de dev).

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Únicos usuários reais a provisionar (espelha o vínculo existente no dev).
const USUARIOS_REAIS = [
  {
    email: "joelgonn@gmail.com",
    nome: "Joelson Goncalves",
    perfil: "gestor",
    profissao: null,
    status_ativo: true,
  },
  {
    email: "joelgonn@hotmail.com",
    nome: "Joelgonn",
    perfil: "recepcionista",
    profissao: null,
    status_ativo: true,
  },
];

const isEmailTeste = (e) =>
  /@caps\.local$/i.test(e) || /teste/i.test(e) || /test/i.test(String(e).toLowerCase());

function fail(msg) {
  console.error(`[provision] ERRO: ${msg}`);
  process.exit(1);
}

if (!URL) fail("NEXT_PUBLIC_SUPABASE_URL ausente.");
if (!SERVICE_ROLE) fail("SUPABASE_SERVICE_ROLE_KEY ausente — use a do projeto de PRODUÇÃO.");

for (const u of USUARIOS_REAIS) {
  if (isEmailTeste(u.email)) fail(`email de teste detectado (${u.email}) — não permitido em produção.`);
}

const confirmar = process.argv.includes("--confirm");
if (!confirmar) console.log("[provision] Modo simulação. Rode com --confirm para enviar os convites.");

const admin = createClient(URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = createClient(URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

async function listar() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) fail(`listUsers: ${error.message}`);
  return data.users;
}

async function main() {
  const users = await listar();
  for (const u of USUARIOS_REAIS) {
    const emailLc = u.email.toLowerCase();
    const existente = users.find((x) => String(x.email).toLowerCase() === emailLc);

    let authUserId;
    if (existente) {
      authUserId = existente.id;
      console.log(`[provision] ${emailLc} já existe em auth.users (id=${authUserId}).`);
      if (existente.email_confirmed_at) {
        console.log(`[provision]    já confirmado — nenhum convite será enviado.`);
      } else if (confirmar) {
        const { error } = await admin.auth.admin.inviteUserByEmail(emailLc);
        if (error) fail(`inviteUserByEmail ${emailLc}: ${error.message}`);
        console.log(`[provision]    convite reenviado.`);
      } else {
        console.log(`[provision]    (simular) reenviar convite (email não confirmado).`);
      }
    } else {
      if (!confirmar) {
        console.log(`[provision] (simular) criar auth.users ${emailLc} + convite de email + vínculo em public.usuarios (perfil=${u.perfil}).`);
        continue;
      }
      const { data, error } = await admin.auth.admin.createUser({
        email: emailLc,
        email_confirm: false, // sem senha definida -> GoTrue envia convite
        app_metadata: { precisa_trocar_senha: false, provider: "email", providers: ["email"] },
        user_metadata: { nome: u.nome },
      });
      if (error) fail(`createUser ${emailLc}: ${error.message}`);
      authUserId = data.user.id;
      console.log(`[provision] criado auth.users ${emailLc} (id=${authUserId}) — convite enviado.`);
    }

    if (!authUserId) continue;

    // Vínculo funcional em public.usuarios (idempotente por auth_user_id).
    const { data: vinculado } = await db.from("usuarios").select("id").eq("auth_user_id", authUserId).maybeSingle();
    if (vinculado) {
      console.log(`[provision] public.usuarios já vinculado (id=${vinculado.id}).`);
      continue;
    }
    if (!confirmar) {
      console.log(`[provision] (simular) criar public.usuarios para ${emailLc} -> perfil=${u.perfil}.`);
      continue;
    }
    const { error } = await db.from("usuarios").insert({
      auth_user_id: authUserId,
      email: emailLc,
      nome: u.nome,
      perfil: u.perfil,
      profissao: u.profissao,
      status_ativo: u.status_ativo,
      unidade_id: null,
    });
    if (error) fail(`insert usuarios ${emailLc}: ${error.message}`);
    console.log(`[provision] public.usuarios criado para ${emailLc} -> perfil=${u.perfil}, status_ativo=${u.status_ativo}.`);
  }

  console.log("[provision] Concluído. Nenhuma senha foi definida por este script (usuários recebem convite).");
}

main().catch((err) => fail(err.message));