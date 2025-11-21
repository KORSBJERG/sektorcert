import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Shield, FileText, Users, LogOut, BarChart3, ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState<string | null>(null);
  const [customerDeleteDialogOpen, setCustomerDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logget ud");
    navigate("/auth");
  };

  const handleDeleteAssessment = async () => {
    if (!assessmentToDelete) return;

    try {
      const { error } = await supabase
        .from("assessments")
        .delete()
        .eq("id", assessmentToDelete);

      if (error) throw error;

      toast.success("Vurdering slettet");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      setDeleteDialogOpen(false);
      setAssessmentToDelete(null);
    } catch (error) {
      toast.error("Der opstod en fejl ved sletning af vurderingen");
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;

    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerToDelete);

      if (error) throw error;

      toast.success("Kunde slettet");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      setCustomerDeleteDialogOpen(false);
      setCustomerToDelete(null);
    } catch (error) {
      toast.error("Der opstod en fejl ved sletning af kunden");
    }
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
                <h1 className="text-2xl font-bold text-foreground">Peaknet</h1>
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
              <Link to="/audit-logs">
                <Button variant="outline" className="gap-2">
                  <ScrollText className="h-4 w-4" />
                  Audit Log
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

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Seneste Kunder</h2>
              <Link to="/customers">
                <Button variant="outline" size="sm">Se alle</Button>
              </Link>
            </div>
            {loadingCustomers ? (
              <div className="py-8 text-center text-muted-foreground">Indlæser...</div>
            ) : customers && customers.length > 0 ? (
              <div className="space-y-3">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{customer.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {customer.operation_type} • {customer.contact_person}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/customers/${customer.id}`}>
                        <Button variant="outline" size="sm">Se detaljer</Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCustomerToDelete(customer.id);
                          setCustomerDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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

          <Card className="p-6 shadow-elevated">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Seneste Vurderinger</h2>
            {assessments && assessments.length > 0 ? (
              <div className="space-y-3">
                {assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">
                        {assessment.customers?.name || "Ukendt kunde"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(assessment.assessment_date), "d. MMMM yyyy", { locale: da })} • {assessment.consultant_name}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/assessment/${assessment.id}/report`}>
                        <Button variant="outline" size="sm">Se detaljer</Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAssessmentToDelete(assessment.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="mb-4 text-muted-foreground">Ingen vurderinger endnu</p>
              </div>
            )}
          </Card>
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekræft sletning af vurdering</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette denne vurdering? Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssessment} className="bg-destructive hover:bg-destructive/90">
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={customerDeleteDialogOpen} onOpenChange={setCustomerDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekræft sletning af kunde</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette denne kunde? Dette vil også slette alle tilknyttede vurderinger. Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive hover:bg-destructive/90">
              Slet kunde
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
