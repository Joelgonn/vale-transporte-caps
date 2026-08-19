import { describe, it, expect, vi } from "vitest";
import { UsuarioService } from "@/lib/services/usuario-service";
import type { UsuarioRepository } from "@/lib/repositories/usuario-repository";
import { PERFIS, PROFISSOES } from "@/lib/domain/enums";
import type { UsuarioFuncional } from "@/lib/domain/usuarios/types";

function usuario(sobre?: Partial<UsuarioFuncional>): UsuarioFuncional {
  return {
    id: "u1",
    auth_user_id: "a1",
    nome: "João",
    email: "joao@example.com",
    perfil: PERFIS.RECEPCIONISTA,
    profissao: null,
    status_ativo: true,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...sobre,
  };
}

function makeService(repo: UsuarioRepository) {
  return new UsuarioService(repo);
}

describe("UsuarioService", () => {
  it("criarUsuarioFuncional aceita autorizador com profissão", async () => {
    const dados = {
      auth_user_id: "a2",
      nome: "Dr. Souza",
      email: "souza@example.com",
      perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
      profissao: PROFISSOES.PSICOLOGO,
    };
    const repo = {
      criar: vi.fn(async () => usuario({ perfil: dados.perfil, profissao: dados.profissao })),
    } as unknown as UsuarioRepository;
    const service = makeService(repo);

    await service.criarUsuarioFuncional(dados);

    expect(repo.criar).toHaveBeenCalledWith(dados);
  });

  it("criarUsuarioFuncional rejeita autorizador sem profissão (RN02)", async () => {
    const repo = { criar: vi.fn() } as unknown as UsuarioRepository;
    const service = makeService(repo);

    await expect(
      service.criarUsuarioFuncional({
        auth_user_id: "a2",
        nome: "Dr. Souza",
        email: "souza@example.com",
        perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
        profissao: null,
      })
    ).rejects.toMatchObject({ code: "VALIDACAO" });

    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("ativarUsuario atualiza status_ativo para true", async () => {
    const repo = {
      atualizarStatusAtivo: vi.fn(async () => usuario({ status_ativo: true })),
    } as unknown as UsuarioRepository;
    const service = makeService(repo);

    await service.ativarUsuario("u1");

    expect(repo.atualizarStatusAtivo).toHaveBeenCalledWith("u1", true);
  });

  it("inativarUsuario atualiza status_ativo para false (sem exclusão física)", async () => {
    const repo = {
      atualizarStatusAtivo: vi.fn(async () => usuario({ status_ativo: false })),
    } as unknown as UsuarioRepository;
    const service = makeService(repo);

    await service.inativarUsuario("u1");

    expect(repo.atualizarStatusAtivo).toHaveBeenCalledWith("u1", false);
  });

  it("inativarUsuario não chama método de exclusão (não existe no repositório)", async () => {
    const repo = {
      atualizarStatusAtivo: vi.fn(async () => usuario({ status_ativo: false })),
    } as unknown as UsuarioRepository;
    const service = makeService(repo);

    await service.inativarUsuario("u1");

    expect(repo).not.toHaveProperty("excluir");
    expect(repo).not.toHaveProperty("remover");
  });

  it("atualizarUsuario para gestor sem profissão não lança", async () => {
    const repo = {
      atualizar: vi.fn(async () => usuario()),
    } as unknown as UsuarioRepository;
    const service = makeService(repo);

    await expect(
      service.atualizarUsuario("u1", { perfil: PERFIS.GESTOR, profissao: null })
    ).resolves.toBeTruthy();
  });

  it("listarUsuarios delega ao repositório", async () => {
    const repo = { listar: vi.fn(async () => [usuario()]) } as unknown as UsuarioRepository;
    const service = makeService(repo);

    const lista = await service.listarUsuarios();

    expect(repo.listar).toHaveBeenCalledOnce();
    expect(lista).toHaveLength(1);
  });

  it("listarUsuarios repassa a busca ao repositório", async () => {
    const repo = { listar: vi.fn(async () => []) } as unknown as UsuarioRepository;
    const service = makeService(repo);

    await service.listarUsuarios("maria");

    expect(repo.listar).toHaveBeenCalledWith("maria");
  });
});
