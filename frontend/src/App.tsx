import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { OrnamentSprite } from "./components/Glyph";
import { Guard } from "./components/Guard";
import { Shell } from "./components/Shell";
import { AdminPage } from "./pages/admin/AdminPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { LeadsPage } from "./pages/admin/LeadsPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { MenuBuilderPage } from "./pages/owner/MenuBuilderPage";
import { DashboardPage } from "./pages/owner/DashboardPage";
import { ExpensesPage } from "./pages/owner/ExpensesPage";
import { ProductsPage } from "./pages/owner/ProductsPage";
import { ShiftsPage } from "./pages/owner/ShiftsPage";
import { SettingsPage } from "./pages/owner/SettingsPage";
import { StaffPage } from "./pages/owner/StaffPage";
import { StockItemPage } from "./pages/owner/StockItemPage";
import { StockRevisionPage } from "./pages/owner/StockRevisionPage";
import { StockRevisionsPage } from "./pages/owner/StockRevisionsPage";
import { StockMovesPage } from "./pages/owner/StockMovesPage";
import { StockPage } from "./pages/owner/StockPage";
import { PosPage } from "./pages/pos/PosPage";
import { VitrinePage } from "./pages/VitrinePage";

export function App() {
  return (
    <BrowserRouter>
      <OrnamentSprite />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pin" element={<Navigate to="/pos" replace />} />
        <Route path="/pos" element={<PosPage />} />
        <Route element={<Guard roles={["barista", "owner", "super_admin"]} />}>
          <Route path="/vitrine" element={<VitrinePage />} />
        </Route>
        <Route element={<Guard roles={["owner", "super_admin"]} />}>
          <Route element={<Shell kind="owner" />}>
            <Route path="/owner" element={<DashboardPage />} />
            <Route path="/owner/products" element={<ProductsPage />} />
            <Route path="/owner/menu" element={<MenuBuilderPage />} />
            <Route path="/owner/stock" element={<StockPage />} />
            <Route path="/owner/stock/item/:itemId" element={<StockItemPage />} />
            <Route path="/owner/stock/moves" element={<StockMovesPage />} />
            <Route path="/owner/stock/revisions" element={<StockRevisionsPage />} />
            <Route path="/owner/stock/revisions/:revisionId" element={<StockRevisionPage />} />
            <Route path="/owner/staff" element={<StaffPage />} />
            <Route path="/owner/expenses" element={<ExpensesPage />} />
            <Route path="/owner/shifts" element={<ShiftsPage />} />
            <Route path="/owner/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route element={<Guard roles={["super_admin"]} />}>
          <Route element={<Shell kind="admin" />}>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/leads" element={<LeadsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
