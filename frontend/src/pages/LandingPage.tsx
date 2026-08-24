import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Glyph } from "../components/Glyph";
import { Brand } from "../components/Mark";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button, Field, Input } from "../components/ui";
import { homePath, useAuth } from "../store/auth";

const features = [
  {
    glyph: "kassa" as const,
    title: "Касса",
    note: "Нал и безнал, PIN кассира на кассе, чек за два касания.",
  },
  {
    glyph: "sklad" as const,
    title: "Склад",
    note: "Капучино — по составу. Печенье — готовой штукой. Без состава склад не трогает.",
  },
  {
    glyph: "smeny" as const,
    title: "Смены",
    note: "Открытие, инкассация — касса сходится каждый раз.",
  },
  {
    glyph: "dengi" as const,
    title: "Деньги",
    note: "Прибыль и себестоимость день в день, без таблиц.",
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
      <header className="flex items-center justify-between px-6 py-[26px] md:px-14">
        <Brand />
        <nav className="flex items-center gap-3.5 text-[13.5px]">
          <a href="#features" className="px-1 py-2 text-ink-soft hover:text-ink">
            Возможности
          </a>
          <ThemeToggle label="Тема" />
          {user ? (
            <Link to={homePath(user.role)}>
              <Button variant="foam" size="lg">
                В кабинет
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button variant="foam" size="lg">
                Войти
              </Button>
            </Link>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-[700px] px-8 pb-12 pt-[60px] text-center">
        <p className="mb-5 font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-maroon">
          Касса и учёт для вашей точки
        </p>
        <h1 className="font-display text-[40px] font-normal leading-[1.2] text-ink md:text-[48px]">
          Каждая продажа посчитана — до тиына
        </h1>
        <p className="mx-auto mb-[34px] mt-[22px] max-w-[470px] text-base leading-[1.65] text-ink-soft">
          Sanaq — POS для любого малого бизнеса: кофейня, магазин, сервис. Считает выручку, себестоимость и остатки сам,
          пока продавец пробивает чек.
        </p>
        <div className="flex justify-center gap-3.5">
          <a href="#request">
            <Button size="lg">Оставить заявку</Button>
          </a>
          <a href="#features">
            <Button variant="ghost" size="lg">
              Как это работает
            </Button>
          </a>
        </div>
      </section>

      <div className="mx-auto max-w-[360px] px-8">
        <Glyph name="ornament" className="h-auto w-full text-maroon" />
      </div>

      <section id="features" className="mx-auto grid max-w-[960px] grid-cols-1 gap-4 px-8 py-[52px] pb-[90px] md:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-lg bg-cream px-[22px] py-[26px] shadow-soft">
            <Glyph
              name={f.glyph}
              className="mb-4 box-content h-[26px] w-[26px] rounded-full bg-paper p-2 text-maroon"
            />
            <h4 className="mb-2.5 font-display text-[19px] font-normal">{f.title}</h4>
            <p className="m-0 text-[13px] leading-[1.55] text-ink-soft">{f.note}</p>
          </div>
        ))}
      </section>

      <section id="request" className="bg-roast-2 px-8 py-16">
        <div className="mx-auto max-w-[440px] rounded-lg bg-roast p-10">
          {done ? (
            <>
              <p className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.13em] text-gold">Заявка</p>
              <h3 className="mb-4 font-display text-[28px] font-normal text-cream">Приняли</h3>
              <p className="text-sm leading-relaxed text-cream-soft">
                Напишем или позвоним. Обычно в тот же день. Оплата позже — сейчас только запрос.
              </p>
              <Button variant="gold" size="lg" className="mt-8 w-full" onClick={() => setDone(false)}>
                Отправить ещё одну
              </Button>
            </>
          ) : (
            <form onSubmit={(e) => void submit(e)}>
              <p className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.13em] text-gold">Подключить точку</p>
              <h3 className="mb-[30px] font-display text-[28px] font-normal text-cream">Оставить заявку</h3>
              <div className="space-y-[18px]">
                <Field label="Название точки" tone="dark">
                  <Input
                    tone="dark"
                    required
                    value={form.shop_name}
                    onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                    placeholder="Например, «Дастархан маркет»"
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
                {error && <p className="text-sm text-maroon">{error}</p>}
                <Button variant="gold" size="lg" className="mt-2 w-full" disabled={pending}>
                  {pending ? "Отправляем…" : "Отправить"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>

      <footer className="bg-roast px-8 py-12">
        <div className="mx-auto flex max-w-[960px] flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div>
            <Brand className="text-cream" markClass="text-gold" />
            <p className="mt-3 max-w-[260px] text-[13px] leading-relaxed text-cream-soft">
              Касса и учёт для точки. Код открытый, лицензия MIT.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-cream-soft">
            <a href="#features" className="hover:text-cream">
              Возможности
            </a>
            <a href="#request" className="hover:text-cream">
              Заявка
            </a>
            <Link to="/login" className="hover:text-cream">
              Войти
            </Link>
            <a href="https://github.com/amir1330/sanaq" className="hover:text-cream">
              GitHub
            </a>
            <a href="https://github.com/amir1330/sanaq/blob/main/LICENSE" className="hover:text-cream">
              Лицензия
            </a>
          </nav>
        </div>
        <div className="mx-auto mt-10 flex max-w-[960px] flex-wrap items-center justify-between gap-3 border-t border-line-dark pt-6 font-mono text-[10.5px] uppercase tracking-[0.13em] text-cream-soft">
          <span>© 2026 Sanaq</span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
}
