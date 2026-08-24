import { downloadBlob } from "../lib/utils";
import { useAuth } from "../store/auth";
import type {
  AdminStats,
  Category,
  CrewMember,
  DailyPoint,
  Expense,
  FiscalReceipt,
  Lead,
  LeadStatus,
  Product,
  ReportSummary,
  Sale,
  SellerPoint,
  Shift,
  Shop,
  StockItem,
  StockJournalEntry,
  StockRevision,
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

  if (res.status === 401 && retry && refreshToken && !path.startsWith("/auth/")) {
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
    const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail ?? data);
    throw new ApiError(res.status, detail || res.statusText);
  }
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  login: (login: string, password: string) =>
    request<TokenPair>("/auth/login", { method: "POST", body: json({ login, password }) }),
  loginPin: (shop_id: number, pin_code: string) =>
    request<TokenPair>("/auth/login-pin", { method: "POST", body: json({ shop_id, pin_code }) }),
  identifyPin: (shop_id: number, pin_code: string) =>
    request<CrewMember>("/auth/identify-pin", { method: "POST", body: json({ shop_id, pin_code }) }),
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
  updateShopSettings: (shopId: number, body: { name?: string; address?: string; timezone?: string }) =>
    request<Shop>(`/shops/${shopId}`, { method: "PATCH", body: json(body) }),
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
  adminStats: () => request<AdminStats>("/admin/stats"),

  categories: (shopId: number) => request<Category[]>(`/shops/${shopId}/categories`),
  createCategory: (shopId: number, name: string) =>
    request<Category>(`/shops/${shopId}/categories`, { method: "POST", body: json({ name }) }),
  deleteCategory: (shopId: number, id: number) =>
    request<void>(`/shops/${shopId}/categories/${id}`, { method: "DELETE" }),

  products: (shopId: number) => request<Product[]>(`/shops/${shopId}/products`),
  createProduct: (shopId: number, body: object) =>
    request<Product>(`/shops/${shopId}/products`, { method: "POST", body: json(body) }),
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

  stock: (shopId: number) => request<StockItem[]>(`/shops/${shopId}/stock-items`),
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
  stockMove: (shopId: number, id: number, body: object) =>
    request(`/shops/${shopId}/stock-items/${id}/movements`, { method: "POST", body: json(body) }),
  stockJournal: (shopId: number, itemId?: number) =>
    request<StockJournalEntry[]>(
      `/shops/${shopId}/stock-journal${itemId ? `?item_id=${itemId}` : ""}`,
    ),
  stockRevisions: (shopId: number) => request<StockRevision[]>(`/shops/${shopId}/stock-revisions`),
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

  crew: (shopId: number) => request<CrewMember[]>(`/shops/${shopId}/crew`),
  staff: (shopId: number) => request<User[]>(`/shops/${shopId}/staff`),
  createStaff: (shopId: number, body: object) =>
    request<User>(`/shops/${shopId}/staff`, { method: "POST", body: json(body) }),
  patchStaff: (shopId: number, id: number, body: object) =>
    request<User>(`/shops/${shopId}/staff/${id}`, { method: "PATCH", body: json(body) }),

  currentShift: (shopId: number) =>
    request<Shift | null>(`/shifts/current?shop_id=${shopId}`),
  openShift: (shopId: number, opening_cash: number, barista_id?: number) =>
    request<Shift>("/shifts/open", { method: "POST", body: json({ shop_id: shopId, opening_cash, barista_id }) }),
  closeShift: (id: number, closing_cash: number, force = false) =>
    request<Shift>(`/shifts/${id}/close`, { method: "POST", body: json({ closing_cash, force }) }),
  cashMove: (id: number, body: object) =>
    request(`/shifts/${id}/cash-movements`, { method: "POST", body: json(body) }),
  shifts: (shopId: number) => request<Shift[]>(`/shops/${shopId}/shifts`),

  createSale: (
    shopId: number,
    items: { product_id: number; quantity: number }[],
    payment_type: "cash" | "card",
    barista_id?: number,
  ) => request<Sale>("/sales", { method: "POST", body: json({ shop_id: shopId, items, payment_type, barista_id }) }),
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
        throw new ApiError(401, "Сессия истекла");
      }
      const pair = (await refreshed.json()) as TokenPair;
      setSession(pair.access_token, pair.refresh_token, pair.user);
      headers.set("Authorization", `Bearer ${pair.access_token}`);
      res = await fetch(`${BASE}/shops/${shopId}/reports/export?from=${from}&to=${to}`, { headers });
    }
    if (!res.ok) throw new ApiError(res.status, "Не удалось скачать отчёт");
    const blob = await res.blob();
    downloadBlob(blob, `sanaq-${from}-${to}.xlsx`);
  },
};

export { ApiError };
