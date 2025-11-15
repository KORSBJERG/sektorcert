import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Shield, FileText, Users, LogOut, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logget ud");
    navigate("/auth");
  };

  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: assessments } = useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">SektorCERT</h1>
                <p className="text-sm text-muted-foreground">Cybersikkerhed Assessment</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/analytics">
                <Button variant="outline" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Button>
              </Link>
              <Link to="/customers/new">
                <Button className="gap-2 bg-gradient-primary hover:opacity-90">
                  <Plus className="h-4 w-4" />
                  Ny Kunde
                </Button>
              </Link>
              <Button variant="outline" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                Log ud
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Kunder</p>
                <p className="text-2xl font-bold text-foreground">{customers?.length || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
                <FileText className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vurderinger</p>
                <p className="text-2xl font-bold text-foreground">{assessments?.length || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <Shield className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">25 Anbefalinger</p>
                <p className="text-2xl font-bold text-foreground">Aktive</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 shadow-elevated">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Seneste Kunder</h2>
          {loadingCustomers ? (
            <div className="py-8 text-center text-muted-foreground">Indlæser...</div>
          ) : customers && customers.length > 0 ? (
            <div className="space-y-3">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                >
                  <div>
                    <h3 className="font-semibold text-foreground">{customer.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {customer.operation_type} • {customer.contact_person}
                    </p>
                  </div>
                  <Link to={`/customers/${customer.id}`}>
                    <Button variant="outline">Se detaljer</Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground">Ingen kunder endnu</p>
              <Link to="/customers/new">
                <Button className="bg-gradient-primary hover:opacity-90">Opret første kunde</Button>
              </Link>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
