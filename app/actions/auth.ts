"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
};

function rotaInternaValida(destino: unknown): destino is string {
  if (typeof destino !== "string" || !destino.startsWith("/")) return false;
  // Bloqueia protocolos, hosts ("//host") e caminhos com o escape de separador
  // absoluto do Next ("/\\..."), evitando redirecionamento aberto via ?next=.
  return (
    !destino.startsWith("//") &&
    !destino.startsWith("/\\") &&
    !destino.includes("\\") &&
    !destino.includes(":")
  );
}

function mensagemDeErroLogin(error: unknown): string {
  const codigo = (error as { code?: string } | null)?.code;
  switch (codigo) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Seu e-mail ainda não foi confirmado. Verifique a caixa de entrada.";
    case "over_request_rate_limit":
      return "Muitas tentativas seguidas. Aguarde um instante e tente novamente.";
    default:
      // Nunca revela detalhes do Supabase/banco/de infraestrutura.
      return "Não foi possível entrar agora. Tente novamente em instantes.";
  }
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();

  let user: { app_metadata?: Record<string, unknown> } | null = null;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return { error: mensagemDeErroLogin(error) };
    }
    user = data.user;
  } catch {
    return { error: "Não foi possível entrar agora. Tente novamente em instantes." };
  }

  // Sprint 17/43 — primeiro acesso pendente tem prioridade sobre qualquer
  // destino (?next= incluso): o usuário com precisa_trocar_senha=true vai
  // trocar a senha antes de acessar o dashboard operacional.
  if (user?.app_metadata?.precisa_trocar_senha === true) {
    redirect("/primeiro-acesso");
  }

  const next = formData.get("next");
  redirect(rotaInternaValida(next) ? next : "/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}