// Sprint 36 — Reprodução de gaps de Banco/RLS/Trigger (somente leitura + dados de teste temporários)
//
// Executa contra o banco REAL com RLS/triggers habilitados, usando os usuários de
// teste do seed e SEM service role para as operações do fluxo (a app usa a mesma
// infraestrutura). O service role é usado apenas para CLEANUP dos dados criados.
//
// Parte A — Race condition no saldo de retiradas (fn_retiradas_before):
//   liberação de quantidade 2 + N retiradas CONCORRENTES de 1. Se o trigger não
//   travar a liberação (SELECT FOR UPDATE), várias transações passam o check de
//   saldo ao mesmo tempo → over-subscription (soma > 2). Se reproduzir, o fix é
//   adicionar FOR UPDATE no SELECT da liberação dentro do trigger.
//
// Parte B — Renovação forjável via PostgREST (fn_liberacoes_before):
//   a recepção insere uma "renovação" (renovacao_de_id) apontando para uma
//   liberação do paciente de teste, mas com paciente_id de OUTRO paciente. Sem a
//   validação de mesmo paciente (RN23 — DATABASE.md constraint 12), o INSERT passa
//   → prova o gap. Se reproduzir, o fix é validar o vínculo no trigger.
//
// Uso:
//   node --env-file=.env.local scripts/repro-sprint-36.mjs
//
// Exige: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SERVICE_ROLE_KEY (cleanup) e TEST_AUTORIZADOR_/TEST_RECEPCIONISTA_*.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AUT_EMAIL = process.env.TEST_AUTORIZADOR_EMAIL;
const AUT_SENHA = process.env.TEST_AUTORIZADOR_PASSWORD;
const REC_EMAIL = process.env.TEST_RECEPCIONISTA_EMAIL;
const REC_SENHA = process.env.TEST_RECEPCIONISTA_PASSWORD;

const GESTOR_SUS_TESTE = "0000000001";

function fail(msg) {
  console.error(`[repro] ERRO: ${msg}`);
  process.exit(1);
}

if (!URL || !KEY) fail("Credenciais públicas ausentes (use --env-file=.env.local).");
if (!AUT_EMAIL || !AUT_SENHA || !REC_EMAIL || !REC_SENHA) fail("TEST_AUTORIZADOR_/TEST_RECEPCIONISTA_ ausentes.");

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
  if (!data) fail(`Paciente de teste ${GESTOR_SUS_TESTE} ausente — rode scripts/seed-test-users.mjs --confirm.`);
  return data.id;
}

async function criarLiberacao(autorizador, autorizadorId, pacienteId, quantidade) {
  const { data, error } = await autorizador
    .from("liberacoes")
    .insert({
      paciente_id: pacienteId,
      tipo: "continua",
      quantidade,
      periodo_meses: 3,
      profissional_autorizador_id: autorizadorId,
    })
    .select("id, quantidade, paciente_id")
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
  const { error: eRet } = await admin.from("retiradas").delete().eq("paciente_id", id);
  if (eRet) throw eRet;
  const { error: eLib } = await admin.from("liberacoes").delete().eq("paciente_id", id);
  if (eLib) throw eLib;
  const { error: ePac } = await admin.from("pacientes").delete().eq("id", id);
  if (ePac) throw ePac;
}

const resultados = { A_sobrescricao: 0, A_rodadas: 0, B_forjada_aceita: null };

async function parteA(recep, autorizador, autorizadorId, pacienteId) {
  // liberação de quantidade 2; 4 retiradas CONCORRENTES de 1 → só 2 poderiam
  // ser aceitas; se mais de 2 passarem, há over-subscription (race confirmado).
  const liberacao = await criarLiberacao(autorizador, autorizadorId, pacienteId, 2);
  const retiradaIds = [];
  try {
    const tentativas = Array.from({ length: 4 }, () =>
      recep.from("retiradas").insert({ liberacao_id: liberacao.id, paciente_id: pacienteId, quantidade: 1 }).select("id, quantidade").single()
    );
    const settled = await Promise.allSettled(tentativas);
    // supabase-js resolve (não rejeita) respostas com erro: sucesso REAL é
    // somente fulfilled com data.id e sem error.
    const sucessos = settled.filter(
      (r) => r.status === "fulfilled" && r.value?.data?.id && !r.value?.error
    ).length;
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value?.data?.id && !r.value?.error) retiradaIds.push(r.value.data.id);
    }
    const { data: retiradas } = await recep
      .from("retiradas")
      .select("quantidade")
      .eq("liberacao_id", liberacao.id);
    const soma = (retiradas ?? []).reduce((acc, r) => acc + r.quantidade, 0);
    const sobrescrita = soma > 2;
    resultados.A_rodadas++;
    if (sobrescrita) resultados.A_sobrescricao++;
    console.log(
      `[Parte A] rodada: ${sucessos}/4 inserções aceitas, soma=${soma} de quantidade=2 → ` +
        (sobrescrita ? "OVER-SUBSCRIPTION (gap reproduzido)" : "dentro do limite")
    );
  } finally {
    await limparRetiradas(retiradaIds);
    await limparLiberacoes([liberacao.id]);
  }
}

