import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Empty, PageTitle } from "../../components/ui";
import type { Lead, LeadStatus } from "../../types";

const labels: Record<LeadStatus, string> = {
  new: "новая",
  contacted: "связались",
  closed: "закрыта",
};

export function LeadsPage() {
  const qc = useQueryClient();
  const leads = useQuery({ queryKey: ["admin-leads"], queryFn: api.adminLeads });
  const patch = useMutation({
    mutationFn: ({ id, status }: { id: number; status: LeadStatus }) => api.patchLead(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-leads"] }),
  });

  const list = leads.data ?? [];
  const fresh = list.filter((l) => l.status === "new").length;

  return (
    <div>
      <PageTitle
        kicker="Продажи"
        title="Заявки"
        hint="С лендинга. Пока без оплаты — человек просит завести кофейню. Потом создаёшь точку во вкладке «Кофейни»."
      />
      <Card className="mb-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink/45">Новых</p>
        <p className="mt-2 font-mono text-3xl">{fresh}</p>
      </Card>
      {list.length === 0 ? (
        <Empty>Заявок ещё нет. Они появятся, когда кто-то заполнит форму на главной.</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg bg-foam">
          <table className="w-full text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-wider text-ink/45">
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3">Кофейня</th>
                <th>Контакт</th>
                <th>Комментарий</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((lead) => (
                <tr key={lead.id} className="border-b border-ink/5 align-top">
                  <td className="px-4 py-3">
                    <p>{lead.shop_name}</p>
                    <p className="text-mute">{lead.city}</p>
                    <p className="mt-1 font-mono text-[11px] text-mute">
                      {new Date(lead.created_at).toLocaleString("ru-RU")}
                    </p>
                  </td>
                  <td className="py-3">
                    <p>{lead.contact_name}</p>
                    <p>{lead.phone}</p>
                    {lead.email && <p className="text-mute">{lead.email}</p>}
                  </td>
                  <td className="max-w-xs py-3 text-mute">{lead.comment || "—"}</td>
                  <td className="py-3">{labels[lead.status]}</td>
                  <td className="px-4 py-3 text-right">
                    <LeadActions lead={lead} onPatch={patch.mutate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LeadActions({
  lead,
  onPatch,
}: {
  lead: Lead;
  onPatch: (args: { id: number; status: LeadStatus }) => void;
}) {
  if (lead.status === "new") {
    return (
      <Button variant="foam" onClick={() => onPatch({ id: lead.id, status: "contacted" })}>
        Связались
      </Button>
    );
  }
  if (lead.status === "contacted") {
    return (
      <Button variant="ghost" onClick={() => onPatch({ id: lead.id, status: "closed" })}>
        Закрыть
      </Button>
    );
  }
  return (
    <button className="underline" onClick={() => onPatch({ id: lead.id, status: "new" })}>
      Вернуть
    </button>
  );
}
