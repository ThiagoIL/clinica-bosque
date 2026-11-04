import { db } from "@/lib/db";
import { Card, EmptyState, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { ContractForm } from "../contract-form";

export const metadata = { title: "Novo contrato" };

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const professionals = await db.professional.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        title="Novo contrato"
        description="Anexe o contrato assinado já no cadastro (opcional); também é possível anexar depois."
        back={{ href: "/contratos", label: "Contratos" }}
      />
      {professionals.length === 0 ? (
        <EmptyState
          title="Cadastre um profissional ou fornecedor primeiro"
          description="Todo contrato pertence a um cadastro de Profissionais (desmarque “Atende pacientes” para fornecedores e prestadores)."
          action={<LinkButton href="/profissionais?edit=new">Novo profissional / fornecedor</LinkButton>}
        />
      ) : (
        <Card>
          <ContractForm professionals={professionals} defaultProfessionalId={param((await searchParams).professional)} />
        </Card>
      )}
    </>
  );
}
