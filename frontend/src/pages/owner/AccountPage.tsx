import { SessionCard } from "../../components/SessionCard";
import { PageTitle } from "../../components/ui";
import { useT } from "../../i18n";

export function AccountPage() {
  const t = useT();

  return (
    <div>
      <PageTitle kicker={t("nav.account")} title={t("account.title")} hint={t("account.pageHint")} />
      <SessionCard />
    </div>
  );
}
