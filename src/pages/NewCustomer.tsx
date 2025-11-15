import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const NewCustomer = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contact_person: "",
    contact_email: "",
    contact_phone: "",
    operation_type: "IT" as "IT" | "OT" | "BOTH",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("customers")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;

      toast.success("Kunde oprettet!");
      navigate(`/customers/${data.id}`);
    } catch (error) {
      console.error("Error creating customer:", error);
      toast.error("Kunne ikke oprette kunde");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Tilbage
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card className="p-6 shadow-elevated">
          <h1 className="mb-6 text-2xl font-bold text-foreground">Opret Ny Kunde</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Virksomhedsnavn *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Indtast virksomhedsnavn"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Indtast adresse"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_person">Kontaktperson</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Indtast navn på kontaktperson"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="Indtast email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Telefon</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="Indtast telefonnummer"
              />
            </div>

            <div className="space-y-3">
              <Label>Driftstype *</Label>
              <RadioGroup
                value={formData.operation_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, operation_type: value as "IT" | "OT" | "BOTH" })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="IT" id="it" />
                  <Label htmlFor="it" className="font-normal">
                    IT - Administrationsnetværk/IT-miljø
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="OT" id="ot" />
                  <Label htmlFor="ot" className="font-normal">
                    OT - Produktionsnetværk/OT-miljø
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="BOTH" id="both" />
                  <Label htmlFor="both" className="font-normal">
                    Begge - IT og OT
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 gap-2 bg-gradient-primary hover:opacity-90"
              >
                <Save className="h-4 w-4" />
                {loading ? "Gemmer..." : "Gem Kunde"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/")}>
                Annuller
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default NewCustomer;
