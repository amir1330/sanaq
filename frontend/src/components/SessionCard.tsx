import { useNavigate } from "react-router-dom";
import { Button, Card } from "./ui";
import { useAuth } from "../store/auth";
import { useTheme, type ThemePreference } from "../store/theme";

const choices: { id: ThemePreference; label: string; note: string }[] = [
  { id: "auto", label: "Авто", note: "следует теме телефона или компьютера" },
  { id: "light", label: "Светлая", note: "всегда бумага" },
  { id: "dark", label: "Тёмная", note: "всегда тёмная" },
];

export function SessionCard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const preference = useTheme((s) => s.preference);
  const setPreference = useTheme((s) => s.setPreference);

  return (
    <Card className="mb-4">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">Аккаунт</p>
      <p className="mt-1 font-display text-2xl font-normal">{user?.full_name}</p>
      {user?.email && <p className="mt-1 text-sm text-mute">{user.email}</p>}
      <p className="mt-5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-faint">Тема</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {choices.map((c) => (
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
        {choices.find((c) => c.id === preference)?.note}
      </p>
      <div className="mt-5">
        <Button
          variant="ghost"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Выйти
        </Button>
      </div>
    </Card>
  );
}
