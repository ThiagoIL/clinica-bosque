# Clínica Bosque — sistema de gestão

Sistema web para uma clínica (instalação única, sem multi-tenant): cadastro de pacientes e profissionais,
lançamento de consultas/sessões/terapias com agendamento recorrente, agenda com filtros, financeiro
(contas a receber, contas a pagar, extrato e fluxo de caixa) e controle de estoque.

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · PostgreSQL · Prisma 7 · Tailwind CSS 4.

## Módulos

| Módulo | O que faz |
| --- | --- |
| **Pacientes** | Cadastro por seções: dados do paciente, familiar/responsável, saúde, financeiro e observações (+ histórico de anotações). |
| **Profissionais** | Médicos/terapeutas, com cor própria na agenda. |
| **Serviços** | Catálogo de consulta, sessão e terapia com valor e duração padrão. |
| **Lançamentos** | Seleciona paciente, profissional, serviço, quantidade e valor. Repetição diária, semanal, quinzenal ou mensal gera todos os agendamentos e o financeiro (por sessão, pacote único ou parcelado). |
| **Agenda** | Visões dia/semana/mês; filtros por profissional e paciente; confirmar, marcar realizado/faltou, cancelar e reagendar. |
| **Financeiro** | Contas a receber e a pagar (com parcelamento e baixa), extrato por conta com saldo corrido e fluxo de caixa (realizado × previsto). |
| **Estoque** | Itens, saldo mínimo, entradas/saídas/ajustes; compra pode gerar conta a pagar. |

### Regras importantes

- **Sem conflito de horário:** um profissional não pode ter dois atendimentos sobrepostos, nem o mesmo paciente.
  A validação acontece na aplicação (com mensagem clara indicando o conflito) **e** no banco, por constraints de
  exclusão (`btree_gist`), então nem requisições simultâneas conseguem furar a regra.
- Valores monetários são guardados em **centavos** (inteiros); datas/horas no fuso `America/Sao_Paulo`.
- Cancelar um atendimento cancela a cobrança pendente dele; cancelar um lançamento cancela atendimentos futuros e cobranças em aberto.
- Estoque nunca fica negativo (a baixa é atômica no banco).

## Rodando localmente

Pré-requisitos: Node 22+ e um PostgreSQL (o `docker-compose.yml` sobe um).

```bash
cp .env.example .env            # ajuste DATABASE_URL, AUTH_SECRET e ADMIN_*
docker compose up -d db         # ou use um Postgres seu
npm install
npx prisma migrate deploy       # aplica as migrations
npm run db:seed                 # (opcional) dados de demonstração
npm run dev                     # http://localhost:3000
```

No primeiro start, o app cria automaticamente o administrador (`ADMIN_EMAIL` / `ADMIN_PASSWORD`),
as categorias financeiras padrão e a conta "Caixa" — só quando ainda não há usuários.

Scripts úteis: `npm run lint` (checagem de tipos), `npm run build`, `npm run db:migrate` (criar migration em dev),
`npm run db:studio`.

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | String de conexão do PostgreSQL. |
| `AUTH_SECRET` | Segredo da sessão (mín. 32 caracteres). Gere com `openssl rand -base64 48`. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Administrador inicial (usado só quando não há usuários). |
| `TZ` | Fuso horário do servidor (`America/Sao_Paulo`). |

## Deploy no Easypanel

1. **Banco:** no projeto, crie um serviço **Postgres** (versão 15+). Anote o host interno, usuário, senha e nome do banco.
2. **App:** crie um serviço do tipo **App** a partir do repositório Git (branch `main`) com **Build → Dockerfile**
   (o `Dockerfile` está na raiz). Porta do container: **3000**.
3. **Variáveis de ambiente** do app:
   ```
   DATABASE_URL=postgresql://USUARIO:SENHA@HOST_INTERNO:5432/NOME_DO_BANCO
   AUTH_SECRET=<valor aleatório com 32+ caracteres>
   ADMIN_NAME=Administrador
   ADMIN_EMAIL=<e-mail do administrador>
   ADMIN_PASSWORD=<senha forte>
   TZ=America/Sao_Paulo
   ```
4. **Domínio/HTTPS:** adicione o domínio na aba *Domains* do serviço (o Easypanel emite o certificado).
5. **Deploy.** A cada start o container aplica as migrations pendentes (`prisma migrate deploy`) antes de subir o servidor.
   O endpoint `GET /api/health` serve para o health check.
6. **Backups:** habilite os backups do serviço Postgres no Easypanel (ou agende `pg_dump`). Os dados clínicos
   e financeiros ficam todos no banco.

> Troque a senha do administrador depois do primeiro acesso e mantenha `AUTH_SECRET` e `ADMIN_PASSWORD`
> fora do repositório (apenas nas variáveis de ambiente do Easypanel).

## Estrutura

```
prisma/            schema, migrations (inclui a guarda de sobreposição) e seed
src/app/(app)/     telas autenticadas (agenda, pacientes, financeiro, estoque…)
src/app/login/     autenticação
src/lib/           banco, auth, datas, dinheiro, validação, agendamento
src/components/    componentes de UI
src/proxy.ts       barreira de acesso (redireciona para /login sem sessão)
```

## Próximos passos sugeridos

- Gestão de múltiplos usuários/perfis (hoje há um administrador criado pelo ambiente).
- Relatórios (produção por profissional, inadimplência) e exportação CSV.
- Lembretes de consulta por WhatsApp/e-mail e portal do paciente.
- Prontuário/evolução clínica com anexos.
