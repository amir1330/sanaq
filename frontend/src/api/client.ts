import { formatApiError } from "../lib/errors";
import { downloadBlob } from "../lib/utils";
import { t } from "../i18n";
import { useAuth } from "../store/auth";
import type {
  AdminStats,
  AdminUser,
  CashRegister,
  Category,
  CrewMember,
  DailyPoint,
  Expense,
  FiscalReceipt,
  Lead,
  LeadStatus,
  Page,
  Product,
  PublicVitrineMenu,
  VitrineLayout,
  ReportSummary,
  Sale,
  SellerPoint,
  Shift,
  Shop,
  StockItem,
  StockJournalEntry,
  StockRevision,
  StockStats,
  TokenPair,
  TopProduct,
  User,
} from "../types";

const BASE = import.meta.env.VITE_API_URL || "/api/v1";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const { accessToken, refreshToken, setSession, logout } = useAuth.getState();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401 && retry && refreshToken && !path.startsWith("/auth/") && !path.startsWith("/public/")) {
    const refreshed = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (refreshed.ok) {
      const pair = (await refreshed.json()) as TokenPair;
      setSession(pair.access_token, pair.refresh_token, pair.user);
      return request<T>(path, init, false);
    }
    logout();
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = formatApiError(data.detail, data.message || res.statusText);
    throw new ApiError(res.status, detail || res.statusText);
  }
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  login: (login: string, password: string) =>
    request<TokenPair>("/auth/login", { method: "POST", body: json({ login, password }) }),
  me: () => request<User>("/auth/me"),
  createLead: (body: {
    shop_name: string;
    city: string;
    contact_name: string;
    phone: string;
    email?: string;
    comment?: string;
    website?: string;
  }) => request<Lead>("/leads", { method: "POST", body: json(body) }),
  adminLeads: () => request<Lead[]>("/admin/leads"),
  patchLead: (id: number, status: LeadStatus) =>
    request<Lead>(`/admin/leads/${id}`, { method: "PATCH", body: json({ status }) }),

  shops: () => request<Shop[]>("/shops"),
  createBranch: (
    body: {
      name: string;
      address?: string;
      timezone?: string;
      copy_from_shop_id?: number | null;
      copy_catalog?: boolean;
    },
  ) => request<Shop>("/shops", { method: "POST", body: json(body) }),
  updateShopSettings: (
    shopId: number,
    body: { name?: string; address?: string; timezone?: string; business_type?: string },
  ) => request<Shop>(`/shops/${shopId}`, { method: "PATCH", body: json(body) }),
  uploadLogo: (shopId: number, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<Shop>(`/shops/${shopId}/logo`, { method: "POST", body });
  },
  deleteLogo: (shopId: number) => request<Shop>(`/shops/${shopId}/logo`, { method: "DELETE" }),
  updateWebkassa: (
    shopId: number,
    body: {
      login?: string;
      password?: string;
      cashbox_number?: string;
      api_key?: string;
      enabled?: boolean;
    },
  ) => request<Shop>(`/shops/${shopId}/webkassa`, { method: "PATCH", body: json(body) }),
  testWebkassa: (shopId: number) =>
    request<{ ok: boolean; message: string }>(`/shops/${shopId}/webkassa/test`, { method: "POST" }),

  adminShops: () => request<Shop[]>("/admin/shops"),
  createShop: (body: {
    name: string;
    address?: string;
    timezone?: string;
    owner?: { full_name: string; email: string; password: string; phone?: string };
    existing_owner_email?: string;
  }) => request<Shop>("/admin/shops", { method: "POST", body: json(body) }),
  patchShop: (id: number, body: Partial<Shop>) =>
    request<Shop>(`/admin/shops/${id}`, { method: "PATCH", body: json(body) }),
  createOwner: (shopId: number, body: { full_name: string; email: string; password: string; phone?: string }) =>
    request<User>(`/admin/shops/${shopId}/owners`, { method: "POST", body: json(body) }),
  adminUsers: () => request<AdminUser[]>("/admin/users"),
  createAdminUser: (body: {
    shop_id: number;
    role: "owner" | "barista";
    full_name: string;
    email?: string;
    phone?: string;
    password?: string;
    can_receive_stock?: boolean;
  }) => request<AdminUser>("/admin/users", { method: "POST", body: json(body) }),
  adminStats: () => request<AdminStats>("/admin/stats"),

  categories: (shopId: number) => request<Category[]>(`/shops/${shopId}/categories`),
  createCategory: (shopId: number, name: string) =>
    request<Category>(`/shops/${shopId}/categories`, { method: "POST", body: json({ name }) }),
  patchCategory: (shopId: number, id: number, name: string) =>
    request<Category>(`/shops/${shopId}/categories/${id}`, { method: "PATCH", body: json({ name }) }),
  deleteCategory: (shopId: number, id: number) =>
    request<void>(`/shops/${shopId}/categories/${id}`, { method: "DELETE" }),
  vitrineLayout: (shopId: number) => request<VitrineLayout>(`/shops/${shopId}/vitrine-layout`),
  putVitrineLayout: (shopId: number, body: { columns: object[] }) =>
    request<VitrineLayout>(`/shops/${shopId}/vitrine-layout`, { method: "PUT", body: json(body) }),
  publicVitrineMenu: (shopId: number) =>
    request<PublicVitrineMenu>(`/public/shops/${shopId}/vitrine-menu`),

  products: (
    shopId: number,
    params?: {
      q?: string;
      category_id?: number | null;
      active_only?: boolean;
      include_ingredients?: boolean;
      limit?: number;
      offset?: number;
    },
  ) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set("q", params.q);
    if (params?.category_id != null) sp.set("category_id", String(params.category_id));
    if (params?.active_only) sp.set("active_only", "true");
    if (params?.include_ingredients) sp.set("include_ingredients", "true");
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.offset != null) sp.set("offset", String(params.offset));
    const qs = sp.toString();
    return request<Page<Product>>(`/shops/${shopId}/products${qs ? `?${qs}` : ""}`);
  },
  product: (shopId: number, id: number) =>
    request<Product>(`/shops/${shopId}/products/${id}`),
  productByCode: (shopId: number, code: string) =>
    request<Product>(`/shops/${shopId}/products/lookup?code=${encodeURIComponent(code.trim())}`),
  createProduct: (shopId: number, body: object) =>
    request<Product>(`/shops/${shopId}/products`, { method: "POST", body: json(body) }),
  createProductsBulk: (
    shopId: number,
    body: { category_id: number | null; items: { name: string; sale_price: string }[] },
  ) => request<Product[]>(`/shops/${shopId}/products/bulk`, { method: "POST", body: json(body) }),
  patchProduct: (shopId: number, id: number, body: object) =>
    request<Product>(`/shops/${shopId}/products/${id}`, { method: "PATCH", body: json(body) }),
  deleteProduct: (shopId: number, id: number) =>
    request<void>(`/shops/${shopId}/products/${id}`, { method: "DELETE" }),
  setIngredients: (shopId: number, productId: number, ingredients: object[]) =>
    request<Product>(`/shops/${shopId}/products/${productId}/ingredients`, {
      method: "POST",
      body: json(ingredients),
    }),
  uploadProductImage: (shopId: number, id: number, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<Product>(`/shops/${shopId}/products/${id}/image`, { method: "POST", body });
  },
  deleteProductImage: (shopId: number, id: number) =>
    request<Product>(`/shops/${shopId}/products/${id}/image`, { method: "DELETE" }),

  stock: (
    shopId: number,
    params?: { q?: string; limit?: number; offset?: number; is_low?: boolean },
  ) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set("q", params.q);
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.offset != null) sp.set("offset", String(params.offset));
    if (params?.is_low) sp.set("is_low", "true");
    const qs = sp.toString();
    return request<Page<StockItem>>(`/shops/${shopId}/stock-items${qs ? `?${qs}` : ""}`);
  },
  stockStats: (shopId: number) => request<StockStats>(`/shops/${shopId}/stock-items/stats`),
  stockItem: (shopId: number, id: number) => request<StockItem>(`/shops/${shopId}/stock-items/${id}`),
  createStock: (shopId: number, body: object) =>
    request<StockItem>(`/shops/${shopId}/stock-items`, { method: "POST", body: json(body) }),
  patchStock: (shopId: number, id: number, body: object) =>
    request<StockItem>(`/shops/${shopId}/stock-items/${id}`, { method: "PATCH", body: json(body) }),
  deleteStock: (shopId: number, id: number) =>
    request<void>(`/shops/${shopId}/stock-items/${id}`, { method: "DELETE" }),
  uploadStockImage: (shopId: number, id: number, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<StockItem>(`/shops/${shopId}/stock-items/${id}/image`, { method: "POST", body });
  },
  deleteStockImage: (shopId: number, id: number) =>
    request<StockItem>(`/shops/${shopId}/stock-items/${id}/image`, { method: "DELETE" }),
  makeProductFromStock: (
    shopId: number,
    id: number,
    body: { sale_price: string; category_id?: number | null },
  ) =>
    request<Product>(`/shops/${shopId}/stock-items/${id}/make-product`, {
      method: "POST",
      body: json(body),
    }),
  downloadStockImportTemplate: async (shopId: number, lang?: string) => {
    const { accessToken, refreshToken, setSession, logout } = useAuth.getState();
    const headers = new Headers();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    const qs = lang ? `?lang=${encodeURIComponent(lang)}` : "";
    const url = `${BASE}/shops/${shopId}/stock-items/import-template${qs}`;
    let res = await fetch(url, { headers });
    if (res.status === 401 && refreshToken) {
      const refreshed = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!refreshed.ok) {
        logout();
        throw new ApiError(401, t("common.sessionExpired"));
      }
      const pair = (await refreshed.json()) as TokenPair;
      setSession(pair.access_token, pair.refresh_token, pair.user);
      headers.set("Authorization", `Bearer ${pair.access_token}`);
      res = await fetch(url, { headers });
    }
    if (!res.ok) throw new ApiError(res.status, t("errors.downloadReport"));
    const blob = await res.blob();
    downloadBlob(blob, "stock-import-template.xlsx");
  },
  previewStockImport: (shopId: number, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<{
      rows: {
        row: number;
        ok: boolean;
        errors: string[];
        data: {
          name: string;
          base_unit: string;
          purchase_unit: string;
          purchase_to_base: string;
          quantity: string;
          cost_per_base_unit: string;
          min_quantity: string;
          is_ingredient: boolean;
          sku: string | null;
        } | null;
      }[];
      ok_count: number;
      error_count: number;
    }>(`/shops/${shopId}/stock-items/import/preview`, { method: "POST", body });
  },
  confirmStockImport: (shopId: number, rows: object[]) =>
    request<StockItem[]>(`/shops/${shopId}/stock-items/import/confirm`, {
      method: "POST",
      body: json({ rows }),
    }),
  stockMove: (shopId: number, id: number, body: object) =>
    request(`/shops/${shopId}/stock-items/${id}/movements`, { method: "POST", body: json(body) }),
  stockRegrade: (shopId: number, id: number, body: object) =>
    request(`/shops/${shopId}/stock-items/${id}/regrade`, { method: "POST", body: json(body) }),
  stockTransfer: (shopId: number, id: number, body: object) =>
    request(`/shops/${shopId}/stock-items/${id}/transfer`, { method: "POST", body: json(body) }),
  stockJournal: (shopId: number, itemId?: number) =>
    request<StockJournalEntry[]>(
      `/shops/${shopId}/stock-journal${itemId ? `?item_id=${itemId}` : ""}`,
    ),
  stockRevisions: (shopId: number) => request<StockRevision[]>(`/shops/${shopId}/stock-revisions`),
  stockRevision: (shopId: number, id: number) =>
    request<StockRevision>(`/shops/${shopId}/stock-revisions/${id}`),
  createStockRevision: (shopId: number, comment?: string) =>
    request<StockRevision>(`/shops/${shopId}/stock-revisions`, {
      method: "POST",
      body: json({ comment: comment || null }),
    }),
  patchStockRevision: (
    shopId: number,
    id: number,
    body: {
      comment?: string | null;
      lines: { stock_item_id: number; counted_quantity: string | null; comment?: string | null }[];
    },
  ) => request<StockRevision>(`/shops/${shopId}/stock-revisions/${id}`, { method: "PATCH", body: json(body) }),
  postStockRevision: (shopId: number, id: number) =>
    request<StockRevision>(`/shops/${shopId}/stock-revisions/${id}/post`, { method: "POST" }),
  cancelStockRevision: (shopId: number, id: number) =>
    request<StockRevision>(`/shops/${shopId}/stock-revisions/${id}/cancel`, { method: "POST" }),
  exportStockRevision: async (shopId: number, id: number) => {
    const { accessToken, refreshToken, setSession, logout } = useAuth.getState();
    const headers = new Headers();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    const url = `${BASE}/shops/${shopId}/stock-revisions/${id}/export`;
    let res = await fetch(url, { headers });
    if (res.status === 401 && refreshToken) {
      const refreshed = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!refreshed.ok) {
        logout();
        throw new ApiError(401, t("common.sessionExpired"));
      }
      const pair = (await refreshed.json()) as TokenPair;
      setSession(pair.access_token, pair.refresh_token, pair.user);
      headers.set("Authorization", `Bearer ${pair.access_token}`);
      res = await fetch(url, { headers });
    }
    if (!res.ok) throw new ApiError(res.status, t("errors.downloadRevision"));
    const blob = await res.blob();
    downloadBlob(blob, `revision-${id}.xlsx`);
  },

  crew: (shopId: number) => request<CrewMember[]>(`/shops/${shopId}/crew`),
  staff: (shopId: number) => request<User[]>(`/shops/${shopId}/staff`),
  createStaff: (shopId: number, body: object) =>
    request<User>(`/shops/${shopId}/staff`, { method: "POST", body: json(body) }),
  patchStaff: (shopId: number, id: number, body: object) =>
    request<User>(`/shops/${shopId}/staff/${id}`, { method: "PATCH", body: json(body) }),

  currentShift: (shopId: number, cash_register_id?: number) => {
    const q = new URLSearchParams({ shop_id: String(shopId) });
    if (cash_register_id != null) q.set("cash_register_id", String(cash_register_id));
    return request<Shift | null>(`/shifts/current?${q}`);
  },
  openShift: (
    shopId: number,
    opening_cash: number,
    barista_id?: number,
    cash_register_id?: number,
  ) =>
    request<Shift>("/shifts/open", {
      method: "POST",
      body: json({ shop_id: shopId, opening_cash, barista_id, cash_register_id }),
    }),
  closeShift: (id: number, closing_cash: number, force = false) =>
    request<Shift>(`/shifts/${id}/close`, { method: "POST", body: json({ closing_cash, force }) }),
  cashMove: (id: number, body: object) =>
    request(`/shifts/${id}/cash-movements`, { method: "POST", body: json(body) }),
  shifts: (shopId: number) => request<Shift[]>(`/shops/${shopId}/shifts`),

  cashRegisters: (shopId: number, include_inactive = false) =>
    request<CashRegister[]>(
      `/shops/${shopId}/cash-registers${include_inactive ? "?include_inactive=true" : ""}`,
    ),
  createCashRegister: (shopId: number, name: string) =>
    request<CashRegister>(`/shops/${shopId}/cash-registers`, {
      method: "POST",
      body: json({ name }),
    }),
  patchCashRegister: (shopId: number, id: number, body: object) =>
    request<CashRegister>(`/shops/${shopId}/cash-registers/${id}`, {
      method: "PATCH",
      body: json(body),
    }),

  createSale: (
    shopId: number,
    items: {
      product_id: number;
      quantity: number;
      variant_id?: number | null;
      discount?: { type: "percent" | "amount"; value: number } | null;
    }[],
    payment_type: "cash" | "card",
    barista_id?: number,
    cash_register_id?: number,
    discount?: { type: "percent" | "amount"; value: number } | null,
  ) =>
    request<Sale>("/sales", {
      method: "POST",
      body: json({ shop_id: shopId, items, payment_type, barista_id, cash_register_id, discount }),
    }),
  findSale: (shopId: number, saleId: number) =>
    request<Sale>(`/shops/${shopId}/sales/${saleId}`),
  refundSale: (shopId: number, saleId: number, restore_stock = false) =>
    request<Sale>(`/sales/${saleId}/refund`, {
      method: "POST",
      body: json({ shop_id: shopId, restore_stock }),
    }),
  retryFiscal: (shopId: number, saleId: number) =>
    request<Sale>(`/shops/${shopId}/sales/${saleId}/fiscalize`, { method: "POST" }),

  expenses: (shopId: number) => request<Expense[]>(`/shops/${shopId}/expenses`),
  createExpense: (shopId: number, body: object) =>
    request<Expense>(`/shops/${shopId}/expenses`, { method: "POST", body: json(body) }),

  summary: (shopId: number, from: string, to: string) =>
    request<ReportSummary>(`/shops/${shopId}/reports/summary?from=${from}&to=${to}`),
  topProducts: (shopId: number, from: string, to: string) =>
    request<TopProduct[]>(`/shops/${shopId}/reports/top-products?from=${from}&to=${to}`),
  daily: (shopId: number, from: string, to: string) =>
    request<DailyPoint[]>(`/shops/${shopId}/reports/daily?from=${from}&to=${to}`),
  sellers: (shopId: number, from: string, to: string) =>
    request<SellerPoint[]>(`/shops/${shopId}/reports/sellers?from=${from}&to=${to}`),
  fiscalReceipts: (shopId: number, from: string, to: string) =>
    request<FiscalReceipt[]>(`/shops/${shopId}/reports/fiscal?from=${from}&to=${to}`),
  exportReport: async (shopId: number, from: string, to: string) => {
    const { accessToken, refreshToken, setSession, logout } = useAuth.getState();
    const headers = new Headers();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    let res = await fetch(`${BASE}/shops/${shopId}/reports/export?from=${from}&to=${to}`, { headers });
    if (res.status === 401 && refreshToken) {
      const refreshed = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!refreshed.ok) {
        logout();
        throw new ApiError(401, t("common.sessionExpired"));
      }
      const pair = (await refreshed.json()) as TokenPair;
      setSession(pair.access_token, pair.refresh_token, pair.user);
      headers.set("Authorization", `Bearer ${pair.access_token}`);
      res = await fetch(`${BASE}/shops/${shopId}/reports/export?from=${from}&to=${to}`, { headers });
    }
    if (!res.ok) throw new ApiError(res.status, t("errors.downloadReport"));
    const blob = await res.blob();
    downloadBlob(blob, `sanaq-${from}-${to}.xlsx`);
  },
};

export { ApiError };
