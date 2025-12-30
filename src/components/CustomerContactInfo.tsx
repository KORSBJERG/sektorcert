import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  User,
  Search,
  Loader2,
  Briefcase,
  Users,
  Calendar,
} from "lucide-react";

interface CustomerContactInfoProps {
  customer: {
    id: string;
    name: string;
    address: string | null;
    contact_person: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    operation_type: string;
  };
}

interface CVRData {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  cvr: string;
  industry: string | null;
  companyType: string | null;
  employees: string | null;
  founded: string | null;
  city: string | null;
  zipcode: string | null;
}

export const CustomerContactInfo = ({ customer }: CustomerContactInfoProps) => {
  const [cvrNumber, setCvrNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cvrData, setCvrData] = useState<CVRData | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCvrLookup = async () => {
    if (!cvrNumber.trim()) {
      toast({
        title: "Fejl",
        description: "Indtast venligst et CVR nummer",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cvr-lookup", {
        body: { cvr: cvrNumber },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Ikke fundet",
          description: data.error,
          variant: "destructive",
        });
        setCvrData(null);
      } else {
        setCvrData(data);
        toast({
          title: "CVR opslag gennemført",
          description: `Fandt: ${data.name}`,
        });
      }
    } catch (error) {
      console.error("CVR lookup error:", error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved CVR opslag",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCvrData = async () => {
    if (!cvrData) return;

    try {
      const { error } = await supabase
        .from("customers")
        .update({
          name: cvrData.name || customer.name,
          address: cvrData.address || customer.address,
          contact_email: cvrData.email || customer.contact_email,
          contact_phone: cvrData.phone || customer.contact_phone,
        })
        .eq("id", customer.id);

      if (error) throw error;

      toast({
        title: "Opdateret",
        description: "Kundeoplysninger er opdateret fra CVR",
      });

      queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
      setCvrData(null);
      setCvrNumber("");
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Kunne ikke opdatere kundeoplysninger",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6 shadow-elevated">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">Kontaktoplysninger</h2>
      </div>

      {/* CVR Lookup Section */}
      <div className="mb-6 p-4 rounded-lg bg-accent/50 border border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">CVR Opslag</h3>
        <div className="flex gap-2">
          <Input
            placeholder="Indtast CVR nummer..."
            value={cvrNumber}
            onChange={(e) => setCvrNumber(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleCvrLookup()}
          />
          <Button
            onClick={handleCvrLookup}
            disabled={isLoading}
            className="gap-2 bg-gradient-primary hover:opacity-90"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Søg
          </Button>
        </div>

        {/* CVR Results */}
        {cvrData && (
          <div className="mt-4 p-4 rounded-lg bg-card border border-primary/20">
            <h4 className="font-semibold text-foreground mb-3">Resultat fra CVR</h4>
            <div className="grid gap-3 text-sm">
              {cvrData.name && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Virksomhedsnavn</p>
                    <p className="text-foreground font-medium">{cvrData.name}</p>
                  </div>
                </div>
              )}
              {cvrData.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Adresse</p>
                    <p className="text-foreground">{cvrData.address}</p>
                  </div>
                </div>
              )}
              {cvrData.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Telefon</p>
                    <p className="text-foreground">{cvrData.phone}</p>
                  </div>
                </div>
              )}
              {cvrData.email && (
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="text-foreground">{cvrData.email}</p>
                  </div>
                </div>
              )}
              {cvrData.industry && (
                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Branche</p>
                    <p className="text-foreground">{cvrData.industry}</p>
                  </div>
                </div>
              )}
              {cvrData.employees && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Antal medarbejdere</p>
                    <p className="text-foreground">{cvrData.employees}</p>
                  </div>
                </div>
              )}
              {cvrData.founded && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Stiftet</p>
                    <p className="text-foreground">{cvrData.founded}</p>
                  </div>
                </div>
              )}
            </div>
            <Button
              onClick={handleApplyCvrData}
              className="mt-4 w-full bg-gradient-primary hover:opacity-90"
            >
              Anvend oplysninger på kunde
            </Button>
          </div>
        )}
      </div>

      {/* Current Contact Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
          <MapPin className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Adresse</p>
            <p className="text-foreground">{customer.address || "Ikke angivet"}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
          <Briefcase className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Driftstype</p>
            <p className="text-foreground">{customer.operation_type}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
          <User className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Kontaktperson</p>
            <p className="text-foreground">{customer.contact_person || "Ikke angivet"}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
          <Mail className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Email</p>
            <p className="text-foreground">{customer.contact_email || "Ikke angivet"}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30 md:col-span-2">
          <Phone className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Telefon</p>
            <p className="text-foreground">{customer.contact_phone || "Ikke angivet"}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
