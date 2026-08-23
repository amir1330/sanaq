import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Brand, Mark } from "../components/Mark";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button, Field, Input } from "../components/ui";
import { homePath, useAuth } from "../store/auth";

const features = [
  {
    kicker: "Касса",
    title: "Нал и безнал",
    note: "PIN-вход, чек за два касания, смена людей за кассой без переоткрытия смены.",
  },
  {
    kicker: "Склад",
    title: "Списывается сам",
    note: "Рецепт товара — и остатки уходят автоматически при каждой продаже.",
  },
  {
    kicker: "Смены",
    title: "Ящик сходится",
    note: "Открытие, инкассация, закрытие — расхождение видно сразу, не в конце месяца.",
  },
  {
    kicker: "Деньги",
    title: "Прибыль день в день",
    note: "Себестоимость и чистыми — на дашборде, без сведения таблиц вручную.",
  },
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
      await api.createLead({
        ...form,
        contact_name: form.contact_name || form.shop_name,
      });
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
      <header className="flex items-center justify-between px-6 py-7 md:px-14">
        <Brand />
        <nav className="flex items-center gap-7 text-[13.5px]">
          <a href="#features" className="text-ink-soft hover:text-ink">
            Возможности
          </a>
          <ThemeToggle />
          {user ? (
            <Link to={homePath(user.role)} className="border border-ink px-6 py-3 text-[13.5px] font-semibold">
              В кабинет
            </Link>
          ) : (
            <Link to="/login" className="border border-ink px-6 py-3 text-[13.5px] font-semibold hover:bg-ink hover:text-paper">
              Войти
            </Link>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-[720px] px-8 pb-10 pt-16 text-center">
        <p className="mb-5 font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">
          Учёт для кофейни
        </p>
        <h1 className="font-display text-[36px] font-normal leading-[1.22] text-ink md:text-[44px]">
          Полная аналитика кофейни: от чека до чистой прибыли
        </h1>
        <p className="mx-auto mt-6 max-w-[520px] text-base leading-[1.65] text-ink-soft">
          Избавьтесь от ручного сведения смен. Точный учёт молока и зерна, контроль выручки и прозрачные отчёты без
          путаницы.
        </p>
        <div className="mt-9 flex justify-center gap-4">
          <a href="#request" className="border border-ink bg-ink px-6 py-3 text-[13.5px] font-semibold text-paper hover:bg-mute">
            Сделать учёт прозрачным
          </a>
          <a href="#features" className="px-1 py-3 text-[13.5px] font-semibold text-ink hover:underline">
            Как это работает
          </a>
        </div>
      </section>

      <div className="flex items-center justify-center gap-[18px] py-14 text-faint">
        <span className="h-px w-[120px] bg-line-2" />
        <Mark className="h-[34px] w-[34px] text-ink" />
        <span className="h-px w-[120px] bg-line-2" />
      </div>

      <section id="features" className="mx-auto grid max-w-[920px] grid-cols-1 gap-10 px-8 pb-[90px] md:grid-cols-4 md:gap-0">
        {features.map((f, i) => (
          <div key={f.kicker} className={`md:px-[22px] ${i === 0 ? "md:pl-0" : "md:border-l md:border-line"}`}>
            <p className="mb-3.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">
              {f.kicker}
            </p>
            <h4 className="mb-2.5 font-display text-[17px] font-normal">{f.title}</h4>
            <p className="m-0 text-[13px] leading-[1.55] text-ink-soft">{f.note}</p>
          </div>
        ))}
      </section>

      <section id="request" className="bg-roast-2 px-8 py-16">
        <div className="mx-auto max-w-[420px]">
          {done ? (
            <>
              <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.13em] text-cream-soft">Заявка</p>
              <h3 className="mb-4 font-display text-[26px] font-normal text-cream">Приняли</h3>
              <p className="text-sm leading-relaxed text-cream-soft">
                Напишем или позвоним. Обычно в тот же день. Оплата позже — сейчас только запрос.
              </p>
              <Button
                variant="foam"
                className="mt-8 w-full border-cream text-cream hover:bg-cream hover:text-roast"
                onClick={() => setDone(false)}
              >
                Отправить ещё одну
              </Button>
            </>
          ) : (
            <form onSubmit={(e) => void submit(e)}>
              <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.13em] text-cream-soft">
                Подключить точку
              </p>
              <h3 className="mb-8 font-display text-[26px] font-normal text-cream">Оставить заявку</h3>
              <div className="space-y-[22px]">
                <Field label="Название кофейни" tone="dark">
                  <Input
                    tone="dark"
                    required
                    value={form.shop_name}
                    onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                    placeholder="Дастархан кофе"
                  />
                </Field>
                <Field label="Город" tone="dark">
                  <Input
                    tone="dark"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Алматы"
                  />
                </Field>
                <Field label="Как к тебе обращаться" tone="dark">
                  <Input
                    tone="dark"
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    placeholder="Имя"
                  />
                </Field>
                <Field label="Телефон*" tone="dark">
                  <Input
                    tone="dark"
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+7 700 000 00 00"
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
                {error && <p className="text-sm text-alert">{error}</p>}
                <Button
                  className="mt-2.5 w-full border-cream bg-transparent text-cream hover:bg-cream hover:text-roast"
                  disabled={pending}
                >
                  {pending ? "Отправляем…" : "Отправить"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
