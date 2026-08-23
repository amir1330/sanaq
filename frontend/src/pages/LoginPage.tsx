import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client";
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
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
        <Link to="/" className="hover:text-ink">
          CoffeeOS
        </Link>
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-tight">Вход</h1>
      <p className="mt-3 text-sm text-mute">Почта или телефон и пароль, который выдал владелец.</p>
      <form onSubmit={(e) => void signIn(e)} className="mt-8 border border-line bg-foam p-6">
        <div className="space-y-3">
          <Field label="Почта или телефон">
            <Input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
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
          {error && <p className="text-sm text-alert">{error}</p>}
          <Button className="w-full" disabled={pending || !login || !password}>
            {pending ? "Входим…" : "Войти"}
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
