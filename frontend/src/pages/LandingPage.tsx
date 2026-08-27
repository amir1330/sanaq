import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Glyph } from "../components/Glyph";
import { Brand } from "../components/Mark";
import { Button, Field, Input } from "../components/ui";
import { useT } from "../i18n";
import { homePath, useAuth } from "../store/auth";

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
  const t = useT();
  const user = useAuth((s) => s.user);
  const [form, setForm] = useState(empty);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const features = [
    { glyph: "kassa" as const, title: t("landing.featTill"), note: t("landing.featTillNote") },
    { glyph: "sklad" as const, title: t("landing.featStock"), note: t("landing.featStockNote") },
    { glyph: "smeny" as const, title: t("landing.featShifts"), note: t("landing.featShiftsNote") },
    { glyph: "dengi" as const, title: t("landing.featMoney"), note: t("landing.featMoneyNote") },
  ];

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
      setError(err instanceof Error ? err.message : t("landing.submitFail"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between border-b border-line px-6 py-5 md:px-12">
        <Brand className="text-[18px]" markClass="h-[18px] w-[26px]" />
        <nav className="flex items-center gap-4 text-[13px]">
          <a href="#features" className="hidden text-ink-soft hover:text-ink sm:inline">
            {t("landing.featuresNav")}
          </a>
          {user ? (
            <Link to={homePath(user.role)}>
              <Button variant="foam" size="lg">
                {t("landing.cabinet")}
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button variant="foam" size="lg">
                {t("landing.signIn")}
              </Button>
            </Link>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-[1080px] gap-10 px-6 py-14 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-12 md:py-20">
        <div className="page-enter">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-sun">{t("landing.kicker")}</p>
          <h1 className="mt-4 max-w-[14ch] font-display text-[38px] font-medium leading-[1.08] tracking-tight text-ink md:text-[52px]">
            {t("landing.headline")}
          </h1>
          <p className="mt-5 max-w-[38ch] text-[15px] leading-[1.7] text-ink-soft">{t("landing.lead")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#request">
              <Button size="lg">{t("landing.ctaRequest")}</Button>
            </a>
            <a href="#features">
              <Button variant="ghost" size="lg">
                {t("landing.ctaHow")}
              </Button>
            </a>
          </div>
          <hr className="perforation-h mt-10 max-w-xs" />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{t("landing.tagline")}</p>
        </div>

        <div className="surface-raised page-enter p-6 md:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{t("landing.featuresNav")}</p>
          <ul className="mt-5 space-y-4">
            {features.map((f) => (
              <li key={f.title} className="flex gap-4 border-b border-line pb-4 last:border-0 last:pb-0">
                <Glyph name={f.glyph} className="mt-0.5 h-6 w-6 shrink-0 text-sun" />
                <div>
                  <h2 className="font-display text-[17px] font-medium">{f.title}</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{f.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" className="border-y border-line bg-paper-2 px-6 py-14 md:px-12">
        <div className="mx-auto grid max-w-[1080px] gap-4 md:grid-cols-4">
          {features.map((f, index) => (
            <article key={f.title} className="surface-raised p-5">
              <span className="font-mono text-[10px] text-faint">{String(index + 1).padStart(2, "0")}</span>
              <Glyph name={f.glyph} className="mb-4 mt-3 h-7 w-7 text-sun" />
              <h3 className="font-display text-[18px] font-medium">{f.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{f.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="request" className="surface-roast bg-roast px-6 py-16 md:px-12">
        <div className="mx-auto grid max-w-[1080px] gap-10 md:grid-cols-2 md:items-start">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-sun">{t("landing.connectKicker")}</p>
            <h2 className="mt-3 max-w-[16ch] font-display text-[32px] font-medium leading-tight text-cream md:text-[40px]">
              {t("landing.requestTitle")}
            </h2>
            <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-cream-soft">{t("landing.footerBlurb")}</p>
            <hr className="perforation-h mt-8 max-w-xs opacity-40" />
          </div>

          <div className="rounded-md border border-line-dark bg-roast-2 p-6 md:p-8">
            {done ? (
              <>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-sun">{t("landing.requestDoneKicker")}</p>
                <h3 className="mt-3 font-display text-[24px] font-medium text-cream">{t("landing.requestDoneTitle")}</h3>
                <p className="mt-3 text-sm leading-relaxed text-cream-soft">{t("landing.requestDoneBody")}</p>
                <Button variant="gold" size="lg" className="mt-8 w-full" onClick={() => setDone(false)}>
                  {t("landing.requestAgain")}
                </Button>
              </>
            ) : (
              <form onSubmit={(e) => void submit(e)}>
                <div className="space-y-4">
                  <Field label={t("landing.fieldShop")} tone="dark">
                    <Input
                      tone="dark"
                      required
                      value={form.shop_name}
                      onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                      placeholder={t("landing.fieldShopPh")}
                    />
                  </Field>
                  <Field label={t("landing.fieldCity")} tone="dark">
                    <Input
                      tone="dark"
                      required
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder={t("landing.fieldCityPh")}
                    />
                  </Field>
                  <Field label={t("landing.fieldPhone")} tone="dark">
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
                    {pending ? t("landing.submitting") : t("landing.submit")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-line px-6 py-10 md:px-12">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Brand markClass="text-sun" />
            <p className="mt-3 max-w-[280px] text-[13px] leading-relaxed text-ink-soft">{t("landing.footerBlurb")}</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-soft">
            <a href="#features" className="hover:text-ink">
              {t("landing.featuresNav")}
            </a>
            <a href="#request" className="hover:text-ink">
              {t("landing.requestKicker")}
            </a>
            <Link to="/login" className="hover:text-ink">
              {t("landing.signIn")}
            </Link>
            <a href="https://github.com/amir1330/sanaq" className="hover:text-ink">
              GitHub
            </a>
            <a href="https://github.com/amir1330/sanaq/blob/main/LICENSE" className="hover:text-ink">
              {t("landing.license")}
            </a>
          </nav>
        </div>
        <div className="mx-auto mt-8 flex max-w-[1080px] flex-wrap items-center justify-between gap-3 border-t border-line pt-6 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          <span>© 2026 Sanaq</span>
          <span>AGPLv3</span>
        </div>
      </footer>
    </div>
  );
}
