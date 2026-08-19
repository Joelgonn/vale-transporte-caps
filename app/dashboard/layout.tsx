import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import DashboardShell from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fdashboard");
  }

  // Defesa em profundidade (o proxy.ts já redireciona): usuário com primeiro
  // acesso pendente não monta o shell operacional até trocar a senha.
  if (user.app_metadata?.precisa_trocar_senha === true) {
    redirect("/primeiro-acesso");
  }

  const usuario = await getUsuarioFuncional(supabase, user);

  return (
    <DashboardShell
      email={user.email ?? ""}
      perfil={usuario?.perfil ?? null}
      statusAtivo={usuario?.statusAtivo ?? null}
    >
      {children}
    </DashboardShell>
  );
}