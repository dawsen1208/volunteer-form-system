import { Navigate, Outlet } from "react-router-dom";

import { getAuth, isAdmin, isLoggedIn, isUser } from "../store/auth";

type Props = {
  requireAdmin?: boolean;
  requireUser?: boolean;
};

export function ProtectedRoute(props: Props) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  if (props.requireAdmin && !isAdmin()) {
    return <Navigate to="/login" replace />;
  }

  if (props.requireUser && !isUser()) {
    const auth = getAuth();
    return <Navigate to={auth?.role === "admin" ? "/admin" : "/login"} replace />;
  }

  return <Outlet />;
}
