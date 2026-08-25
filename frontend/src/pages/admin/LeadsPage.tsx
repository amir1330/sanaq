import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Empty, PageTitle } from "../../components/ui";
import { useLocale, useT } from "../../i18n";
import { dateLocaleTag } from "../../lib/i18nName";
import { useAuthSessionReady } from "../../store/auth";
import type { Lead, LeadStatus } from "../../types";
import { AdminLoadError } from "./adminUi";

export function LeadsPage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const dateTag = dateLocaleTag(locale);
  const qc = useQueryClient();
  const sessionReady = useAuthSessionReady();
  const leads = useQuery({
    queryKey: ["admin-leads"],
    queryFn: api.adminLeads,
    enabled: sessionReady,
  });
  const patch = useMutation({
    mutationFn: ({ id, status }: { id: number; status: LeadStatus }) => api.patchLead(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-leads"] }),
  });

  const statusLabel = (status: LeadStatus) => {
    if (status === "new") return t("admin.stNew");
    if (status === "contacted") return t("admin.stContacted");
    return t("admin.stClosed");
  };

  const list = leads.data ?? [];
  const fresh = list.filter((l) => l.status === "new").length;

  return (
    <div>
      <PageTitle kicker={t("admin.leadsKicker")} title={t("admin.leadsTitle")} hint={t("admin.leadsHint")} />
      <Card className="mb-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-faint">{t("admin.newCount")}</p>
        <p className="mt-2 font-mono text-3xl text-ink">
          {!sessionReady || leads.isLoading ? "…" : fresh}
        </p>
      </Card>
      {leads.isError && (
        <AdminLoadError message={(leads.error as Error).message || t("admin.loadLeadsFail")} />
      )}
      {!sessionReady || leads.isLoading ? (
        <Card>
          <p className="text-sm text-mute">{t("admin.loadingLeads")}</p>
        </Card>
      ) : list.length === 0 ? (
        <Empty>{t("admin.noLeads")}</Empty>
      ) : (
        <div className="border border-line">
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3">{t("admin.colPoint")}</th>
                <th>{t("admin.colContact")}</th>
                <th>{t("admin.colComment")}</th>
                <th>{t("admin.colLeadStatus")}</th>
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
                      {new Date(lead.created_at).toLocaleString(dateTag)}
                    </p>
                  </td>
                  <td className="py-3">
                    <p>{lead.contact_name}</p>
                    <p>{lead.phone}</p>
                    {lead.email && <p className="text-mute">{lead.email}</p>}
                  </td>
                  <td className="max-w-xs py-3 text-mute">{lead.comment || t("common.none")}</td>
                  <td className="py-3">{statusLabel(lead.status)}</td>
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
  const t = useT();
  if (lead.status === "new") {
    return (
      <Button variant="foam" onClick={() => onPatch({ id: lead.id, status: "contacted" })}>
        {t("admin.contacted")}
      </Button>
    );
  }
  if (lead.status === "contacted") {
    return (
      <Button variant="ghost" onClick={() => onPatch({ id: lead.id, status: "closed" })}>
        {t("common.close")}
      </Button>
    );
  }
  return (
    <button className="underline" onClick={() => onPatch({ id: lead.id, status: "new" })}>
      {t("admin.reopen")}
    </button>
  );
}
