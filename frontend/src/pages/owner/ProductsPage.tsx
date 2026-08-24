import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Empty, Field, Input, PageTitle } from "../../components/ui";
import { money } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { Product } from "../../types";

type IngRow = { stock_item_id: number | ""; quantity: string };

type Draft = {
  id?: number;
  name: string;
  sale_price: string;
  category_id: number | null;
  is_active: boolean;
  tax_percent: string;
  tax_type: string;
  ingredients: IngRow[];
};

export function ProductsPage() {
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["products", shopId], queryFn: () => api.products(shopId) });
  const categories = useQuery({ queryKey: ["categories", shopId], queryFn: () => api.categories(shopId) });
  const stock = useQuery({ queryKey: ["stock", shopId], queryFn: () => api.stock(shopId) });
  const [editing, setEditing] = useState<Draft | null>(null);
  const [catName, setCatName] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const ingredients = (editing?.ingredients ?? [])
        .filter((i) => i.stock_item_id && i.quantity)
        .map((i) => ({ stock_item_id: Number(i.stock_item_id), quantity: i.quantity }));
      if (editing?.id) {
        await api.patchProduct(shopId, editing.id, {
          name: editing.name,
          sale_price: editing.sale_price,
          category_id: editing.category_id,
          is_active: editing.is_active,
          tax_percent: editing.tax_percent || "0",
          tax_type: Number(editing.tax_type || 0),
        });
        await api.setIngredients(shopId, editing.id, ingredients);
      } else {
        await api.createProduct(shopId, {
          name: editing?.name,
          sale_price: editing?.sale_price,
          category_id: editing?.category_id || null,
          tax_percent: editing?.tax_percent || "0",
          tax_type: Number(editing?.tax_type || 0),
          ingredients,
        });
      }
    },
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });

  const addCat = useMutation({
    mutationFn: () => api.createCategory(shopId, catName),
    onSuccess: () => {
      setCatName("");
      void qc.invalidateQueries({ queryKey: ["categories", shopId] });
    },
  });

  function open(p?: Product) {
    setEditing({
      id: p?.id,
      name: p?.name ?? "",
      sale_price: p?.sale_price ?? "",
      category_id: p?.category_id ?? null,
      is_active: p?.is_active ?? true,
      tax_percent: p?.tax_percent ?? "0",
      tax_type: String(p?.tax_type ?? 0),
      ingredients:
        p?.ingredients.map((i) => ({ stock_item_id: i.stock_item_id, quantity: String(i.quantity) })) ?? [],
    });
  }

  return (
    <div>
      <PageTitle
        kicker="Меню"
        title="Товары"
        hint="Цена — сколько платит гость. Состав — что снять со склада. Капучино: молоко и зерно. Печенье: одна штука, или пусто, если остаток не ведёте."
        action={<Button onClick={() => open()}>Добавить в меню</Button>}
      />
      <Card className="mb-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (catName.trim()) addCat.mutate();
          }}
        >
          <Field label="Новая категория меню">
            <Input
              placeholder="Кофе, чай, выпечка…"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="w-56"
            />
          </Field>
          <Button type="submit" variant="foam">
            Добавить категорию
          </Button>
          <p className="self-center text-sm text-mute">
            Сейчас: {categories.data?.map((c) => c.name).join(", ") || "нет"}
          </p>
        </form>
      </Card>
      {(products.data ?? []).length === 0 ? (
        <Empty>Меню пустое. Добавь первый товар — он появится на кассе.</Empty>
      ) : (
        <div className="border border-line">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-mute">
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3">На кассе</th>
                <th>Категория</th>
                <th>Цена гостю</th>
                <th>Себестоимость</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(products.data ?? []).map((p) => (
                <tr key={p.id} className="border-b border-line/70">
                  <td className="px-4 py-3">
                    {p.name}
                    {!p.is_active && <span className="ml-2 text-mute">скрыт с кассы</span>}
                  </td>
                  <td>{p.category_name || "—"}</td>
                  <td>{money(p.sale_price)}</td>
                  <td>{money(p.cost_price)}</td>
                  <td className="px-4 text-right">
                    <button className="underline" onClick={() => open(p)}>
                      Изменить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4">
          <form
            className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-auto border border-line bg-paper p-7"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <h2 className="font-display text-2xl font-normal">{editing.id ? "Изменить товар" : "Новый товар"}</h2>
            <Field label="Как называется на кассе">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Цена для гостя, ₸">
              <Input
                value={editing.sale_price}
                onChange={(e) => setEditing({ ...editing, sale_price: e.target.value })}
                inputMode="decimal"
              />
            </Field>
            <Field label="Категория">
              <select
                className="w-full border-0 border-b border-line-2 bg-transparent py-2.5 outline-none focus:border-ink"
                value={editing.category_id ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, category_id: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">Без категории</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
              />
              Показывать на кассе
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="НДС %, для чека ОФД">
                <Input
                  value={editing.tax_percent}
                  onChange={(e) => setEditing({ ...editing, tax_percent: e.target.value })}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Код налога TaxType">
                <Input
                  value={editing.tax_type}
                  onChange={(e) => setEditing({ ...editing, tax_type: e.target.value })}
                  inputMode="numeric"
                />
              </Field>
            </div>
            <p className="text-xs text-mute">На упрощёнке обычно 0 и 0. Точные коды — в кабинете Webkassa.</p>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-mute">Состав — списание со склада</p>
              <p className="mt-1 mb-2 text-xs text-mute">
                Можно оставить пустым: продажа только в кассе, склад не двигается. Готовое печенье — одна позиция, 1 шт.
                Капучино — зёрна 18 г и молоко 180 мл.
              </p>
              <div className="space-y-2">
                {editing.ingredients.map((row, idx) => {
                  const item = stock.data?.find((s) => s.id === row.stock_item_id);
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_7rem_auto] gap-2">
                      <select
                        className="border-0 border-b border-line-2 bg-transparent px-0 py-2 text-sm outline-none"
                        value={row.stock_item_id}
                        onChange={(e) => {
                          const next = [...editing.ingredients];
                          next[idx] = { ...row, stock_item_id: Number(e.target.value) };
                          setEditing({ ...editing, ingredients: next });
                        }}
                      >
                        <option value="">Со склада…</option>
                        {stock.data?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {s.base_unit}
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder={item ? item.base_unit : "кол-во"}
                        value={row.quantity}
                        onChange={(e) => {
                          const next = [...editing.ingredients];
                          next[idx] = { ...row, quantity: e.target.value };
                          setEditing({ ...editing, ingredients: next });
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            ingredients: editing.ingredients.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        Убрать
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="foam"
                className="mt-2"
                onClick={() =>
                  setEditing({
                    ...editing,
                    ingredients: [...editing.ingredients, { stock_item_id: "", quantity: "" }],
                  })
                }
              >
                + позиция со склада
              </Button>
              <p className="mt-3 text-sm">
                Себестоимость порции:{" "}
                {money(
                  editing.ingredients.reduce((sum, row) => {
                    const item = stock.data?.find((s) => s.id === row.stock_item_id);
                    if (!item || !row.quantity) return sum;
                    return sum + Number(row.quantity) * Number(item.cost_per_base_unit);
                  }, 0),
                )}
                <span className="ml-2 text-xs text-mute">на лету, в чек попадёт снимок на момент продажи</span>
              </p>
            </div>
            {save.isError && <p className="text-sm text-alert">{(save.error as Error).message}</p>}
            <div className="flex gap-2">
              <Button type="submit">Сохранить</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Отмена
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
