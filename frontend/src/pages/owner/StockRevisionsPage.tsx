import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { RevisionsHistory } from "../../components/RevisionsPanel";
import { StockHubNav } from "../../components/StockHubNav";
import { Button, Card, PageTitle } from "../../components/ui";
import { useT } from "../../i18n";
import { useAuth } from "../../store/auth";

export function StockRevisionsPage() {
  const t = useT();
  const shopId = useAuth((s) => s.shopId)!;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["stock-revisions", shopId],
    queryFn: () => api.stockRevisions(shopId),
  });
  const draft = (list.data ?? []).find((r) => r.status === "draft") ?? null;

  const start = useMutation({
    mutationFn: () => api.createStockRevision(shopId),
    onSuccess: (rev) => {
      void qc.invalidateQueries({ queryKey: ["stock-revisions", shopId] });
      void qc.invalidateQueries({ queryKey: ["shift", shopId] });
      navigate(`/owner/stock/revisions/${rev.id}`);
    },
  });

  return (
    <div>
      <PageTitle
        kicker={t("stock.kicker")}
        title={t("stock.revTitle")}
        hint={t("stock.revHint")}
        action={
          <div className="flex flex-wrap gap-2">
            {draft ? (
              <Button onClick={() => navigate(`/owner/stock/revisions/${draft.id}`)}>
                {t("stock.openRevN", { id: draft.id })}
              </Button>
            ) : (
              <Button onClick={() => start.mutate()} disabled={start.isPending}>
                {t("stock.newRev")}
              </Button>
            )}
          </div>
        }
      />
      <StockHubNav />
      {start.isError && <p className="mb-4 text-sm text-alert">{(start.error as Error).message}</p>}
      {draft && (
        <Card className="mb-5 border border-maroon/30 bg-maroon/5">
          <p className="font-medium text-maroon">{t("stock.revRunning", { id: draft.id })}</p>
          <p className="mt-1 text-sm text-mute">{t("stock.revRunningHint")}</p>
          <Button className="mt-3" onClick={() => navigate(`/owner/stock/revisions/${draft.id}`)}>
            {t("common.continue")}
          </Button>
        </Card>
      )}
      <RevisionsHistory shopId={shopId} />
    </div>
  );
}
