import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Brand } from "../components/Mark";
import { SkipLink } from "../components/SkipLink";
import { Button, Field, Input } from "../components/ui";
import { useT } from "../i18n";
import { homePath, useAuth } from "../store/auth";

export function LoginPage() {
  const t = useT();
  const { user, setSession } = useAuth();
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (user) return <Navigate to={homePath(user.role)} replace />;

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const pair = await api.login(login.trim(), password);
      setSession(pair.access_token, pair.refresh_token, pair.user);
      navigate(homePath(pair.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.fail"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-2">
      <SkipLink />
      <aside className="hidden border-r border-line bg-paper-2 px-10 py-12 md:flex md:flex-col md:justify-between">
        <Link to="/">
          <Brand className="text-[18px]" markClass="h-[18px] w-[26px]" />
        </Link>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">{t("login.kicker")}</p>
          <h1 className="mt-4 max-w-[12ch] font-display text-[40px] font-medium leading-tight tracking-tight text-ink">
            {t("login.title")}
          </h1>
          <hr className="perforation-h mt-8 max-w-xs" />
          <p className="mt-4 max-w-[30ch] text-sm leading-relaxed text-ink-soft">{t("login.blurb")}</p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Sanaq</p>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-line px-6 py-5 md:hidden">
          <Link to="/">
            <Brand className="text-[17px]" />
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div id="main-content" className="w-full max-w-[400px] page-enter">
            <div className="md:hidden">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">{t("login.kicker")}</p>
              <h1 className="mt-3 font-display text-[32px] font-medium leading-tight">{t("login.title")}</h1>
            </div>

            <form onSubmit={(e) => void signIn(e)} className="mt-8 space-y-5 md:mt-0">
              <Field label={t("login.fieldLogin")}>
                <Input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
              </Field>
              <Field label={t("login.fieldPassword")}>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </Field>
              {error && <p className="text-sm text-maroon">{error}</p>}
              <Button className="w-full" size="lg" disabled={pending || !login || !password}>
                {pending ? t("login.submitting") : t("login.submit")}
              </Button>
            </form>

            <p className="mt-8 text-center text-[13px] text-ink-soft">
              <Link to="/" className="hover:text-ink">
                ← {t("login.backHome")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
