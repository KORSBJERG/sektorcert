import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ArrowLeft, Building2, Mail, Phone, MapPin, RefreshCw, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HuntressImportDialog } from "@/components/HuntressImportDialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Customers = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();

  const { data: customers, isLoading } = useQuery({
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

  const huntressCount = customers?.filter((c: any) => c.huntress_organization_id).length ?? 0;

  const handleSyncAll = async () => {
    setSyncing(true);
    toast({ title: "Synkroniserer Huntress…", description: `${huntressCount} kunder` });
    try {
      const { data, error } = await supabase.functions.invoke("huntress-sync-all", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Huntress-data opdateret",
        description: `${data.synced} af ${data.total} synkroniseret${data.failed ? ` (${data.failed} fejlede)` : ""}.`,
      });
      qc.invalidateQueries({ queryKey: ["huntress-live"] });
    } catch (e: any) {
      toast({ title: "Fejl", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Tilbage
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-foreground">Alle Kunder</h1>
            </div>
            <div className="flex items-center gap-2">
              {huntressCount > 0 && (
                <Button variant="outline" className="gap-2" onClick={handleSyncAll} disabled={syncing}>
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Synkroniserer…" : `Sync Huntress (${huntressCount})`}
                </Button>
              )}
              <HuntressImportDialog />
              <Link to="/customers/new">
                <Button className="gap-2 bg-gradient-primary hover:opacity-90">
                  <Plus className="h-4 w-4" />
                  Ny Kunde
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Indlæser...</div>
        ) : customers && customers.length > 0 ? (
          <Card className="shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Kontaktperson</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{customer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary">
                        {customer.operation_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.contact_person || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.contact_email ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[200px]">{customer.contact_email}</span>
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.contact_phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {customer.contact_phone}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.address ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[220px]">{customer.address}</span>
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="p-12 text-center shadow-card">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">Ingen kunder endnu</h3>
            <p className="mb-4 text-muted-foreground">Kom i gang ved at oprette din første kunde</p>
            <Link to="/customers/new">
              <Button className="bg-gradient-primary hover:opacity-90">Opret første kunde</Button>
            </Link>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Customers;
