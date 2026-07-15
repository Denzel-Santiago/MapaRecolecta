import type { ReactNode } from "react";
import { canAccessDesigner, getAuthSession, type AuthSession } from "../services/authService";

export default function ProtectedRoute({
  session,
  children,
  fallback,
}: {
  session: AuthSession | null;
  children: ReactNode;
  fallback: ReactNode;
}) {
  const currentSession = session ?? getAuthSession();

  if (!currentSession || !canAccessDesigner(currentSession.roleId)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
