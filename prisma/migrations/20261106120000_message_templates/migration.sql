-- Modelos de mensagem do WhatsApp (Cadastros > Mensagens).
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageTemplate_name_key" ON "MessageTemplate"("name");

-- Modelos iniciais (a clínica pode editar, desativar ou excluir). O primeiro é o que a agenda já enviava.
INSERT INTO "MessageTemplate" ("id", "name", "body", "isDefault", "updatedAt") VALUES
('msgtpl_lembrete', 'Lembrete de consulta',
'Olá, {primeiro_nome}! Aqui é da {clinica}.

Passando para lembrar da sua consulta:
📅 Data: {dia_semana}, {data}
🕒 Horário: {horario}
🩺 Atendimento: {servico}
👨‍⚕️ Profissional: {profissional}

Por favor, confirme sua presença respondendo esta mensagem. Se não puder comparecer, avise com antecedência para reagendarmos.',
true, CURRENT_TIMESTAMP),
('msgtpl_reagendamento', 'Aviso de reagendamento',
'Olá, {primeiro_nome}! Aqui é da {clinica}.

Precisamos reagendar o seu atendimento. O novo horário é:
📅 Data: {dia_semana}, {data}
🕒 Horário: {horario}
🩺 Atendimento: {servico}
👨‍⚕️ Profissional: {profissional}

Esse horário é bom para você? Se preferir outro, é só responder esta mensagem.',
false, CURRENT_TIMESTAMP),
('msgtpl_cancelamento', 'Aviso de cancelamento',
'Olá, {primeiro_nome}! Aqui é da {clinica}.

Precisamos cancelar o atendimento de {dia_semana}, {data}, às {horario}, com {profissional}. Pedimos desculpas pelo transtorno.

Responda esta mensagem para escolhermos um novo horário.',
false, CURRENT_TIMESTAMP);
