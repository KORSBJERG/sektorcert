import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

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

  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
