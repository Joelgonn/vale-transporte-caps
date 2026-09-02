// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardHome from "@/components/dashboard/dashboard-home";
import { PERFIS } from "@/lib/domain/enums";

function LinkDoModulo(nome: string) {
  return new RegExp(`^${nome}`);
}

describe("DashboardHome", () => {
  it("renderiza saudação e orientação contextual (fallback neutro, sem nome inventado)", () => {
    render(<DashboardHome email="gestor@caps.local" perfil={PERFIS.GESTOR} statusAtivo={true} />);
    const titulo = screen.getByRole("heading", { level: 1 });
    expect(titulo.textContent).toMatch(/^(Bom dia|Boa tarde|Boa noite)!$/);
    expect(screen.getByText("O que você precisa fazer hoje?")).toBeInTheDocument();
  });

  it("não inventa nome do usuário — usa e-mail real somente na visão da conta", () => {
    render(<DashboardHome email="gestor@caps.local" perfil={PERFIS.GESTOR} statusAtivo={true} />);
    expect(screen.queryByText(/quantos|Doutor|Dr\./i)).toBeNull();
    expect(screen.getByText("gestor@caps.local")).toBeInTheDocument();
  });

  it("Gestor ativo vê Pacientes, Usuários e Auditoria", () => {
    render(<DashboardHome email="gestor@caps.local" perfil={PERFIS.GESTOR} statusAtivo={true} />);
    expect(screen.getByRole("link", { name: LinkDoModulo("Pacientes") })).toHaveAttribute(
      "href",
      "/dashboard/pacientes"
    );
    expect(screen.getByRole("link", { name: LinkDoModulo("Usuários") })).toHaveAttribute(
      "href",
      "/dashboard/usuarios"
    );
    expect(screen.getByRole("link", { name: LinkDoModulo("Auditoria") })).toHaveAttribute(
      "href",
      "/dashboard/auditoria"
    );
    expect(screen.getAllByText("Gestor").length).toBeGreaterThanOrEqual(1);
  });

  it("Profissional autorizador ativo vê Pacientes, mas não Usuários", () => {
    render(
      <DashboardHome email="autorizador@caps.local" perfil={PERFIS.PROFISSIONAL_AUTORIZADOR} statusAtivo={true} />
    );
    expect(screen.getByRole("link", { name: LinkDoModulo("Pacientes") })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: LinkDoModulo("Usuários") })).toBeNull();
  });

  it("Recepcionista ativo vê Pacientes, mas não Usuários nem Auditoria", () => {
    render(<DashboardHome email="recep@caps.local" perfil={PERFIS.RECEPCIONISTA} statusAtivo={true} />);
    expect(screen.getByRole("link", { name: LinkDoModulo("Pacientes") })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: LinkDoModulo("Usuários") })).toBeNull();
    expect(screen.queryByRole("link", { name: LinkDoModulo("Auditoria") })).toBeNull();
  });

  it("Ações rápidas por perfil (Gestor gerencia usuários e consulta auditoria) — Sprint44 também registra retirada", () => {
    render(<DashboardHome email="gestor@caps.local" perfil={PERFIS.GESTOR} statusAtivo={true} />);
    expect(screen.getByRole("heading", { name: "Ações rápidas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Gerenciar usuários/ })).toHaveAttribute(
      "href",
      "/dashboard/usuarios"
    );
    expect(screen.getByRole("link", { name: /^Consultar auditoria/ })).toHaveAttribute(
      "href",
      "/dashboard/auditoria"
    );
    // Sprint44: todos registram retirada
    expect(screen.getByRole("link", { name: /^Registrar retirada/ })).toHaveAttribute("href", "/dashboard/retiradas");
  });

  it("Relatórios é um link real para o Gestor ativo, mas não para recepção/autorizador", () => {
    render(<DashboardHome email="gestor@caps.local" perfil={PERFIS.GESTOR} statusAtivo={true} />);
    expect(screen.getByRole("link", { name: LinkDoModulo("Relatórios") })).toHaveAttribute(
      "href",
      "/dashboard/relatorios"
    );
    expect(screen.getByRole("link", { name: /^Consultar relatórios/ })).toHaveAttribute(
      "href",
      "/dashboard/relatorios"
    );
  });

  it("recepção e autorizador não veem o módulo de Relatórios", () => {
    render(<DashboardHome email="recep@caps.local" perfil={PERFIS.RECEPCIONISTA} statusAtivo={true} />);
    expect(screen.queryByRole("link", { name: LinkDoModulo("Relatórios") })).toBeNull();
    render(<DashboardHome email="autorizador@caps.local" perfil={PERFIS.PROFISSIONAL_AUTORIZADOR} statusAtivo={true} />);
    expect(screen.queryByRole("link", { name: LinkDoModulo("Relatórios") })).toBeNull();
  });

  it("Ações rápidas por perfil (autorizador cria paciente e lança liberação) — Sprint44 também registra retirada", () => {
    render(
      <DashboardHome email="autorizador@caps.local" perfil={PERFIS.PROFISSIONAL_AUTORIZADOR} statusAtivo={true} />
    );
    expect(screen.getByRole("link", { name: /^Novo paciente/ })).toHaveAttribute(
      "href",
      "/dashboard/pacientes"
    );
    expect(screen.getByRole("link", { name: /^Nova liberação/ })).toHaveAttribute(
      "href",
      "/dashboard/liberacoes"
    );
    expect(screen.queryByRole("link", { name: /^Gerenciar usuários/ })).toBeNull();
    // Sprint44: autorizador também registra retirada
    expect(screen.getByRole("link", { name: /^Registrar retirada/ })).toHaveAttribute("href", "/dashboard/retiradas");
  });

  it("Ações rápidas por perfil (recepcionista renova liberação e registra retirada) — Sprint44 também cria liberação", () => {
    render(<DashboardHome email="recep@caps.local" perfil={PERFIS.RECEPCIONISTA} statusAtivo={true} />);
    expect(screen.getByRole("link", { name: /^Renovar liberação/ })).toHaveAttribute(
      "href",
      "/dashboard/liberacoes"
    );
    expect(screen.getByRole("link", { name: /^Registrar retirada/ })).toHaveAttribute(
      "href",
      "/dashboard/retiradas"
    );
    expect(screen.getByRole("link", { name: /^Nova liberação/ })).toHaveAttribute("href", "/dashboard/liberacoes");
  });

  it("usuário inativo não vê ações e recebe orientação segura", () => {
    render(<DashboardHome email="inativo@caps.local" perfil={PERFIS.RECEPCIONISTA} statusAtivo={false} />);
    expect(screen.getByText("Usuário inativo")).toBeInTheDocument();
    expect(screen.getByText(/Seu usuário está inativo/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: LinkDoModulo("Pacientes") })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Ações rápidas" })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Registrar retirada/ })).toBeNull();
  });

  it("usuário sem vínculo não vê ações e recebe orientação segura", () => {
    render(<DashboardHome email="novo@caps.local" perfil={null} statusAtivo={null} />);
    expect(screen.getByText("Sem perfil funcional")).toBeInTheDocument();
    expect(screen.getByText(/ainda não possui perfil funcional configurado/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: LinkDoModulo("Pacientes") })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Ações rápidas" })).toBeNull();
  });

  it("Módulo Liberações é um link real (rota existe) para o Gestor ativo", () => {
    render(<DashboardHome email="gestor@caps.local" perfil={PERFIS.GESTOR} statusAtivo={true} />);
    expect(screen.getByRole("link", { name: LinkDoModulo("Liberações") })).toHaveAttribute(
      "href",
      "/dashboard/liberacoes"
    );
  });

  it("Retiradas é um link real para o Gestor", () => {
    render(<DashboardHome email="gestor@caps.local" perfil={PERFIS.GESTOR} statusAtivo={true} />);
    expect(screen.getByRole("link", { name: LinkDoModulo("Retiradas") })).toHaveAttribute(
      "href",
      "/dashboard/retiradas"
    );
    expect(screen.queryByText(/Próximo módulo em desenvolvimento/i)).toBeNull();
  });

  it("profissional autorizador TAMBÉM vê o módulo de Retiradas — Sprint44", () => {
    render(<DashboardHome email="autorizador@caps.local" perfil={PERFIS.PROFISSIONAL_AUTORIZADOR} statusAtivo={true} />);
    expect(screen.getByRole("link", { name: LinkDoModulo("Retiradas") })).toHaveAttribute("href", "/dashboard/retiradas");
  });

  it("visão geral mostra dados reais (perfil, situação, e-mail)", () => {
    render(<DashboardHome email="gestor@caps.local" perfil={PERFIS.GESTOR} statusAtivo={true} />);
    expect(screen.getByText(/^Perfil$/)).toBeInTheDocument();
    expect(screen.getAllByText("Gestor").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("gestor@caps.local")).toBeInTheDocument();
  });

  it("não expõe informações sensíveis no conteúdo", () => {
    render(<DashboardHome email="gestor@caps.local" perfil={PERFIS.GESTOR} statusAtivo={true} />);
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/SERVICE_ROLE|supabase\.co|postgres|auth\.users|token/i);
  });
});