import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Button, Field, Input } from "../components/ui";
import { homePath, useAuth } from "../store/auth";

const demos = [
  {
    key: "admin",
    role: "Админ системы",
    name: "Все кофейни",
    login: "admin@coffeeos.local",
    password: "admin123",
    goes: "Создать точку, включить/выключить, завести владельца",
  },
  {
    key: "owner",
    role: "Владелец",
    name: "Erassyl",
    login: "owner@erassyl.local",
    password: "owner123",
    goes: "Деньги, меню, склад, сотрудники",
  },
  {
    key: "barista",
    role: "Касса",
    name: "Amina",
    login: "barista@erassyl.local",
    password: "barista123",
    goes: "Продажи. На планшете удобнее PIN 1234",
  },
] as const;

export function LoginPage() {
  const { user, setSession, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const demoKey = params.get("demo");
  const autoStarted = useRef(false);

  async function signIn(nextLogin: string, nextPassword: string, label = "form") {
    setPending(label);
    setError("");
    try {
      const pair = await api.login(nextLogin, nextPassword);
      setSession(pair.access_token, pair.refresh_token, pair.user);
      navigate(homePath(pair.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный логин или пароль");
    } finally {
      setPending(null);
    }
  }

  useEffect(() => {
    const demo = demos.find((d) => d.key === demoKey);
    if (!demo || autoStarted.current) return;
    autoStarted.current = true;
    if (user?.email === demo.login) {
      navigate(homePath(user.role), { replace: true });
      return;
    }
    logout();
    void signIn(demo.login, demo.password, demo.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoKey]);

  if (user && !demoKey) return <Navigate to={homePath(user.role)} replace />;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-14">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
        <Link to="/" className="hover:text-ink">
          CoffeeOS
        </Link>
      </p>
      <h1 className="mt-3 text-5xl font-medium tracking-tight">Вход</h1>
      <p className="mt-3 max-w-xl text-sm text-mute">
        Выбери роль — откроется нужный экран. Или войди своим логином.
      </p>

      <div className="mt-10 grid gap-px bg-line md:grid-cols-3">
        {demos.map((demo) => (
          <button
            key={demo.key}
            type="button"
            disabled={pending !== null}
            onClick={() => void signIn(demo.login, demo.password, demo.key)}
            className="bg-foam p-6 text-left transition hover:bg-paper disabled:opacity-50"
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute">{demo.role}</p>
            <p className="mt-3 text-2xl font-medium">{demo.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-mute">{demo.goes}</p>
            <p className="mt-6 text-sm font-medium text-sky">
              {pending === demo.key ? "Входим…" : "Войти как этот человек →"}
            </p>
          </button>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-alert">{error}</p>}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void signIn(login, password);
        }}
        className="mt-10 max-w-md border border-line bg-foam p-6"
      >
        <p className="text-sm font-medium">Свой аккаунт</p>
        <div className="mt-4 space-y-3">
          <Field label="Почта или телефон">
            <Input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              placeholder="owner@erassyl.local"
            />
          </Field>
          <Field label="Пароль">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Button className="w-full" disabled={pending !== null || !login || !password}>
            Войти
          </Button>
        </div>
        <p className="mt-4 text-sm text-mute">
          Общий планшет на стойке —{" "}
          <Link to="/pin" className="text-ink underline">
            вход по PIN
          </Link>
        </p>
      </form>
    </div>
  );
}
