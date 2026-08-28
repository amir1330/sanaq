export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type StockStats = {
  total_count: number;
  low_count: number;
  shelf_value: string;
};

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
  can_apply_discount?: boolean;
};

export type CrewMember = {
  id: number;
  full_name: string;
  role: Role;
  can_receive_stock: boolean;
  can_apply_discount: boolean;
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
  business_type?: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  webkassa_enabled?: boolean;
  webkassa_login?: string | null;
  webkassa_cashbox_number?: string | null;
  webkassa_has_password?: boolean;
  webkassa_has_api_key?: boolean;
};

export type Category = {
  id: number;
  shop_id: number;
  name: string;
  name_kk?: string | null;
  name_en?: string | null;
  sort_order?: number;
  color?: string | null;
  icon?: string | null;
};

export type Ingredient = {
  stock_item_id: number;
  quantity: string;
  stock_item_name?: string | null;
  stock_item_sku?: string | null;
  unit?: string | null;
};

export type ProductVariant = {
  id: number;
  product_id: number;
  name: string;
  name_kk?: string | null;
  name_en?: string | null;
  sort_order: number;
  sale_price: string;
  sku?: string | null;
  barcode?: string | null;
  is_default: boolean;
  is_active: boolean;
  ingredients: Ingredient[];
};

export type Product = {
  id: number;
  shop_id: number;
  category_id: number | null;
  name: string;
  name_kk?: string | null;
  name_en?: string | null;
  sku?: string | null;
  barcode?: string | null;
  sale_price: string;
  sort_order?: number;
  is_active: boolean;
  is_service?: boolean;
  image_url: string | null;
  created_at: string;
  category_name?: string | null;
  category_name_kk?: string | null;
  category_name_en?: string | null;
  cost_price?: string | null;
  fiscal_position_code?: string | null;
  tax_percent?: string;
  tax_type?: number;
  ingredients: Ingredient[];
  variants?: ProductVariant[];
};

export type VitrineItem = {
  id: number;
  product_id: number;
  sort_order: number;
  product: Product;
};

export type VitrineColumn = {
  id: number;
  title: string;
  sort_order: number;
  header_style: "ornament" | "line" | "none" | string;
  items: VitrineItem[];
};

export type VitrineLayout = {
  columns: VitrineColumn[];
};

export type PublicVitrineMenu = {
  shop: { id: number; name: string; logo_url: string | null };
  layout: VitrineLayout;
  categories: Category[];
  products: Product[];
};

export type StockJournalKind =
  | "income"
  | "writeoff"
  | "correction"
  | "sale"
  | "refund"
  | "transfer_out"
  | "transfer_in"
  | "regrade_out"
  | "regrade_in"
  | "created"
  | "updated"
  | "deleted";

export type StockJournalEntry = {
  id: string;
  kind: StockJournalKind;
  stock_item_id: number | null;
  item_name: string;
  base_unit: string | null;
  purchase_unit: string | null;
  quantity_base: string | null;
  quantity_purchase: string | null;
  price_total: string | null;
  actor_name: string | null;
  comment: string | null;
  created_at: string;
};

export type StockRevisionStatus = "draft" | "posted" | "cancelled";

export type StockRevisionLine = {
  id: number;
  stock_item_id: number | null;
  stock_item_name: string;
  base_unit: string;
  expected_quantity: string;
  counted_quantity: string | null;
  difference_quantity: string | null;
  cost_per_base_unit: string;
  value: string | null;
  comment: string | null;
};

export type StockRevision = {
  id: number;
  shop_id: number;
  status: StockRevisionStatus;
  comment: string | null;
  created_by: number | null;
  created_by_name: string | null;
  posted_by: number | null;
  posted_by_name: string | null;
  created_at: string;
  posted_at: string | null;
  cancelled_at: string | null;
  line_count: number;
  counted_count: number;
  shortage_count: number;
  surplus_count: number;
  difference_value: string;
  lines: StockRevisionLine[];
};

export type StockItem = {
  id: number;
  shop_id: number;
  name: string;
  sku?: string | null;
  base_unit: string;
  purchase_unit: string;
  purchase_to_base: string;
  quantity: string;
  quantity_in_purchase: string;
  min_quantity: string;
  cost_per_base_unit: string;
  value?: string;
  image_url: string | null;
  updated_at: string;
  last_income_at?: string | null;
  is_low: boolean;
  is_ingredient?: boolean;
  on_pos?: boolean;
  has_pos_product?: boolean;
};

export type CashRegister = {
  id: number;
  shop_id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  has_open_shift: boolean;
};

export type Shift = {
  id: number;
  shop_id: number;
  cash_register_id: number;
  cash_register_name?: string | null;
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
  fiscal_pending_count?: number;
  z_report_number?: string | null;
  z_report_sent_at?: string | null;
  stock_revision_id?: number | null;
  sales?: ShiftSale[];
};

export type ShiftSale = {
  id: number;
  total_amount: string;
  payment_type: "cash" | "card";
  is_refunded: boolean;
  created_at: string;
  barista_name?: string | null;
  discount_amount?: string;
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

export type FiscalStatus = "pending" | "sent" | "failed" | "skipped";

export type Discount = { type: "percent" | "amount"; value: number | string };

export type SaleItem = {
  id: number;
  product_id: number;
  product_name?: string | null;
  variant_id?: number | null;
  variant_name?: string | null;
  quantity: number;
  price_snapshot: string;
  cost_price_snapshot: string;
  discount_type?: "percent" | "amount" | null;
  discount_value?: string | null;
  discount_amount?: string;
  line_total?: string;
};

export type Sale = {
  id: number;
  shop_id?: number;
  shift_id?: number;
  barista_id?: number;
  subtotal_amount?: string;
  discount_type?: "percent" | "amount" | null;
  discount_value?: string | null;
  discount_amount?: string;
  total_amount: string;
  payment_type: "cash" | "card";
  is_refunded: boolean;
  created_at: string;
  fiscal_status?: FiscalStatus;
  fiscal_receipt_number?: string | null;
  fiscal_receipt_url?: string | null;
  fiscal_error?: string | null;
  items?: SaleItem[];
  alerts: StockAlert[];
};

export type FiscalReceipt = {
  id: number;
  created_at: string;
  total_amount: string;
  payment_type: string;
  fiscal_status: FiscalStatus;
  fiscal_receipt_number: string | null;
  fiscal_receipt_url: string | null;
  fiscal_error: string | null;
  fiscal_attempts: number;
  barista_name: string | null;
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
  revision_shortage?: string;
  net_profit: string;
  fiscal_sent_count?: number;
  fiscal_failed_count?: number;
  fiscal_pending_count?: number;
  fiscal_skipped_count?: number;
};

export type TopProduct = {
  product_id: number;
  variant_id?: number | null;
  name: string;
  name_kk?: string | null;
  name_en?: string | null;
  variant_name?: string | null;
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
  unfiscalized_count?: number;
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

export type AdminUser = {
  id: number;
  shop_id: number | null;
  shop_name: string | null;
  role: Role;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  can_receive_stock: boolean;
  can_apply_discount?: boolean;
  has_pin: boolean;
};
