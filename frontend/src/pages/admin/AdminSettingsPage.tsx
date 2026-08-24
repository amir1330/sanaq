import { SessionCard } from "../../components/SessionCard";
import { PageTitle } from "../../components/ui";

export function AdminSettingsPage() {
  return (
    <div>
      <PageTitle kicker="Кабинет" title="Настройки" hint="Имя, тема и выход — здесь, не в шапке." />
      <SessionCard />
    </div>
  );
}
