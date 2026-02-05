import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Pencil,
  Check,
  X,
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
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    address: customer.address || "",
    operation_type: customer.operation_type,
    contact_person: customer.contact_person || "",
    contact_email: customer.contact_email || "",
    contact_phone: customer.contact_phone || "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editData) => {
      const { error } = await supabase
        .from("customers")
        .update({
          address: data.address || null,
          operation_type: data.operation_type,
          contact_person: data.contact_person || null,
          contact_email: data.contact_email || null,
          contact_phone: data.contact_phone || null,
        })
        .eq("id", customer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Opdateret",
        description: "Kontaktoplysninger er gemt",
      });
      queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Fejl",
        description: "Kunne ikke gemme ændringer",
        variant: "destructive",
      });
    },
  });

  const handleStartEdit = () => {
    setEditData({
      address: customer.address || "",
      operation_type: customer.operation_type,
      contact_person: customer.contact_person || "",
      contact_email: customer.contact_email || "",
      contact_phone: customer.contact_phone || "",
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    updateMutation.mutate(editData);
  };

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Kontaktoplysninger</h2>
        </div>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={handleStartEdit} className="gap-2">
            <Pencil className="h-4 w-4" />
            Rediger
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Annuller
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              className="gap-2 bg-gradient-primary hover:opacity-90"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Gem
            </Button>
          </div>
        )}
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
        {isEditing ? (
          <>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
              <MapPin className="h-5 w-5 text-primary mt-2" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">Adresse</p>
                <Input
                  value={editData.address}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                  placeholder="Indtast adresse..."
                />
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
              <Briefcase className="h-5 w-5 text-primary mt-2" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">Driftstype</p>
                <Select
                  value={editData.operation_type}
                  onValueChange={(value) => setEditData({ ...editData, operation_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IT">IT</SelectItem>
                    <SelectItem value="OT">OT</SelectItem>
                    <SelectItem value="BOTH">BOTH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
              <User className="h-5 w-5 text-primary mt-2" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">Kontaktperson</p>
                <Input
                  value={editData.contact_person}
                  onChange={(e) => setEditData({ ...editData, contact_person: e.target.value })}
                  placeholder="Indtast kontaktperson..."
                />
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
              <Mail className="h-5 w-5 text-primary mt-2" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">Email</p>
                <Input
                  type="email"
                  value={editData.contact_email}
                  onChange={(e) => setEditData({ ...editData, contact_email: e.target.value })}
                  placeholder="Indtast email..."
                />
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/30 md:col-span-2">
              <Phone className="h-5 w-5 text-primary mt-2" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">Telefon</p>
                <Input
                  value={editData.contact_phone}
                  onChange={(e) => setEditData({ ...editData, contact_phone: e.target.value })}
                  placeholder="Indtast telefonnummer..."
                />
              </div>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </Card>
  );
};
