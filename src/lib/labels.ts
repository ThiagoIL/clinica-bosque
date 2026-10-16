import type {
  AccountType, AppointmentStatus, BillingMode, EngagementStatus, EntryKind, EntryStatus,
  PaymentMethod, Recurrence, RepeatEnd, ServiceKind, Sex, StockMovementType, UserRole,
} from "@/generated/prisma/enums";

export const sexLabels: Record<Sex, string> = { FEMALE: "Feminino", MALE: "Masculino", OTHER: "Outro" };

export const serviceKindLabels: Record<ServiceKind, string> = {
  CONSULTATION: "Consulta", RETURN: "Retorno", SESSION: "Sessão", THERAPY: "Terapia", EXAM: "Exame", OTHER: "Outro",
};

export const recurrenceLabels: Record<Recurrence, string> = {
  NONE: "Não repete (uma única sessão)",
  DAILY: "Todos os dias",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
};

export const repeatEndLabels: Record<RepeatEnd, string> = {
  COUNT: "Após uma quantidade de sessões",
  UNTIL_DATE: "Até uma data",
  UNTIL_MONTH: "Até um mês",
};

export const userRoleLabels: Record<UserRole, string> = { ADMIN: "Administrador", STAFF: "Atendimento" };

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Seg" }, { value: 2, label: "Ter" }, { value: 3, label: "Qua" }, { value: 4, label: "Qui" },
  { value: 5, label: "Sex" }, { value: 6, label: "Sáb" }, { value: 0, label: "Dom" },
];

export const billingModeLabels: Record<BillingMode, string> = {
  PER_SESSION: "Uma cobrança por sessão",
  SINGLE: "Cobrança única (pacote)",
  INSTALLMENTS: "Parcelado (mensal)",
};

export const engagementStatusLabels: Record<EngagementStatus, string> = {
  ACTIVE: "Ativo", COMPLETED: "Concluído", CANCELED: "Cancelado",
};

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado", CONFIRMED: "Confirmado", COMPLETED: "Realizado", CANCELED: "Cancelado", NO_SHOW: "Faltou",
};

export const entryStatusLabels: Record<EntryStatus, string> = {
  PENDING: "Em aberto", PAID: "Pago", CANCELED: "Cancelado",
};

export const entryKindLabels: Record<EntryKind, string> = { INCOME: "Receita", EXPENSE: "Despesa" };

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro", PIX: "Pix", DEBIT_CARD: "Cartão de débito", CREDIT_CARD: "Cartão de crédito",
  BANK_SLIP: "Boleto", TRANSFER: "Transferência", HEALTH_INSURANCE: "Convênio", OTHER: "Outro",
};

export const accountTypeLabels: Record<AccountType, string> = { CASH: "Caixa", BANK: "Conta bancária", OTHER: "Outro" };

export const stockMovementLabels: Record<StockMovementType, string> = {
  IN: "Entrada", OUT: "Saída", ADJUSTMENT: "Ajuste",
};

export const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export const optionsOf = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
