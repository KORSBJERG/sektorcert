import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** When true, allows users with the 'customer' role to access this route. Default: false (consultant-only). */
  allowCustomer?: boolean;
}

const ProtectedRoute = ({ children, allowCustomer = false }: ProtectedRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { role, loading: roleLoading } = useUserRole();
  const location = useLocation();

  useEffect(() => {
    const ensureProfile = async (session: Session | null) => {
      if (!session?.user) return;
      // Ensure a public profile row exists for the current user.
      // This enables the consultant dropdown to list all registered users.
      await supabase
        .from("profiles")
        .upsert(
          {
            user_id: session.user.id,
            email: session.user.email ?? null,
          },
          { onConflict: "user_id" }
        );
    };

    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);

      // Fire-and-forget: don't block routing on profile sync.
      void ensureProfile(session);
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);

      // Fire-and-forget: keep profile table in sync for users that sign in with OAuth.
      void ensureProfile(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthenticated === null || (isAuthenticated && roleLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Customer-role users are restricted to /portal pages
  if (role === "customer" && !allowCustomer && !location.pathname.startsWith("/portal")) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
