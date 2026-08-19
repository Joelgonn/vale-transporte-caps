import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const ATRASO_MS = 1500;
const MAX_TENTATIVAS = 3;

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("supabase integration", () => {
  // Intenção do teste: credenciais inválidas são rejeitadas com 400 (auth
  // configurado corretamente). Se o Supabase estiver temporariamente sob rate
  // limit (429), o teste tenta novamente com backoff — não é falha do
  // aplicativo, é condição ambiental. Qualquer outro código de erro (ou pior:
  // sucesso) falha imediatamente.
  it("rejects login with invalid credentials (validates connection + auth config)", async () => {
    if (!url || !publishableKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL e PUBLISHABLE_KEY são necessários");
    }

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      const supabase = createClient(url, publishableKey);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: "nao-existe@example.com",
        password: "senha-invalida",
      });

      if (error && error.status !== 429) {
        expect(data.user).toBeNull();
        expect(error.status).toBe(400);
        expect(error.code).toBe("invalid_credentials");
        return;
      }

      if (tentativa < MAX_TENTATIVAS) {
        await aguardar(ATRASO_MS * tentativa);
      }
    }

    throw new Error("Supabase Auth permaneceu sob rate limit (429) durante toda a tentativa");
  });
});