import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { ageFromBirth } from "@/lib/dates";
import { formatPhone } from "@/lib/cpf";
import {
  Badge, EmptyState, FilterBar, FilterField, LinkButton, PageHeader, Pagination, param,
} from "@/components/ui/primitives";

export const metadata = { title: "Pacientes" };
const PAGE_SIZE = 20;

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = param(sp.q)?.trim() ?? "";
  const status = param(sp.status) ?? "active";
  const page = Math.max(1, Number(param(sp.page)) || 1);
  const digits = q.replace(/\D/g, "");

  const where = {
    ...(status === "active" ? { active: true } : status === "inactive" ? { active: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { socialName: { contains: q, mode: "insensitive" as const } },
            ...(digits ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }] : []),
          ],
        }
      : {}),
  };

  const [patients, total] = await Promise.all([
    db.patient.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { healthPlan: { select: { name: true } } } }),
    db.patient.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Pacientes"
        description="Cadastro completo dos pacientes da clínica."
        actions={
          <LinkButton href="/pacientes/novo">
            <Plus className="size-4" /> Novo paciente
          </LinkButton>
        }
      />

      <FilterBar action="/pacientes">
        <FilterField label="Buscar (nome, CPF ou telefone)" className="min-w-64 flex-1">
          <input name="q" defaultValue={q} className="input" placeholder="Digite para buscar…" />
        </FilterField>
        <FilterField label="Situação">
          <select name="status" defaultValue={status} className="input">
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="all">Todos</option>
          </select>
        </FilterField>
      </FilterBar>

      {patients.length === 0 ? (
        <EmptyState
          title="Nenhum paciente encontrado"
          description="Cadastre o primeiro paciente ou ajuste os filtros."
          action={<LinkButton href="/pacientes/novo">Novo paciente</LinkButton>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Idade</th>
                <th>Telefone</th>
                <th>Plano</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/pacientes/${p.id}`} className="font-medium text-brand-800 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td>{ageFromBirth(p.birthDate) ?? "—"}</td>
                  <td>{formatPhone(p.phone) || "—"}</td>
                  <td>{p.healthPlan?.name ?? "—"}</td>
                  <td>{p.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                  <td className="text-right">
                    <Link href={`/pacientes/${p.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/pacientes" params={{ q, status }} />
    </>
  );
}
