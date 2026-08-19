// Sprint 36 — Validação pós-migrations (BANCO REAL): matriz de perfis na
// renovação + RN23 + PostgREST direto.
//
// As migrations 20260817000001/0002 foram aplicadas manualmente no Supabase.
// Este script COMPROVA o comportamento no banco, ignorando UI e Server Action
// (chamadas diretas via PostgREST/supabase-js), com dados temporários que são
// removidos no final (service role apenas para cleanup).
//
// Valida:
//   1. Renovação do MESMO paciente → permitida (recepção) [RN23 positivo]
//   2. Renovação de OUTRO paciente → bloqueada pelo banco [RN23 negativo]
//   3. Matriz de perfis em renovação (INSERT com renovacao_de_id) via PostgREST:
//      RECEPCIONISTA permitida; AUTORIZADOR, GESTOR, INATIVO, SEM_VÍNCULO e
//      ANON bloqueados.
//   4. Race condition: N retiradas concorrentes nunca ultrapassam a quantidade.
//
// Uso: node --env-file=.env.local scripts/validate-sprint-36.mjs

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AUT_EMAIL = process.env.TEST_AUTORIZADOR_EMAIL;
const AUT_SENHA = process.env.TEST_AUTORIZADOR_PASSWORD;
const REC_EMAIL = process.env.TEST_RECEPCIONISTA_EMAIL;
const REC_SENHA = process.env.TEST_RECEPCIONISTA_PASSWORD;
const GESTOR_EMAIL = process.env.TEST_GESTOR_EMAIL;
const GESTOR_SENHA = process.env.TEST_GESTOR_PASSWORD;
const INAT_EMAIL = process.env.TEST_INATIVO_EMAIL;
const INAT_SENHA = process.env.TEST_INATIVO_PASSWORD;
const SEM_EMAIL = process.env.TEST_SEM_VINCULO_EMAIL;
const SEM_SENHA = process.env.TEST_SEM_VINCULO_PASSWORD;

const GESTOR_SUS_TESTE = "0000000001";

function fail(msg) {
  console.error(`[validate] ERRO: ${msg}`);
  process.exit(1);
}

if (!URL || !KEY) fail("Credenciais públicas ausentes (use --env-file=.env.local).");

const admin = createClient(URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function signIn(email, senha) {
  const client = createClient(URL, KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: senha });
  if (error) {
    if (error.status === 429) throw new Error("429 rate limit do Supabase Auth");
    throw error;
  }
  return client;
}

async function usuarioAtualId(client) {
  const { data, error } = await client.rpc("usuario_atual_id");
  if (error) throw error;
  return data;
}

async function pacienteTeste() {
  const { data, error } = await admin
    .from("pacientes")
    .select("id")
    .eq("gestor_sus", GESTOR_SUS_TESTE)
    .maybeSingle();
  if (error) throw error;
  if (!data) fail(`Paciente de teste ${GESTOR_SUS_TESTE} ausente.`);
  return data.id;
}

async function criarLiberacao(client, autorizadorId, pacienteId, quantidade = 2) {
  const { data, error } = await client
    .from("liberacoes")
    .insert({
      paciente_id: pacienteId,
      tipo: "continua",
      quantidade,
      periodo_meses: 3,
      profissional_autorizador_id: autorizadorId,
    })
    .select("id, paciente_id, quantidade")
    .single();
  if (error) throw error;
  return data;
}

async function limparLiberacoes(ids) {
  if (!ids || ids.length === 0) return;
  const { error: eFilhas } = await admin.from("liberacoes").delete().in("renovacao_de_id", ids);
  if (eFilhas) throw eFilhas;
  const { error: eLib } = await admin.from("liberacoes").delete().in("id", ids);
  if (eLib) throw eLib;
}

async function limparRetiradas(ids) {
  if (!ids || ids.length === 0) return;
  const { error } = await admin.from("retiradas").delete().in("id", ids);
  if (error) throw error;
}

async function limparPaciente(id) {
  if (!id) return;
  await admin.from("retiradas").delete().eq("paciente_id", id);
  await admin.from("liberacoes").delete().eq("paciente_id", id);
  const { error } = await admin.from("pacientes").delete().eq("id", id);
  if (error) throw error;
}

function anonClient() {
  return createClient(URL, KEY);
}

// Tenta inserir uma renovação e informa se o banco permitiu ou bloqueou.
async function tentarRenovacao(client, payload) {
  const { data, error } = await client.from("liberacoes").insert(payload).select("id").single();
  if (error) return { permitida: false, erro: error.message, id: null };
  return { permitida: true, erro: null, id: data.id };
}

const resultados = {};

