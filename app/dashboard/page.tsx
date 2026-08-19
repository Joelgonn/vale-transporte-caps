import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import DashboardHome from "@/components/dashboard/dashboard-home";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fdashboard");
  }

  const usuario = await getUsuarioFuncional(supabase, user);

  return (
    <DashboardHome
      email={user.email ?? ""}
      perfil={usuario?.perfil ?? null}
      statusAtivo={usuario?.statusAtivo ?? null}
    />
  );
}