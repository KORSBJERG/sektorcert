import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, FileText } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: assessments } = useQuery({
    queryKey: ["customer-assessments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <Card className="p-8">
          <p className="mb-4 text-foreground">Kunde ikke fundet</p>
          <Link to="/">
            <Button>Tilbage til oversigt</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Tilbage
              </Button>
            </Link>
            <Button
              onClick={() => navigate(`/assessments/new?customer=${id}`)}
              className="gap-2 bg-gradient-primary hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Ny Vurdering
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6 p-6 shadow-elevated">
          <h1 className="mb-4 text-2xl font-bold text-foreground">{customer.name}</h1>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground">Adresse</p>
              <p className="text-foreground">{customer.address || "Ikke angivet"}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Driftstype</p>
              <p className="text-foreground">{customer.operation_type}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Kontaktperson</p>
              <p className="text-foreground">{customer.contact_person || "Ikke angivet"}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Email</p>
              <p className="text-foreground">{customer.contact_email || "Ikke angivet"}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-elevated">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Sikkerhedsvurderinger</h2>
          {assessments && assessments.length > 0 ? (
            <div className="space-y-3">
              {assessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {format(new Date(assessment.assessment_date), "d. MMMM yyyy", {
                          locale: da,
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Konsulent: {assessment.consultant_name}
                      </p>
                      <p className="text-xs text-muted-foreground">Status: {assessment.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => navigate(`/assessments/${assessment.id}`)}
                      variant="outline"
                    >
                      {assessment.status === "completed" ? "Se rapport" : "Fortsæt vurdering"}
                    </Button>
                    {assessment.status === "completed" && (
                      <Button
                        onClick={() => navigate(`/assessments/${assessment.id}/report`)}
                        variant="outline"
                      >
                        PDF Rapport
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground">Ingen vurderinger endnu</p>
              <Button
                onClick={() => navigate(`/assessments/new?customer=${id}`)}
                className="bg-gradient-primary hover:opacity-90"
              >
                Opret første vurdering
              </Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default CustomerDetail;
