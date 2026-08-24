import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Brand } from "../components/Mark";
import { ThemeToggle } from "../components/ThemeToggle";
import { homePath, useAuth } from "../store/auth";

export function PinLoginPage() {
  const { user, setSession } = useAuth();
  const navigate = useNavigate();
  const [shopId, setShopId] = useState("1");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  if (user) return <Navigate to={homePath(user.role)} replace />;

  async function submit(next = pin) {
    if (next.length < 4) return;
    setError("");
    try {
      const pair = await api.loginPin(Number(shopId), next);
      setSession(pair.access_token, pair.refresh_token, pair.user);
      navigate("/pos");
    } catch {
      setError("Неверный PIN. Спроси владельца.");
      setPin("");
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between px-6 py-7 md:px-14">
        <Link to="/">
          <Brand />
        </Link>
        <div className="flex items-center gap-6">
          <ThemeToggle />
          <Link to="/login" className="text-[13.5px] text-ink-soft hover:text-ink">
            Почтой
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-md px-6 pt-10">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-maroon">Касса</p>
        <h1 className="mt-3 font-display text-[40px] font-normal">Введи PIN</h1>
        <p className="mt-3 text-sm text-ink-soft">Четыре цифры. После ввода касса откроется сама.</p>
        <label className="mt-10 block font-mono text-[10px] uppercase tracking-wider text-faint">
          Номер точки
          <input
            className="mt-2 w-full rounded-md border-[1.5px] border-line-2 bg-cream px-4 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <div className="mt-8 rounded-lg bg-cream py-6 text-center shadow-soft">
          <p className="font-mono text-3xl tracking-[0.45em]">{pin.replace(/./g, "•").padEnd(4, "·")}</p>
        </div>
        {error && <p className="mt-3 text-center text-sm text-alert">{error}</p>}
        <div className="mt-6 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map((key) => (
            <button
              key={key}
              className={`h-16 rounded-md bg-cream text-xl shadow-soft hover:bg-paper-2 ${key === "OK" ? "text-gold" : "text-ink"}`}
              onClick={() => {
                if (key === "C") setPin("");
                else if (key === "OK") void submit();
                else {
                  const next = pin + key;
                  setPin(next);
                  if (next.length === 4) void submit(next);
                }
              }}
            >
              {key === "C" ? "Стереть" : key === "OK" ? "Войти" : key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
