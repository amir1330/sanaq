import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { RevisionWorkspace } from "../../components/RevisionsPanel";
import { Button, PageTitle } from "../../components/ui";
import { useAuth } from "../../store/auth";

export function StockRevisionPage() {
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
        <PageTitle kicker="Склад" title="Ревизия не найдена" />
        <Button variant="quiet" onClick={() => navigate("/owner/stock/revisions")}>
          К пересчётам
        </Button>
      </div>
    );
  }

  if (!revision.data) {
    return (
      <div>
        <PageTitle kicker="Склад" title="Ревизия" hint="Открываем снимок…" />
      </div>
    );
  }

  const draft = revision.data.status === "draft";

  return (
    <div>
      <PageTitle
        kicker="Склад"
        title={draft ? `Ревизия №${revision.data.id}` : `Ревизия №${revision.data.id}`}
        hint={
          draft
            ? "Отдельное окно пересчёта. Касса стоит, пока не проведёшь или не отменишь."
            : "Готовый акт. Можно скачать Excel."
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/owner/stock/revisions">
              <Button variant="quiet">Все пересчёты</Button>
            </Link>
            <Link to="/owner/stock">
              <Button variant="quiet">К остаткам</Button>
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
