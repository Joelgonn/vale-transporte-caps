import type { Metadata } from "next";

import Landing from "@/components/landing/landing";

export const metadata: Metadata = {
  title: "Vale Transporte CAPS",
  description:
    "Sistema institucional de gestão do vale-transporte de acompanhamento: pacientes, liberações, retiradas, usuários e auditoria.",
};

export default function Home() {
  return <Landing />;
}