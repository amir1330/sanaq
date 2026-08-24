import { Link } from "react-router-dom";
import { RevisionsPanel } from "../../components/RevisionsPanel";
import { Button, PageTitle } from "../../components/ui";
import { useAuth } from "../../store/auth";

export function StockRevisionsPage() {
  const shopId = useAuth((s) => s.shopId)!;
  return (
    <div>
      <PageTitle
        kicker="Склад"
        title="Пересчёты"
        hint="Колонка «Система» — живой остаток. Δ — сколько не хватает на полке сверх чеков. Новую ревизию запускай со страницы Остатки."
        action={
          <Link to="/owner/stock">
            <Button variant="quiet">К остаткам</Button>
          </Link>
        }
      />
      <RevisionsPanel shopId={shopId} part="history" />
    </div>
  );
}
