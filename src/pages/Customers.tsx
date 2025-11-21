import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, ArrowLeft, Building2, Mail, Phone, MapPin } from "lucide-react";

const Customers = () => {
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
            <Link to="/customers/new">
              <Button className="gap-2 bg-gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4" />
                Ny Kunde
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Indlæser...</div>
        ) : customers && customers.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {customers.map((customer) => (
              <Card key={customer.id} className="p-6 shadow-card hover:shadow-elevated transition-shadow">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
                    {customer.operation_type}
                  </span>
                </div>

                <h3 className="mb-3 text-xl font-semibold text-foreground">{customer.name}</h3>

                <div className="space-y-2 text-sm text-muted-foreground">
                  {customer.contact_person && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{customer.contact_person}</span>
                    </div>
                  )}
                  {customer.contact_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{customer.contact_email}</span>
                    </div>
                  )}
                  {customer.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{customer.contact_phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{customer.address}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <Link to={`/customers/${customer.id}`}>
                    <Button variant="outline" className="w-full">
                      Se detaljer
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
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