async function parteB(recep, autorizador, autorizadorId, pacienteTesteId) {
  // Cria paciente B (temporário) e uma liberação A para o paciente de teste.
  const gestorSusB = `repro-${Date.now()}`;
  const { data: pacienteB, error: ePac } = await autorizador
    .from("pacientes")
    .insert({ gestor_sus: gestorSusB, nome: "Paciente Temporário — Repro Sprint 36", status: "ativo" })
    .select("id")
    .single();
  if (ePac) throw ePac;

  const liberacaoA = await criarLiberacao(autorizador, autorizadorId, pacienteTesteId, 2);
  const idsLib = [liberacaoA.id];
  let forjadaId = null;
  try {
    // Renovação "forjada": renovacao_de_id da liberação A (paciente de teste),
    // mas paciente_id = B (outro paciente) — o trigger atual não valida RN23.
    const { data, error } = await recep
      .from("liberacoes")
      .insert({
        paciente_id: pacienteB.id,
        tipo: "continua",
        quantidade: 2,
        periodo_meses: 3,
        profissional_autorizador_id: autorizadorId,
        renovacao_de_id: liberacaoA.id,
      })
      .select("id, paciente_id, renovacao_de_id")
      .single();

    if (error) {
      resultados.B_forjada_aceita = false;
      console.log(`[Parte B] renovação com paciente diferente FOI BLOQUEADA: ${error.message}`);
    } else {
      resultados.B_forjada_aceita = true;
      forjadaId = data.id;
      console.log(
        `[Parte B] GAP reproduzido: renovação com paciente diferente foi ACEITA (id=${data.id}) ` +
          `— paciente=${data.paciente_id}, renovacao_de_id=${data.renovacao_de_id}`
      );
    }
  } finally {
    if (forjadaId) idsLib.push(forjadaId);
    await limparLiberacoes(idsLib);
    await limparPaciente(pacienteB.id);
  }
}

async function main() {
  let autorizador;
  let recep;
  try {
    autorizador = await signIn(AUT_EMAIL, AUT_SENHA);
    recep = await signIn(REC_EMAIL, REC_SENHA);
  } catch (e) {
    if (/429/.test(String(e.message))) {
      console.log("[repro] Auth 429 (rate limit) — repro adiado; execute novamente em alguns minutos.");
      process.exit(2);
    }
    throw e;
  }

  const autorizadorId = await usuarioAtualId(autorizador);
  const pacienteTesteId = await pacienteTeste();

  try {
    await parteA(recep, autorizador, autorizadorId, pacienteTesteId);
    await parteB(recep, autorizador, autorizadorId, pacienteTesteId);
  } finally {
    // liberações/retiradas/pacientes temporários já limpos nos finally internos.
  }

  console.log("---- Resumo ----");
  console.log(`Parte A: ${resultados.A_sobrescricao}/${resultados.A_rodadas} rodadas com over-subscription`);
  console.log(`Parte B: renovação com paciente diferente ${resultados.B_forjada_aceita === true ? "ACEITA (gap)" : "bloqueada"}`);

  const gapA = resultados.A_sobrescricao > 0;
  const gapB = resultados.B_forjada_aceita === true;
  console.log(
    gapA || gapB
      ? `VEREDITO: gaps reproduzidos (A=${gapA}, B=${gapB}) — migrations 20260817000001/0002 necessárias.`
      : "Nenhum gap reproduzido nesta execução."
  );
  process.exit(gapA || gapB ? 3 : 0);
}

main().catch((err) => fail(err.message));