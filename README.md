# Clínica Bosque — sistema de gestão

Sistema web para uma clínica (instalação única, sem multi-tenant): cadastro de pacientes e profissionais,
lançamento de consultas/sessões/terapias com agendamento recorrente, agenda com filtros, financeiro
(contas a receber, contas a pagar, extrato e fluxo de caixa) e controle de estoque.

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · PostgreSQL · Prisma 7 · Tailwind CSS 4.

## Módulos

Nas listas, a linha tem apenas o botão **Editar** (ou clique no nome). A exclusão fica dentro da tela de edição.

| Módulo | O que faz |
| --- | --- |
| **Pacientes** | Prontuário em abas, com foto do paciente e painel de sessões (próxima, presentes, ausentes, canceladas): **Cadastro** (dados pessoais, plano e carteirinha, familiar/responsável), **Anamnese** (ficha completa de avaliação), **Sessões** (atendimentos e as evoluções de todos os profissionais), **Financeiro** (pacotes, cobranças, pagamentos e dados de cobrança) e **Documentos** (anexos). |
| **Profissionais** | Médicos/terapeutas, com especialidade (do cadastro), data de nascimento e cor própria na agenda (paleta pronta ou cor personalizada). Podem ser excluídos enquanto não tiverem atendimentos; depois disso, apenas desativados. |
| **Especialidades** | Cadastro usado no cadastro do profissional e nos filtros da agenda e dos lançamentos. |
| **Serviços** | Catálogo de serviços e duração. Podem ser excluídos enquanto não foram usados em lançamentos. |
| **Planos de saúde e tabela de preços** | Cadastro de convênios (o plano **Particular** sempre existe) e uma tabela de preços por plano para serviços e produtos, com opção de copiar de outro plano com ajuste percentual. O paciente tem um plano e o valor do lançamento é sugerido pela tabela. |
| **Lançamentos** | Seleciona paciente, profissional, tipo do atendimento (consulta, retorno ou sessão), serviço, valor e a repetição (diária, semanal, quinzenal, mensal) com **dias da semana** à escolha e término por **quantidade de sessões, data ou mês**. Gera todos os agendamentos e o financeiro (por sessão, pacote único ou parcelado). Pode ser **editado** ou **excluído** direto da lista (exclusão barrada quando há cobrança paga: nesse caso, cancele o lançamento). |
| **Agenda** | Visões dia/semana/mês; filtros por especialidade, profissional e paciente (busca por nome). Ao clicar em um atendimento: informar a situação (agendamento confirmado, paciente presente, paciente ausente, paciente cancelou, profissional cancelou), reagendar, ir para o atendimento ou para o paciente. |
| **Atendimento** | Tela do profissional: só os atendimentos do usuário logado (o usuário precisa estar vinculado a um profissional em *Usuários*), por dia, com a situação e a **evolução** de cada atendimento. As evoluções aparecem na aba Sessões do paciente. Faz parte do módulo Agenda. |
| **Financeiro** | Contas a receber e a pagar (com parcelamento e baixa), extrato por conta com saldo corrido e fluxo de caixa (realizado × previsto). |
| **Colaboradores e contratos** | Cadastro de colaboradores/fornecedores (favorecidos das contas a pagar; um profissional pode ser ligado ao seu cadastro de colaborador) e **gestão de contratos**: ativos, a vencer, vencidos e encerrados, com **anexos** (PDF, imagens, Word, Excel…). O painel inicial avisa dos contratos que vencem em 30 dias. |
| **Estoque** | Itens, saldo mínimo, entradas/saídas/ajustes; compra pode gerar conta a pagar. **Desligado por padrão**: só aparece se o fornecedor liberar o módulo. |
| **Usuários e perfis de acesso** | O *Administrador da empresa* tem acesso total aos módulos liberados e gerencia usuários. Os demais usuários seguem um **perfil de acesso**, que define por módulo: sem acesso, *Consulta* (só vê) ou *Edita*. Cada usuário altera a própria senha em *Minha conta*. |

### Console do fornecedor

Área restrita, com login próprio e separado dos usuários da clínica, em um **caminho do mesmo domínio**:
`https://seu-dominio/sistema-admin` (configurável em `PLATFORM_ADMIN_PATH`; escolha algo pouco óbvio).
Não precisa de domínio nem certificado extras. Opcionalmente também pode responder em domínio(s) dedicado(s)
(`PLATFORM_ADMIN_HOSTS`).

- **Bloquear / liberar o sistema** (ex.: falta de pagamento), com mensagem exibida à clínica. O bloqueio vale em
  poucos segundos para quem já está logado, e o console continua acessível para você liberar.
- **Módulos liberados**: o fornecedor escolhe quais módulos aparecem. O que ele desliga some para todos, inclusive
  para o administrador da empresa (os dados são mantidos). O administrador da empresa distribui, entre os módulos
  liberados, o acesso de cada perfil.
- **Usuários da administração**: mais de uma pessoa pode acessar o console (criar, editar, redefinir senha e desativar).
- Histórico de bloqueios, liberações, mudanças de módulos e de usuários.

O caminho interno do console não existe fora dele (retorna 404), o cookie do console só é enviado a esse caminho
e as sessões do console e da clínica não se misturam.

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
| `PLATFORM_ADMIN_PATH` | Caminho do console do fornecedor no domínio da clínica. Padrão `/sistema-admin`; `off` desativa. |
| `PLATFORM_ADMIN_HOSTS` | (Opcional) Domínio(s) dedicado(s) ao console, separados por vírgula. |
| `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD`, `PLATFORM_ADMIN_NAME` | Conta do fornecedor, criada no primeiro start (só se ainda não existir nenhuma). Troque a senha em *Minha conta* do console. |
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
   O **console do fornecedor** usa o mesmo domínio, em `/sistema-admin` (ou o caminho de `PLATFORM_ADMIN_PATH`),
   com as variáveis `PLATFORM_ADMIN_*`. Não é preciso criar outro domínio.
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

- Bloqueio automático por data de vencimento da mensalidade (hoje o bloqueio é manual, no console).
- Venda de produtos nos lançamentos (os preços de produtos já ficam na tabela de preços).
- Relatórios (produção por profissional, inadimplência) e exportação CSV.
- Lembretes de consulta por WhatsApp/e-mail e portal do paciente.
- Prontuário/evolução clínica com anexos.
