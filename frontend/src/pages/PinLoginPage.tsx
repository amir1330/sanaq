import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/ui";
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
      setError("Неверный PIN. Спроси владельца или попробуй 1234 на демо.");
      setPin("");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-mute">Касса</p>
      <h1 className="mt-2 text-4xl font-medium">Введи PIN</h1>
      <p className="mt-2 text-sm text-mute">Четыре цифры. После ввода касса откроется сама.</p>
      <label className="mt-8 text-sm text-mute">
        Номер точки
        <input
          className="mt-2 w-full border border-line bg-foam px-3 py-2"
          value={shopId}
          onChange={(e) => setShopId(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <div className="mt-6 border border-line bg-foam px-4 py-6 text-center">
        <p className="text-3xl tracking-[0.45em]">{pin.replace(/./g, "•").padEnd(4, "·")}</p>
      </div>
      {error && <p className="mt-3 text-center text-sm text-alert">{error}</p>}
      <div className="mt-6 grid grid-cols-3 gap-px bg-line">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map((key) => (
          <Button
            key={key}
            variant={key === "OK" ? "primary" : "foam"}
            className="h-16 border-0 text-xl"
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
          </Button>
        ))}
      </div>
      <Link to="/login" className="mt-6 text-center text-sm text-mute">
        Войти почтой и паролем
      </Link>
    </div>
  );
}
