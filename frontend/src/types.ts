export type Role = "super_admin" | "owner" | "barista";

export type User = {
  id: number;
  shop_id: number | null;
  role: Role;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  owned_shop_ids: number[];
  has_pin?: boolean;
  can_receive_stock?: boolean;
};

export type CrewMember = {
  id: number;
  full_name: string;
  role: Role;
  can_receive_stock: boolean;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
};

export type LeadStatus = "new" | "contacted" | "closed";

export type Lead = {
  id: number;
  shop_name: string;
  city: string;
  contact_name: string;
  phone: string;
  email: string | null;
  comment: string | null;
  status: LeadStatus;
  created_at: string;
};

export type Shop = {
  id: number;
  name: string;
  address: string | null;
  timezone: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type Category = { id: number; shop_id: number; name: string };

export type Ingredient = {
  stock_item_id: number;
  quantity: string;
  stock_item_name?: string | null;
  unit?: string | null;
};

export type Product = {
  id: number;
  shop_id: number;
  category_id: number | null;
  name: string;
  sale_price: string;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
  category_name?: string | null;
  cost_price?: string | null;
  ingredients: Ingredient[];
};

export type StockItem = {
  id: number;
  shop_id: number;
  name: string;
  base_unit: string;
  purchase_unit: string;
  purchase_to_base: string;
  quantity: string;
  quantity_in_purchase: string;
  min_quantity: string;
  cost_per_base_unit: string;
  updated_at: string;
  is_low: boolean;
};

export type Shift = {
  id: number;
  shop_id: number;
  barista_id: number;
  barista_name?: string | null;
  status: "open" | "closed";
  opening_cash: string;
  closing_cash: string | null;
  opened_at: string;
  closed_at: string | null;
  cash_revenue: string;
  card_revenue: string;
  sales_count: number;
  deposits: string;
  withdrawals: string;
  expected_cash: string;
  cash_difference: string | null;
  sellers?: SellerPoint[];
};

export type SellerPoint = {
  barista_id: number;
  barista_name: string;
  cash_revenue: string;
  card_revenue: string;
  revenue: string;
  sales_count: number;
};

export type StockAlert = {
  stock_item_id: number;
  name: string;
  quantity: string;
  min_quantity: string;
};

export type Sale = {
  id: number;
  total_amount: string;
  payment_type: "cash" | "card";
  is_refunded: boolean;
  created_at: string;
  alerts: StockAlert[];
};

export type Expense = {
  id: number;
  category: string;
  amount: string;
  comment: string | null;
  created_at: string;
};

export type ReportSummary = {
  from_date: string;
  to_date: string;
  cash_revenue: string;
  card_revenue: string;
  revenue: string;
  cost: string;
  profit: string;
  sales_count: number;
  expenses: string;
  net_profit: string;
};

export type TopProduct = {
  product_id: number;
  name: string;
  quantity: number;
  revenue: string;
  profit: string;
};

export type DailyPoint = {
  day: string;
  cash_revenue: string;
  card_revenue: string;
  revenue: string;
  cost: string;
  profit: string;
  sales_count: number;
};

export type AdminStats = {
  shops_count: number;
  active_shops: number;
  users_count: number;
  shops: {
    shop_id: number;
    shop_name: string;
    is_active: boolean;
    revenue: number;
    sales_count: number;
    profit: number;
  }[];
};