async function main() {
  const anon = anonClient();
  const autorizador = await signIn(AUT_EMAIL, AUT_SENHA);
  const recepcionista = await signIn(REC_EMAIL, REC_SENHA);
  const gestor = await signIn(GESTOR_EMAIL, GESTOR_SENHA);
  const inativo = await signIn(INAT_EMAIL, INAT_SENHA);
  const semVinculo = await signIn(SEM_EMAIL, SEM_SENHA);

  const autorizadorId = await usuarioAtualId(autorizador);
  const pacienteTesteId = await pacienteTeste();

  const { data: pacienteB, error: errPac } = await autorizador
    .from("pacientes")
    .insert({
      gestor_sus: `val-${Date.now()}`,
      nome: "Paciente Temporário — Validação Sprint 36",
      status: "ativo",
    })
    .select("id")
    .single();
  if (errPac) throw errPac;

  const liberacaoA = await criarLiberacao(autorizador, autorizadorId, pacienteTesteId, 2);
  const idsLib = [liberacaoA.id];
  const retiradaIds = [];
  const pacientesTemporarios = [pacienteB.id];

  try {
    // ── 1) RN23 positivo: renovação do MESMO paciente (recepção) → permitida ──
    const payloadMesmo = {
      paciente_id: pacienteTesteId,
      tipo: "continua",
      quantidade: 2,
      periodo_meses: 3,
      profissional_autorizador_id: autorizadorId,
      renovacao_de_id: liberacaoA.id,
    };
    const mesmoPaciente = await tentarRenovacao(recepcionista, payloadMesmo);
    resultados.rn23_mesmo_paciente = mesmoPaciente.permitida;
    if (mesmoPaciente.id) idsLib.push(mesmoPaciente.id);
    console.log(
      `[RN23+] renovação do MESMO paciente → ${mesmoPaciente.permitida ? "PERMITIDA" : "BLOQUEADA: " + mesmoPaciente.erro}`
    );

    // ── 2) RN23 negativo: renovação de OUTRO paciente → bloqueada ──
    const payloadOutro = { ...payloadMesmo, paciente_id: pacienteB.id };
    const outroPaciente = await tentarRenovacao(recepcionista, payloadOutro);
    resultados.rn23_outro_paciente = !outroPaciente.permitida;
    if (outroPaciente.id) idsLib.push(outroPaciente.id);
    console.log(
      `[RN23-] renovação de OUTRO paciente → ${outroPaciente.permitida ? "PERMITIDA (GAP!)" : "BLOQUEADA pelo banco"}`
    );

    // ── 3) Matriz de perfis (PostgREST direto) ──
    const casos = [
      ["RECEPCIONISTA ativa", recepcionista, payloadMesmo, true],
      ["AUTORIZADOR ativo", autorizador, payloadMesmo, false],
      ["GESTOR ativo", gestor, payloadMesmo, false],
      ["INATIVO", inativo, payloadMesmo, false],
      ["SEM VÍNCULO", semVinculo, payloadMesmo, false],
      ["ANON", anon, payloadMesmo, false],
    ];
    resultados.matriz = {};
    for (const [rotulo, client, payload, esperado] of casos) {
      const r = await tentarRenovacao(client, payload);
      if (r.id) idsLib.push(r.id);
      resultados.matriz[rotulo] = r.permitida;
      const ok = r.permitida === esperado;
      console.log(
        `[matriz] ${rotulo.padEnd(22)} → ${r.permitida ? "PERMITIDA" : "BLOQUEADA"}` +
          (r.permitida ? "" : ` (${r.erro.split("\n")[0]})`) +
          ` | esperado=${esperado ? "permitida" : "bloqueada"} ${ok ? "OK" : "DIVERGENTE"}`
      );
    }

    // ── 4) Race condition: 4 retiradas concorrentes de 1 em liberação de 2 ──
    // supabase-js resolve (não rejeita) respostas com erro: contabilizamos como
    // sucesso REAL apenas respostas com data.id e sem error.
    const tentativas = Array.from({ length: 4 }, () =>
      recepcionista
        .from("retiradas")
        .insert({ liberacao_id: liberacaoA.id, paciente_id: pacienteTesteId, quantidade: 1 })
        .select("id, quantidade")
        .single()
    );
    const settled = await Promise.allSettled(tentativas);
    const sucessos = settled.filter(
      (r) => r.status === "fulfilled" && r.value?.data?.id && !r.value?.error
    ).length;
    const recusas = settled.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value?.error)
    ).length;
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value?.data?.id && !r.value?.error) retiradaIds.push(r.value.data.id);
    }
    const { data: retiradas } = await recepcionista
      .from("retiradas")
      .select("quantidade")
      .eq("liberacao_id", liberacaoA.id);
    const soma = (retiradas ?? []).reduce((acc, r) => acc + r.quantidade, 0);
    resultados.race = { sucessos, recusas, soma, ok: soma <= 2 && sucessos <= 2 };
    console.log(
      `[race] 4 retiradas concorrentes de 1 em liberação de 2 → ${sucessos} aceitas, ${recusas} recusadas, soma=${soma} → ` +
        (resultados.race.ok ? "SEM over-subscription (FOR UPDATE serializa)" : "OVER-SUBSCRIPTION")
    );
  } finally {
    await limparRetiradas(retiradaIds);
    await limparLiberacoes(idsLib);
    for (const id of pacientesTemporarios) await limparPaciente(id);
  }

  console.log("---- Resumo ----");
  const rn23ok = resultados.rn23_mesmo_paciente === true && resultados.rn23_outro_paciente === true;
  const matrizOk = Object.entries(resultados.matriz ?? {}).every(
    ([k, v]) => (k === "RECEPCIONISTA ativa" ? v === true : v === false)
  );
  console.log(`RN23: ${rn23ok ? "OK (mesmo paciente permitida, outro bloqueada)" : "FALHOU"}`);
  console.log(`Matriz de perfis: ${matrizOk ? "OK (só recepção renova)" : "DIVERGENTE"}`);
  console.log(`Race: ${resultados.race?.ok ? "OK (sem over-subscription)" : "DIVERGENTE"}`);
  process.exit(rn23ok && matrizOk && resultados.race?.ok ? 0 : 1);
}

main().catch((err) => fail(err.message));