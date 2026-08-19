# Arquitetura - Vale Transporte CAPS

## Visão Geral da Arquitetura

Arquitetura em camadas com separação clara de responsabilidades, utilizando Next.js (App Router) no frontend, Supabase como backend-as-a-service (PostgreSQL + Auth + Realtime + Storage), e deploy na Vercel.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   UI Layer   │  │  State Mgmt  │  │  API Client (Supabase)│  │
│  │  (React/Next)│  │  (React Query│  │  (supabase-js)       │  │
│  │              │  │   / Context) │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼─────────────────┼─────────────────────┼──────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS SERVER (Vercel)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Server Components / Actions                  │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌────────────────────┐  │   │
│  │  │  Domain     │ │  Services   │ │  Persistence       │  │   │
│  │  │  Services   │ │  (Use Cases)│ │  (Supabase Client) │  │   │
│  │  └─────────────┘ └─────────────┘ └────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SUPABASE (Managed)                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ PostgreSQL │ │    Auth    │ │  Realtime  │ │  Storage   │   │
│  │  (RLS)     │ │  (JWT/OAuth)│ │  (Subscriptions)│ │ (Arquivos)│  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Tecnologias Definidas

### Next.js (App Router)
- **Versão**: Latest stable (conforme package.json)
- **Renderização**: Server Components por padrão, Client Components quando necessário
- **Routing**: File-based routing no diretório `app/`
- **Server Actions**: Para mutações de dados (create, update, delete)
- **Middleware**: Para proteção de rotas e verificação de autenticação
- **TypeScript**: Strict mode habilitado

### Supabase
- **PostgreSQL**: Banco de dados relacional com Row Level Security (RLS)
- **Auth**: Autenticação baseada em JWT, suporte a OAuth (Google, GitHub, etc.), email/password, MFA
- **Realtime**: Subscriptions para atualizações em tempo real (opcional para dashboards)
- **Storage**: Para armazenamento de arquivos (comprovantes, relatórios exportados)
- **Edge Functions**: Para lógica complexa serverless (se necessário no futuro)

### Vercel
- **Deploy**: Contínuo via Git (main branch)
- **Edge Network**: Next.js otimizado para Edge Runtime
- **Environment Variables**: Gerenciadas no dashboard da Vercel
- **Preview Deployments**: Para PRs

## Autenticação

### Estratégia
- **Supabase Auth** como provedor de identidade
- **JWT** armazenado em cookies httpOnly (via middleware Next.js)
- **Session** validada no servidor a cada request sensível
- **Middleware** de proteção de rotas privadas

### Status de Implementação (Sprint 06 / 06.1)
- ✅ Integração Supabase Auth concluída via `@supabase/ssr` (clientes em `lib/supabase/`).
- ✅ Proteção de rotas ativa via `proxy.ts` (Next.js 16 — middleware renomeado): `/dashboard` bloqueia usuário não autenticado e redireciona para `/login?next=...`; usuário autenticado em `/login` é redirecionado para `/dashboard`.
- ✅ Login/logout via Server Actions (`app/actions/auth.ts`) com `useActionState`.
- ✅ Validação real de usuário autenticado realizada (login, sessão, dashboard, logout, bloqueio pós-logout).
- ✅ Reconhecimento de usuário funcional (perfil/status) preparado em `lib/auth/profile.ts` — **provisório**: lê de `user_metadata` até a tabela `usuarios` existir (Sprint 07).
- ✅ Variável de ambiente padronizada: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Publishable Key moderna; sem `SERVICE_ROLE_KEY`/anon legada).

### Fluxo de Login
1. Usuário acessa rota protegida
2. Middleware verifica cookie de sessão
3. Se válido: prossegue; se inválido/expirado: redireciona para `/login`
4. Login via Supabase Auth (email/senha ou OAuth)
5. Callback define cookies de sessão
6. Redireciona para dashboard apropriado

### Perfis e Autorização
- **Claims no JWT**: `role` (profissional_autorizador, recepcionista, gestor, auditor)
- **Metadados do usuário**: `profissao` (assistente_social, psicologo, terapeuta_ocupacional)
- **Verificação**: Middleware + RLS policies + Server Actions validation

**DECISÃO PENDENTE:** Estratégia de convite/criação de usuários (auto-cadastro, admin convida, SSO corporativo)

## Separação de Camadas

### UI Layer (`app/`, `components/`)
- **Server Components**: Busca de dados, renderização inicial
- **Client Components**: Interatividade, formulários, estado local
- **Responsabilidade**: Apresentação apenas, sem lógica de negócio

### Domain Services (`lib/domain/`)
- **Entidades de domínio**: Paciente, Liberacao, Retirada, Usuario, Vale
- **Value Objects**: TipoLiberacao, QuantidadeVale, PeriodoValidade
- **Domain Events**: LiberacaoCriada, RetiradaRegistrada, PacienteCadastrado
- **Regras de negócio puras**: Validações que não dependem de infraestrutura
- **Sem dependências** de Supabase, Next.js, ou qualquer framework

