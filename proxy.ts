import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/dashboard"];
const publicRoutes = ["/login"];
const primeiroAcesso = "/primeiro-acesso";

// Sprint 17 — primeiro acesso: usuário criado pelo Gestor nasce com a senha
// temporária e `app_metadata.precisa_trocar_senha=true`. Enquanto pendente, ele
// NÃO acessa o dashboard operacional — é sempre levado a /primeiro-acesso.
function primeiroAcessoPendente(user: { app_metadata?: Record<string, unknown> } | null) {
  return user?.app_metadata?.precisa_trocar_senha === true;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((p) => path.startsWith(p));
  const isPublic = publicRoutes.includes(path) || path === "/";
  const isPrimeiroAcesso = path === primeiroAcesso;

  const { supabaseResponse, user } = await updateSession(request);
  const pendente = primeiroAcessoPendente(user);

  // Rotas que exigem sessão (dashboard e a própria tela de primeiro acesso).
  if (isProtected || isPrimeiroAcesso) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }

    // Primeiro acesso pendente NÃO entra em /dashboard/**: vai trocar a senha.
    if (pendente && !isPrimeiroAcesso) {
      const url = request.nextUrl.clone();
      url.pathname = primeiroAcesso;
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Quem já concluiu o primeiro acesso não precisa ver a tela de troca.
    if (isPrimeiroAcesso && !pendente) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Públicas com sessão: primeiro acesso pendente vai trocar a senha; caso
  // contrário segue para o dashboard (comportamento existente preservado).
  if (isPublic && user) {
    const url = request.nextUrl.clone();
    url.pathname = pendente ? primeiroAcesso : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
