import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { RevisionWorkspace } from "../../components/RevisionsPanel";
import { Button, PageTitle } from "../../components/ui";
import { useT } from "../../i18n";
import { useAuth } from "../../store/auth";

export function StockRevisionPage() {
  const t = useT();
  const shopId = useAuth((s) => s.shopId)!;
  const { revisionId } = useParams();
  const id = Number(revisionId);
  const navigate = useNavigate();
  const revision = useQuery({
    queryKey: ["stock-revision", shopId, id],
    queryFn: () => api.stockRevision(shopId, id),
    enabled: Number.isFinite(id),
  });

  if (revision.isError) {
    return (
      <div>
        <PageTitle kicker={t("stock.revKicker")} title={t("stock.revMissing")} />
        <Button variant="quiet" onClick={() => navigate("/owner/stock/revisions")}>
          {t("stock.toRecounts")}
        </Button>
      </div>
    );
  }

  if (!revision.data) {
    return (
      <div>
        <PageTitle kicker={t("stock.revKicker")} title={t("stock.revision")} hint={t("stock.revLoading")} />
      </div>
    );
  }

  const draft = revision.data.status === "draft";

  return (
    <div>
      <PageTitle
        kicker={t("stock.revKicker")}
        title={`${t("stock.revision")} #${revision.data.id}`}
        hint={draft ? t("stock.revDraftHint") : t("stock.revDoneHint")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/owner/stock/revisions">
              <Button variant="quiet">{t("stock.allRecounts")}</Button>
            </Link>
            <Link to="/owner/stock">
              <Button variant="quiet">{t("stock.toStock")}</Button>
            </Link>
          </div>
        }
      />
      <RevisionWorkspace
        key={`${revision.data.id}-${revision.data.status}-${revision.data.counted_count}`}
        shopId={shopId}
        revision={revision.data}
      />
    </div>
  );
}
