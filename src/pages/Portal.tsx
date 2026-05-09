import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogOut, FileText, Shield, Siren, ListChecks, BarChart3 } from "lucide-react";
import { CustomerDocuments } from "@/components/CustomerDocuments";
import { format } from "date-fns";
import { da } from "date-fns/locale";

const Portal = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["portal-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, address, contact_person, operation_type")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assessments } = useQuery({
    queryKey: ["portal-assessments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, customer_id, assessment_date, version, consultant_name")
        .eq("status", "completed")
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reports } = useQuery({
    queryKey: ["portal-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_reports")
        .select("id, customer_id, file_name, report_type, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: nis2Plans } = useQuery({
    queryKey: ["portal-nis2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nis2_plans")
        .select("id, customer_id, title, version, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: emergencyPlans } = useQuery({
    queryKey: ["portal-emergency"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_plans")
        .select("id, customer_id, title, version, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!customers || customers.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero p-4">
        <Card className="max-w-md p-8 shadow-elevated">
          <h1 className="mb-3 text-2xl font-bold text-foreground">Ingen adgang endnu</h1>
          <p className="mb-6 text-muted-foreground">
            Din konto ({userEmail}) er ikke koblet til nogen kunde. Kontakt din konsulent for at få adgang.
          </p>
          <Button onClick={handleSignOut} variant="outline" className="gap-2">
            <LogOut className="h-4 w-4" />
            Log ud
          </Button>
        </Card>
      </div>
    );
  }

  const byCustomer = <T extends { customer_id: string }>(arr: T[] | undefined, cid: string) =>
    (arr ?? []).filter((x) => x.customer_id === cid);

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Kunde-portal</h1>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <Button onClick={handleSignOut} variant="ghost" className="gap-2">
            <LogOut className="h-4 w-4" />
            Log ud
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        {customers.map((customer) => {
          const myAssessments = byCustomer(assessments, customer.id);
          const myReports = byCustomer(reports, customer.id);
          const myNis2 = byCustomer(nis2Plans, customer.id);
          const myEmerg = byCustomer(emergencyPlans, customer.id);

          return (
            <Card key={customer.id} className="p-6 shadow-elevated">
              <div className="mb-6 border-b border-border pb-4">
                <h2 className="text-2xl font-bold text-foreground">{customer.name}</h2>
                {customer.address && (
                  <p className="text-sm text-muted-foreground">{customer.address}</p>
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Section
                  icon={<BarChart3 className="h-5 w-5 text-primary" />}
                  title="Sikkerhedsvurderinger"
                  empty="Ingen færdige vurderinger endnu"
                  items={myAssessments.map((a) => ({
                    key: a.id,
                    title: `${format(new Date(a.assessment_date), "d. MMM yyyy", { locale: da })}${a.version > 1 ? ` (v${a.version})` : ""}`,
                    subtitle: `Konsulent: ${a.consultant_name}`,
                    to: `/portal/assessments/${a.id}`,
                  }))}
                />

                <Section
                  icon={<FileText className="h-5 w-5 text-primary" />}
                  title="Sikkerhedsrapporter"
                  empty="Ingen rapporter"
                  items={myReports.map((r) => ({
                    key: r.id,
                    title: r.file_name,
                    subtitle: format(new Date(r.created_at), "d. MMM yyyy", { locale: da }),
                  }))}
                />

                <Section
                  icon={<Shield className="h-5 w-5 text-primary" />}
                  title="NIS2 sikkerhedsplaner"
                  empty="Ingen planer"
                  items={myNis2.map((p) => ({
                    key: p.id,
                    title: `${p.title}${p.version > 1 ? ` (v${p.version})` : ""}`,
                    subtitle: `Opdateret ${format(new Date(p.updated_at), "d. MMM yyyy", { locale: da })}`,
                  }))}
                />

                <Section
                  icon={<Siren className="h-5 w-5 text-primary" />}
                  title="Beredskabsplaner"
                  empty="Ingen planer"
                  items={myEmerg.map((p) => ({
                    key: p.id,
                    title: `${p.title}${p.version > 1 ? ` (v${p.version})` : ""}`,
                    subtitle: `Opdateret ${format(new Date(p.updated_at), "d. MMM yyyy", { locale: da })}`,
                  }))}
                />
              </div>

              <div className="mt-6 border-t border-border pt-6">
                <CustomerDocuments customerId={customer.id} canUpload={false} />
              </div>
            </Card>
          );
        })}
      </main>
    </div>
  );
};

interface SectionItem {
  key: string;
  title: string;
  subtitle?: string;
  to?: string;
}

const Section = ({
  icon,
  title,
  items,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  items: SectionItem[];
  empty: string;
}) => (
  <div>
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h3 className="font-semibold text-foreground">{title}</h3>
    </div>
    {items.length === 0 ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : (
      <ul className="space-y-2">
        {items.map((item) =>
          item.to ? (
            <li key={item.key}>
              <Link
                to={item.to}
                className="block rounded-md border border-border p-3 transition-colors hover:bg-accent"
              >
                <p className="font-medium text-foreground">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                )}
              </Link>
            </li>
          ) : (
            <li key={item.key} className="rounded-md border border-border p-3">
              <p className="font-medium text-foreground">{item.title}</p>
              {item.subtitle && (
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              )}
            </li>
          )
        )}
      </ul>
    )}
  </div>
);

export default Portal;
