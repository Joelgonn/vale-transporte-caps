// Sprint 11.1 — Seed de usuários de teste para validação real (DESENVOLVIMENTO APENAS)
//
// Procedimento seguro e idempotente:
//   * Usa EXCLUSIVAMENTE o Supabase Admin API (service role) para criar/atualizar
//     usuários em auth.users — NÃO toca em estruturas internas de auth via SQL.
//   * Insere o vínculo em public.usuarios com o MESMO client (role service), pois
//     o seed é uma operação de provisionamento (não é código de aplicação).
//   * NUNCA imprime, grava ou armazena senha — as senhas/emails vêm das variáveis
//     TEST_* do ambiente (.env.local, gitignored) e voltam para lá.
//   * Não cria migration com senhas; nada aqui entra nas migrations estruturais.
//
// Uso (PowerShell):
//   node --env-file=.env.local scripts/seed-test-users.mjs --check   # simular
//   node --env-file=.env.local scripts/seed-test-users.mjs --confirm # aplicar
//
// Exige no ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (apenas
// para este provisionamento) e os pares TEST_<PERFIL>_EMAIL / TEST_<PERFIL>_PASSWORD.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PERFIS = {
  GESTOR: { perfil: "gestor", status_ativo: true, profissao: null, nome: "Usuário de Teste — Gestor" },
  AUTORIZADOR: { perfil: "profissional_autorizador", status_ativo: true, profissao: "psicologo", nome: "Usuária de Teste — Autorizadora" },
  RECEPCIONISTA: { perfil: "recepcionista", status_ativo: true, profissao: null, nome: "Usuária de Teste — Recepcionista" },
  INATIVO: { perfil: "recepcionista", status_ativo: false, profissao: null, nome: "Usuária de Teste — Inativa" },
  SEM_VINCULO: { perfil: null, status_ativo: null, profissao: null, nome: "Usuário de Teste — Sem vínculo" },
};

// Sprint 18 — paciente de teste para validar o fluxo real de liberações no
// browser e nos testes de integração (sem ele, a página não tem dados reais).
// Mesmo padrão idempotente dos usuários: upsert por gestor_sus fixo.
const PACIENTE_TESTE = {
  gestor_sus: "0000000001",
  nome: "Paciente de Teste — Vale Transporte",
  status: "ativo",
};

function fail(msg) {
  console.error(`[seed] ERRO: ${msg}`);
  process.exit(1);
}

if (!URL) fail("NEXT_PUBLIC_SUPABASE_URL ausente (use --env-file=.env.local).");
if (!SERVICE_ROLE) fail("SUPABASE_SERVICE_ROLE_KEY ausente — somente para provisionamento de dev.");

const confirmar = process.argv.includes("--confirm");
if (!confirmar) {
  console.log("[seed] Modo simulação. Rode com --confirm para aplicar as mudanças.");
}

const admin = createClient(URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = createClient(URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

async function listar() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) fail(`listUsers: ${error.message}`);
  return data.users;
}

async function garantirUsuario(perfil, email, password) {
  const emailLc = String(email).toLowerCase();
  const users = await listar();
  const existente = users.find((u) => String(u.email).toLowerCase() === emailLc);
  let authUserId;

  if (!existente) {
    if (!confirmar) {
      console.log(`[seed] (simular) criar auth.users para ${email} [${perfil}]`);
      return { authUserId: null, criado: false };
    }
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) fail(`createUser ${email}: ${error.message}`);
    authUserId = data.user.id;
    console.log(`[seed] criado auth.users ${email} [${perfil}]`);
  } else {
    if (confirmar) {
      const { error } = await admin.auth.admin.updateUserById(existente.id, { password, email_confirm: true });
      if (error) fail(`updateUserById ${email}: ${error.message}`);
    }
    authUserId = existente.id;
    console.log(`[seed] (${confirmar ? "atualizado" : "simular: forçar senha"}) auth.users ${email} [${perfil}]`);
  }

  return { authUserId };
}

async function garantirUsuariosRow(perfil, email, authUserId) {
  if (perfil.perfil === null) {
    console.log(`[seed] ${email} SEM registro em public.usuarios (intencional — cenário sem vínculo)`);
    return;
  }
  const row = {
    auth_user_id: authUserId,
    email,
    nome: perfil.nome,
    perfil: perfil.perfil,
    profissao: perfil.profissao,
    status_ativo: perfil.status_ativo,
    unidade_id: null,
  };
  if (!confirmar) {
    console.log(`[seed] (simular) upsert public.usuarios para ${email} -> perfil=${perfil.perfil}, status_ativo=${perfil.status_ativo}`);
    return;
  }
  const { error } = await db
    .from("usuarios")
    .upsert(row, { onConflict: "auth_user_id" });
  if (error) fail(`upsert usuarios ${email}: ${error.message}`);
  console.log(`[seed] upsert public.usuarios ${email} -> perfil=${perfil.perfil}, status_ativo=${perfil.status_ativo}`);
}

async function garantirPaciente() {
  if (!confirmar) {
    console.log(`[seed] (simular) upsert public.pacientes para ${PACIENTE_TESTE.gestor_sus} -> ${PACIENTE_TESTE.nome}`);
    return;
  }
  const { error } = await db
    .from("pacientes")
    .upsert(PACIENTE_TESTE, { onConflict: "gestor_sus" });
  if (error) fail(`upsert pacientes: ${error.message}`);
  console.log(`[seed] upsert public.pacientes ${PACIENTE_TESTE.gestor_sus} -> ${PACIENTE_TESTE.nome}`);
}

async function main() {
  const emails = Object.keys(PERFIS).map((k) => process.env[`TEST_${k}_EMAIL`]);
  if (emails.some((e) => !e)) {
    fail("Defina os pares TEST_<PERFIL>_EMAIL no .env.local (veja scripts/README.md).");
  }

  for (const k of Object.keys(PERFIS)) {
    const perfil = PERFIS[k];
    const email = process.env[`TEST_${k}_EMAIL`];
    const password = process.env[`TEST_${k}_PASSWORD`];
    if (!password) fail(`TEST_${k}_PASSWORD ausente no .env.local.`);

    const { authUserId } = await garantirUsuario(perfil.perfil ?? "sem-vínculo", email, password);
    if (authUserId) {
      await garantirUsuariosRow(perfil, email, authUserId);
    }
  }
  await garantirPaciente();
  console.log("[seed] Concluído. Nenhuma senha foi exibida.");
}

main().catch((err) => fail(err.message));