### Application Services / Use Cases (`lib/services/` ou `lib/use-cases/`)
- **Orquestração**: Coordenam domain services e persistence
- **Transações**: Gerenciam consistência entre múltiplas entidades
- **Autorização**: Verificam permissões antes de executar
- **Auditoria**: Disparam eventos de log automaticamente
- **Exemplos**: `CriarLiberacao`, `RegistrarRetirada`, `CadastrarPaciente`, `GerarRelatorio`

### Persistence Layer (`lib/persistence/` ou `lib/repositories/`)
- **Repositories**: Abstração sobre Supabase client
- **Mappers**: Conversão entre entidades de domínio e schemas do banco
- **Supabase Client**: Configurado com RLS, tipado com tipos gerados
- **Queries otimizadas**: Seleção de colunas, joins, filtros

## Princípios de Segurança

1. **Defesa em profundidade**: Validação no cliente, servidor, middleware e banco (RLS)
2. **Princípio do menor privilégio**: Usuários acessam apenas o necessário para seu papel
3. **RLS como princípio arquitetural**: Políticas no PostgreSQL garantem isolamento mesmo se API for burlada
4. **Dados sensíveis**: CPF, dados de saúde criptografados/hashed, nunca logados em plain text
5. **Auditoria imutável**: Logs append-only, não deletáveis, não alteráveis
6. **HTTPS only**: HSTS, cookies secure, same-site
7. **Content Security Policy**: Headers de segurança configurados
8. **Rate limiting**: Proteção contra brute force e abuso de API

## Fluxo Geral dos Dados

### Criação de Liberação
```
1. Profissional acessa "Nova Liberação" (UI)
2. Preenche: paciente, tipo (contínua/avulsa), quantidade (1/2/4/8), observações
3. Submit → Server Action `criarLiberacao`
4. Validações de domínio (paciente ativo, profissional autorizado, quantidade válida)
5. Repository: INSERT em `liberacoes` com RLS garantindo profissional = auth.uid()
6. Auditoria: INSERT em `auditoria_logs` (trigger ou service)
7. Retorno: sucesso + dados da liberação criada
8. UI: toast de sucesso, atualiza lista (React Query invalidate)
```

### Registro de Retirada
```
1. Recepcionista acessa "Retiradas" (UI)
2. Busca liberação ativa do paciente
3. Confere quantidade disponível (liberada - já retirada)
4. Registra: quantidade, observações
5. Submit → Server Action `registrarRetirada`
5. Validações: quantidade <= disponível, liberação válida
6. Repository: INSERT em `retiradas` + UPDATE em `liberacoes` (contador retirado)
7. Auditoria: log da retirada
8. Retorno: comprovante (opcional impressão)
```

### Consulta/Relatório
```
1. Gestor acessa "Relatórios" (UI)
2. Define filtros: período, profissional, paciente, tipo, quantidade
3. Submit → Server Action `gerarRelatorio` (ou Server Component com query direta)
4. Repository: Query agregada com filtros, joins necessários
5. Retorno: dados paginados/agregados
6. UI: Tabela, gráficos, botão exportar (futuro: PDF/Excel/CSV)
```

## Convenções de Código

### Estrutura de Diretórios (Proposta)
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Rotas de login, callback
│   ├── (dashboard)/       # Rotas protegidas
│   │   ├── liberacoes/
│   │   ├── retiradas/
│   │   ├── pacientes/
│   │   ├── relatorios/
│   │   └── auditoria/
│   ├── api/               # Apenas se necessário (webhooks, etc)
│   └── middleware.ts      # Proteção de rotas
├── components/            # Componentes React compartilhados
│   ├── ui/               # Primitivos (Button, Input, Table, Modal)
│   ├── forms/            # Formulários de domínio
│   └── layout/           # Header, Sidebar, Footer
├── lib/
│   ├── domain/           # Entidades, Value Objects, Domain Services, Events
│   ├── services/         # Use Cases / Application Services
│   ├── persistence/      # Repositories, Mappers, Supabase Client
│   ├── auth/             # Helpers de autenticação, permissões
│   ├── audit/            # Serviço de auditoria, helpers
│   ├── reports/          # Lógica de relatórios, agregações
│   └── utils/            # Utilitários genéricos
├── types/                # Tipos TypeScript compartilhados
└── styles/               # Globais, tokens de design
```

### Padrões
- **Server Actions** para mutações (não API Routes)
- **React Query / SWR** para data fetching no cliente
- **Zod** para validação de schemas (input/output)
- **Result Pattern** (Ok/Err) para tratamento de erros em services
- **Domain Events** para desacoplar auditoria e side effects

## O que NÃO foi Decidido (Não Inventar)

- Biblioteca de UI (shadcn/ui, Radix, Material, custom?)
- Gerenciamento de estado global (Context, Zustand, Jotai, Redux?)
- Form library (React Hook Form, Zod, Conform?)
- Testes (Vitest, Playwright, Jest, Testing Library?)
- Observabilidade (Sentry, LogRocket, Vercel Analytics?)
- CI/CD além do deploy Vercel (GitHub Actions, lint, typecheck, test?)
- Feature flags?
- Internacionalização (i18n)?
- PWA / Offline support?