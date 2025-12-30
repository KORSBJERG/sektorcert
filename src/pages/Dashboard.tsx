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
import { 
  Shield, 
  FileText, 
  Users, 
  LogOut, 
  BarChart3, 
  ScrollText, 
  Trash2,
  Plus,
  ChevronRight,
  Server,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { HuntressBulkImport } from "@/components/HuntressBulkImport";

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
    <div className="min-h-screen bg-background">
      {/* Top Banner */}
      <div className="bg-primary/10 border-b border-primary/20 py-2">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-primary">
            Enterprise-grade cybersikkerhed for alle virksomheder
          </p>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <span className="text-2xl font-bold text-foreground tracking-tight">PEAKNET</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link to="/customers" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Kunder
              </Link>
              <Link to="/analytics" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Analytics
              </Link>
              <Link to="/audit-logs" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Audit Log
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <HuntressBulkImport onImportComplete={() => queryClient.invalidateQueries({ queryKey: ["customers"] })} />
              <Link to="/customers/new">
                <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  Ny Kunde
                </Button>
              </Link>
              <Button variant="ghost" onClick={handleLogout} size="icon">
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24 bg-gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            <span className="text-foreground">Hackere Stoppet.</span>
            <br />
            <span className="text-gradient">Din Fremtid Sikret.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Vi beskytter din virksomhed. En platform bygget til organisationer som din, 
            med 24/7 AI-assisteret overvågning for kontinuerlig beskyttelse.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/customers/new">
              <Button size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-8">
                Start Assessment
              </Button>
            </Link>
            <Link to="/analytics">
              <Button size="lg" variant="ghost" className="gap-2 text-primary hover:text-primary hover:bg-primary/10">
                Se Analytics <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {/* Stats Row */}
          <div className="flex flex-wrap justify-center gap-8 text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">{customers?.length || 0}</span>
              <span>Kunder</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">{assessments?.length || 0}</span>
              <span>Vurderinger</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">25</span>
              <span>Anbefalinger</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="p-8 border-border/50 bg-card hover:border-primary/30 transition-all duration-300 group">
              <div className="mb-6">
                <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <Server className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-primary mb-4">
                  Du Behøver Ikke<br />Administrere Noget
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Vores produkter er bygget til at beskytte organisationer i alle størrelser. 
                  Vi ejer vores teknologi og innoverer hurtigere end andre leverandører.
                </p>
              </div>
              <div className="pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  <span className="text-2xl font-bold text-foreground">{customers?.length || 0}</span> aktive kunder
                </p>
              </div>
            </Card>

            <Card className="p-8 border-border/50 bg-card hover:border-primary/30 transition-all duration-300 group">
              <div className="mb-6">
                <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <AlertTriangle className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-primary mb-4">
                  Expert Threat<br />Hunters, På Dit Hold
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Vores AI-assisterede threat hunters er din fordel mod hackere. 
                  Vi afdækker de nyeste trusler og leder forskning gennem remediation.
                </p>
              </div>
              <div className="pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  <span className="text-2xl font-bold text-foreground">98.8%</span> kundetilfredshed
                </p>
              </div>
            </Card>

            <Card className="p-8 border-border/50 bg-card hover:border-primary/30 transition-all duration-300 group">
              <div className="mb-6">
                <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-primary mb-4">
                  Bygget Til<br />Resultater
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Du får ro i sindet med avancerede løsninger der udvikler sig med trusler. 
                  Ingen huller, ingen blinde vinkler, ingen gætværk.
                </p>
              </div>
              <div className="pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  <span className="text-2xl font-bold text-foreground">4.9/5</span> stjerner baseret på anmeldelser
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Recent Activity Section */}
      <section className="py-12 md:py-16 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Recent Customers */}
            <Card className="p-6 border-border/50 bg-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Seneste Kunder</h2>
                </div>
                <Link to="/customers">
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                    Se alle <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
              
              {loadingCustomers ? (
                <div className="py-12 text-center text-muted-foreground">Indlæser...</div>
              ) : customers && customers.length > 0 ? (
                <div className="space-y-3">
                  {customers.slice(0, 5).map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-4 transition-all hover:bg-secondary/50 hover:border-primary/30"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{customer.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {customer.operation_type} • {customer.contact_person}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Link to={`/customers/${customer.id}`}>
                          <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                            Detaljer
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setCustomerToDelete(customer.id);
                            setCustomerDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="mb-4 text-muted-foreground">Ingen kunder endnu</p>
                  <Link to="/customers/new">
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                      Opret første kunde
                    </Button>
                  </Link>
                </div>
              )}
            </Card>

            {/* Recent Assessments */}
            <Card className="p-6 border-border/50 bg-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Seneste Vurderinger</h2>
                </div>
              </div>
              
              {assessments && assessments.length > 0 ? (
                <div className="space-y-3">
                  {assessments.slice(0, 5).map((assessment) => (
                    <div
                      key={assessment.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-4 transition-all hover:bg-secondary/50 hover:border-primary/30"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {assessment.customers?.name || "Ukendt kunde"}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {format(new Date(assessment.assessment_date), "d. MMMM yyyy", { locale: da })} • {assessment.consultant_name}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Link to={`/assessment/${assessment.id}/report`}>
                          <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                            Se rapport
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setAssessmentToDelete(assessment.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">Ingen vurderinger endnu</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">PEAKNET</span>
              <span className="text-muted-foreground">• Cybersikkerhed Assessment Platform</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/analytics" className="hover:text-primary transition-colors">Analytics</Link>
              <Link to="/audit-logs" className="hover:text-primary transition-colors">Audit Log</Link>
              <Link to="/customers" className="hover:text-primary transition-colors">Kunder</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Delete Assessment Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Bekræft sletning af vurdering</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette denne vurdering? Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssessment} className="bg-destructive hover:bg-destructive/90">
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Customer Dialog */}
      <AlertDialog open={customerDeleteDialogOpen} onOpenChange={setCustomerDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Bekræft sletning af kunde</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette denne kunde? Dette vil også slette alle tilknyttede vurderinger. Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Annuller</AlertDialogCancel>
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