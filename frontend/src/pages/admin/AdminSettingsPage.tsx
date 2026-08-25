import { SessionCard } from "../../components/SessionCard";
import { PageTitle } from "../../components/ui";
import { useT } from "../../i18n";

export function AdminSettingsPage() {
  const t = useT();
  return (
    <div>
      <PageTitle kicker={t("settings.kicker")} title={t("settings.title")} hint={t("settings.hint")} />
      <SessionCard />
    </div>
  );
}
