import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "../components/ProtectedRoute";
import { AdminLoginPage } from "../pages/AdminLoginPage";
import { AdminFormDetailPage } from "../pages/AdminFormDetailPage";
import { AdminPage } from "../pages/AdminPage";
import { FormTypePage } from "../pages/FormTypePage";
import { FormPage } from "../pages/FormPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProfilePage } from "../pages/ProfilePage";
import { RecordsPage } from "../pages/RecordsPage";

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route element={<ProtectedRoute requireUser />}>
          <Route path="/form-type" element={<FormTypePage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/form/:type" element={<FormPage />} />
        </Route>

        <Route element={<ProtectedRoute requireAdmin />}>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/forms/:id" element={<AdminFormDetailPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  );
}
