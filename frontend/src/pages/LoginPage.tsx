import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Brand } from "../components/Mark";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button, Field, Input } from "../components/ui";
import { homePath, useAuth } from "../store/auth";

export function LoginPage() {
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
      const pair = await api.login(login, password);
      setSession(pair.access_token, pair.refresh_token, pair.user);
      navigate(homePath(pair.user.role));
    } catch {
      setError("Неверный логин или пароль");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between px-6 py-7 md:px-14">
        <Link to="/">
          <Brand />
        </Link>
        <ThemeToggle />
      </header>
      <div className="mx-auto max-w-[420px] px-6 pt-16">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-maroon">Кабинет</p>
        <h1 className="mt-3 font-display text-[40px] font-normal">Вход</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          Почта или телефон и пароль, который выдал владелец.
        </p>
        <form onSubmit={(e) => void signIn(e)} className="mt-10 space-y-6">
          <Field label="Почта или телефон">
            <Input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
          </Field>
          <Field label="Пароль">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error && <p className="text-sm text-alert">{error}</p>}
          <Button className="w-full" size="lg" disabled={pending || !login || !password}>
            {pending ? "Входим…" : "Войти"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-mute">
          Общий планшет на стойке —{" "}
          <Link to="/pin" className="text-ink underline">
            вход по PIN
          </Link>
        </p>
      </div>
    </div>
  );
}
