import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { Brand } from "../../components/Mark";
import { useAuth } from "../../store/auth";

export function PosClockIn({ shopId }: { shopId: number | null }) {
  const setSession = useAuth((s) => s.setSession);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(next = pin) {
    if (!shopId || next.length < 4 || pending) return;
    setPending(true);
    setError("");
    try {
      const pair = await api.loginPin(shopId, next);
      setSession(pair.access_token, pair.refresh_token, pair.user);
    } catch {
      setError("Неверный PIN. Спроси владельца.");
      setPin("");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between px-6 py-7 md:px-14">
        <Link to="/">
          <Brand />
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/login" className="text-[13.5px] text-ink-soft hover:text-ink">
            Вход владельца
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-md px-6 pt-10">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-maroon">Касса</p>
        {shopId ? (
          <>
            <h1 className="mt-3 font-display text-[40px] font-normal">PIN кассира</h1>
            <p className="mt-3 text-sm text-ink-soft">Четыре цифры. После ввода касса откроется сама.</p>
            <div className="mt-10 rounded-lg bg-cream py-6 text-center shadow-soft">
              <p className="font-mono text-3xl tracking-[0.45em]">{pin.replace(/./g, "•").padEnd(4, "·")}</p>
            </div>
            {error && <p className="mt-3 text-center text-sm text-alert">{error}</p>}
            <div className="mt-6 grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={pending}
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
          </>
        ) : (
          <>
            <h1 className="mt-3 font-display text-[40px] font-normal">Планшет не привязан</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Владелец должен один раз войти на этом планшете — после этого кассиры открывают смену своим PIN, без
              почты и без номера точки.
            </p>
            <Link
              to="/login"
              className="mt-10 inline-block rounded-full bg-ink px-6 py-3 text-sm text-paper hover:bg-maroon"
            >
              Вход владельца
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
