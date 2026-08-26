import { useNavigate } from "react-router-dom";
import { useLocale, useT, type LocalePreference } from "../i18n";
import { useAuth } from "../store/auth";
import { useTheme, type ThemePreference } from "../store/theme";
import { Button, Card } from "./ui";

export function SessionCard() {
  const t = useT();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const preference = useTheme((s) => s.preference);
  const setPreference = useTheme((s) => s.setPreference);
  const localePreference = useLocale((s) => s.preference);
  const setLocalePreference = useLocale((s) => s.setPreference);

  const themes: { id: ThemePreference; label: string; note: string }[] = [
    { id: "auto", label: t("account.themeAuto"), note: t("account.themeAutoNote") },
    { id: "light", label: t("account.themeLight"), note: t("account.themeLightNote") },
    { id: "dark", label: t("account.themeDark"), note: t("account.themeDarkNote") },
  ];

  const languages: { id: LocalePreference; label: string }[] = [
    { id: "auto", label: t("account.languageAuto") },
    { id: "kk", label: t("account.languageKk") },
    { id: "ru", label: t("account.languageRu") },
    { id: "en", label: t("account.languageEn") },
  ];

  return (
    <Card className="mb-4">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">
        {t("account.title")}
      </p>
      <p className="mt-1 font-display text-2xl font-normal">{user?.full_name}</p>
      {user?.email && <p className="mt-1 text-sm text-mute">{user.email}</p>}

      <p className="mt-5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
        {t("account.language")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {languages.map((c) => (
          <Button
            key={c.id}
            variant={localePreference === c.id ? "primary" : "quiet"}
            onClick={() => setLocalePreference(c.id)}
          >
            {c.label}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-[12.5px] text-mute">{t("account.languageAutoNote")}</p>

      <p className="mt-5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
        {t("account.theme")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {themes.map((c) => (
          <Button
            key={c.id}
            variant={preference === c.id ? "primary" : "quiet"}
            onClick={() => setPreference(c.id)}
          >
            {c.label}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-[12.5px] text-mute">
        {themes.find((c) => c.id === preference)?.note}
      </p>

      <div className="mt-5">
        <Button
          variant="ghost"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          {t("account.logout")}
        </Button>
      </div>
    </Card>
  );
}
