// Modelo ÚNICO de navegação do Dashboard (Sprint 22) — puro, sem React/JSX,
// compartilhado entre o shell (client) e a home (server component).

import {
  permissoesAuditoria,
  permissoesLiberacoes,
  permissoesPacientes,
  permissoesRelatorios,
  permissoesRetiradas,
  permissoesUsuarios,
} from "@/lib/domain/regras";
import type { PerfilUsuario } from "@/lib/domain/enums";

export type CapacidadeDashboard = {
  ativo: boolean;
  pacientes: boolean;
  liberacoes: boolean;
  retiradas: boolean;
  usuarios: boolean;
  auditoria: boolean;
  relatorios: boolean;
};

export type IconeId =
  | "pacientes"
  | "liberacoes"
  | "retiradas"
  | "usuarios"
  | "auditoria"
  | "relatorios";

export type Modulo = {
  slug: IconeId;
  rotulo: string;
  descricao: string;
  href: string;
};

export function modulosPorCapacidade(cap: CapacidadeDashboard): Modulo[] {
  const modulos: Modulo[] = [];
  if (cap.pacientes) {
    modulos.push({
      slug: "pacientes",
      rotulo: "Pacientes",
      descricao: "Cadastro e acompanhamento dos beneficiários do vale-transporte.",
      href: "/dashboard/pacientes",
    });
  }
  if (cap.liberacoes) {
    modulos.push({
      slug: "liberacoes",
      rotulo: "Liberações",
      descricao: "Registro e renovação das liberações de vale-transporte.",
      href: "/dashboard/liberacoes",
    });
  }
  if (cap.retiradas) {
    modulos.push({
      slug: "retiradas",
      rotulo: "Retiradas",
      descricao: "Registro e acompanhamento das retiradas pela recepção.",
      href: "/dashboard/retiradas",
    });
  }
  if (cap.usuarios) {
    modulos.push({
      slug: "usuarios",
      rotulo: "Usuários",
      descricao: "Gestão de perfis e status — exclusiva do Gestor ativo.",
      href: "/dashboard/usuarios",
    });
  }
  if (cap.auditoria) {
    modulos.push({
      slug: "auditoria",
      rotulo: "Auditoria",
      descricao: "Trilha de leitura das operações — exclusiva do Gestor ativo.",
      href: "/dashboard/auditoria",
    });
  }
  if (cap.relatorios) {
    modulos.push({
      slug: "relatorios",
      rotulo: "Relatórios",
      descricao: "Consultas de liberações, retiradas e consolidado — exclusivas do Gestor ativo.",
      href: "/dashboard/relatorios",
    });
  }
  return modulos;
}

export function moduloAtual(
  pathname: string,
  cap: CapacidadeDashboard
): Modulo | null {
  for (const modulo of modulosPorCapacidade(cap)) {
    if (
      pathname === modulo.href ||
      pathname.startsWith(`${modulo.href}/`)
    ) {
      return modulo;
    }
  }
  return null;
}

export type AcaoRapida = {
  rotulo: string;
  descricao: string;
  href: string;
  icone: IconeId;
};

export function acoesRapidasPorPerfil(
  perfil: PerfilUsuario | null,
  statusAtivo: boolean | null
): AcaoRapida[] {
  const acoes: AcaoRapida[] = [];

  if (permissoesPacientes(perfil, statusAtivo).podeCriar) {
    acoes.push({
      rotulo: "Novo paciente",
      descricao: "Cadastrar um novo beneficiário",
      href: "/dashboard/pacientes",
      icone: "pacientes",
    });
  }
  if (permissoesLiberacoes(perfil, statusAtivo).podeCriar) {
    acoes.push({
      rotulo: "Nova liberação",
      descricao: "Autorizar nova liberação de vale-transporte",
      href: "/dashboard/liberacoes",
      icone: "liberacoes",
    });
  }
  if (permissoesLiberacoes(perfil, statusAtivo).podeRenovar) {
    acoes.push({
      rotulo: "Renovar liberação",
      descricao: "Renovar uma liberação vigente",
      href: "/dashboard/liberacoes",
      icone: "liberacoes",
    });
  }
  if (permissoesRetiradas(perfil, statusAtivo).podeRegistrar) {
    acoes.push({
      rotulo: "Registrar retirada",
      descricao: "Registrar retirada de vale-transporte pelo balcão",
      href: "/dashboard/retiradas",
      icone: "retiradas",
    });
  }
  if (permissoesUsuarios(perfil, statusAtivo).podeAlterarStatus) {
    acoes.push({
      rotulo: "Gerenciar usuários",
      descricao: "Perfis, vínculos e status de acesso",
      href: "/dashboard/usuarios",
      icone: "usuarios",
    });
  }
  if (permissoesAuditoria(perfil, statusAtivo).podeConsultar) {
    acoes.push({
      rotulo: "Consultar auditoria",
      descricao: "Trilha de leitura das operações",
      href: "/dashboard/auditoria",
      icone: "auditoria",
    });
  }
  if (permissoesRelatorios(perfil, statusAtivo).podeConsultar) {
    acoes.push({
      rotulo: "Consultar relatórios",
      descricao: "Liberações, retiradas e consolidado",
      href: "/dashboard/relatorios",
      icone: "relatorios",
    });
  }
  return acoes;
}