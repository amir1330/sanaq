import { cn } from "../lib/utils";

export type NavIconName =
  | "reports"
  | "till"
  | "shifts"
  | "products"
  | "stock"
  | "revisions"
  | "staff"
  | "expenses"
  | "settings"
  | "shops"
  | "users"
  | "leads"
  | "more";

const paths: Record<NavIconName, string> = {
  reports:
    "M4 19V5m0 14h16M8 17V9m4 8V7m4 10v-4",
  till: "M4 7h16v10H4V7zm3 3h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z",
  shifts: "M7 4v3M17 4v3M4 9h16M6 13h4m-4 4h8M6 7h12a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2z",
  products: "M4 8l8-4 8 4-8 4-8-4zm0 6l8 4 8-4M4 14l8 4 8-4",
  stock: "M5 8l7-4 7 4-7 4-7-4zm0 0v8l7 4 7-4V8",
  revisions: "M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9m-6-4l4 4m-4-4v4h4",
  staff: "M9 11a3 3 0 106 0 3 3 0 00-6 0zm-5 9a7 7 0 0114 0",
  expenses: "M12 3v18M8 7h8a3 3 0 010 6H9a3 3 0 000 6h7",
  settings: "M12 8.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7zm8.2 3.5a7.2 7.2 0 01.1 1 7.2 7.2 0 01-.1 1l2 1.5-2 3.5-2.4-1a7.5 7.5 0 01-1.7 1l-.4 2.6H9.4l-.4-2.6a7.5 7.5 0 01-1.7-1l-2.4 1-2-3.5 2-1.5a7.2 7.2 0 01-.1-1 7.2 7.2 0 01.1-1L2.5 10 4.5 6.5l2.4 1a7.5 7.5 0 011.7-1l.4-2.6h5.2l.4 2.6a7.5 7.5 0 011.7 1l2.4-1 2 3.5-2 1.5z",
  shops: "M4 10l8-5 8 5v9H4v-9zm4 4h8",
  users: "M8 11a3 3 0 106 0 3 3 0 00-6 0zm-6 9a9 9 0 0118 0",
  leads: "M4 6h16M4 12h10M4 18h14",
  more: "M6 12h.01M12 12h.01M18 12h.01",
};

export function NavIcon({
  name,
  className,
}: {
  name: NavIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  );
}
