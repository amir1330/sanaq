import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Button, Field, Input } from "../components/ui";
import { homePath, useAuth } from "../store/auth";

const lines = [
  { name: "Касса", note: "Наличный и безналичный. Чек за секунды." },
  { name: "Склад", note: "Рецепт списывает зёрна и молоко сам." },
  { name: "Смены", note: "Открыл, закрыл, касса сошлась." },
  { name: "Деньги", note: "Выручка, себестоимость, чистыми." },
];

const empty = {
  shop_name: "",
  city: "",
  contact_name: "",
  phone: "",
  email: "",
  comment: "",
  website: "",
};

export function LandingPage() {
  const user = useAuth((s) => s.user);
  const [form, setForm] = useState(empty);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await api.createLead(form);
      setDone(true);
      setForm(empty);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не отправилось. Попробуй ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <p className="text-sm font-medium tracking-[0.16em] uppercase">CoffeeOS</p>
          {user ? (
            <Link to={homePath(user.role)} className="bg-ink px-4 py-2 text-sm text-paper">
              В кабинет
            </Link>
          ) : (
            <Link to="/login" className="text-sm text-mute underline">
              Войти
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <section>
          <p className="text-[11px] uppercase tracking-[0.2em] text-mute">Для кофейни</p>
          <h1 className="mt-3 max-w-xl text-4xl font-medium tracking-tight md:text-5xl">
            Учёт, как на стойке.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-mute">
            Одна программа: касса, склад, смены и прибыль. Пока без оплаты — оставь заявку,
            мы свяжемся и заведём кофейню.
          </p>

          <div className="mt-10 border border-line bg-foam">
            <div className="flex items-baseline justify-between border-b border-dashed border-line px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-mute">Чек</p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-mute">CoffeeOS</p>
            </div>
            <ul>
              {lines.map((line) => (
                <li
                  key={line.name}
                  className="flex items-start justify-between gap-6 border-b border-dashed border-line px-5 py-4"
                >
                  <div>
                    <p className="text-lg">{line.name}</p>
                    <p className="mt-1 text-sm text-mute">{line.note}</p>
                  </div>
                  <p className="shrink-0 text-sm text-sky">входит</p>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between px-5 py-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-mute">Итого</p>
              <p className="text-lg">по запросу</p>
            </div>
          </div>
        </section>

        <section id="request" className="border border-line bg-foam p-6">
          {done ? (
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-mute">Заявка</p>
              <h2 className="mt-2 text-2xl font-medium">Приняли.</h2>
              <p className="mt-3 text-sm leading-relaxed text-mute">
                Напишем или позвоним. Обычно в тот же день. Оплата позже — сейчас только запрос.
              </p>
              <Button className="mt-6" variant="foam" onClick={() => setDone(false)}>
                Отправить ещё одну
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void submit(e)}>
              <p className="text-[11px] uppercase tracking-[0.16em] text-mute">Заявка</p>
              <h2 className="mt-2 text-2xl font-medium">Оставить запрос</h2>
              <p className="mt-2 text-sm text-mute">Телефон обязателен. Деньги сейчас не списываем.</p>
              <div className="mt-6 space-y-3">
                <Field label="Кофейня">
                  <Input
                    required
                    value={form.shop_name}
                    onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                    placeholder="Erassyl Coffee"
                  />
                </Field>
                <Field label="Город">
                  <Input
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Алматы"
                  />
                </Field>
                <Field label="Как к тебе обращаться">
                  <Input
                    required
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  />
                </Field>
                <Field label="Телефон / WhatsApp">
                  <Input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+7 700 000 00 00"
                  />
                </Field>
                <Field label="Почта, если удобно">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
                <Field label="Комментарий">
                  <textarea
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
                    rows={3}
                    className="w-full border border-line bg-foam px-3 py-2.5 text-ink outline-none focus:border-ink"
                    placeholder="Сколько точек, когда хотите начать"
                  />
                </Field>
                <div className="hidden" aria-hidden>
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                  />
                </div>
                {error && <p className="text-sm text-rust">{error}</p>}
                <Button className="w-full" disabled={pending}>
                  {pending ? "Отправляем…" : "Отправить заявку"}
                </Button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
