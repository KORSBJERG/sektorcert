import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings, Loader2, CheckCircle2 } from "lucide-react";

interface HuntressSetupProps {
  customerId: string;
  existingIntegration?: {
    id: string;
    organization_id: string | null;
  } | null;
}

export const HuntressSetup = ({ customerId, existingIntegration }: HuntressSetupProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [organizationId, setOrganizationId] = useState(existingIntegration?.organization_id || "");
  const [apiKey, setApiKey] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleTestConnection = async () => {
    if (!apiKey) {
      toast({
        title: "Manglende oplysninger",
        description: "Indtast venligst API Key",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setTestSuccess(false);

    try {
      const response = await fetch("https://api.huntress.io/v1/account", {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        setTestSuccess(true);
        toast({
          title: "Forbindelse OK",
          description: "Huntress API-forbindelsen virker korrekt",
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      toast({
        title: "Forbindelsesfejl",
        description: "Kunne ikke oprette forbindelse til Huntress API. Tjek dine credentials.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey) {
      toast({
        title: "Manglende oplysninger",
        description: "Indtast venligst API Key",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (existingIntegration) {
        const { error } = await supabase
          .from("huntress_integrations")
          .update({
            organization_id: organizationId || null,
            public_key: apiKey,
            private_key: apiKey, // Store same key in both for compatibility
            sync_status: "pending",
          })
          .eq("id", existingIntegration.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("huntress_integrations")
          .insert({
            customer_id: customerId,
            created_by_user_id: user.id,
            organization_id: organizationId || null,
            public_key: apiKey,
            private_key: apiKey, // Store same key in both for compatibility
          });

        if (error) throw error;
      }

      toast({
        title: "Gemt",
        description: "Huntress integration er blevet konfigureret",
      });

      queryClient.invalidateQueries({ queryKey: ["huntress-integration", customerId] });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke gemme konfigurationen",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          {existingIntegration ? "Rediger Huntress" : "Opsæt Huntress"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Huntress Integration</DialogTitle>
          <DialogDescription>
            Indtast dine Huntress API-credentials for at aktivere integrationen.
            Du finder dem i Huntress-portalen under API Credentials.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="organizationId">Organization ID (valgfrit)</Label>
            <Input
              id="organizationId"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              placeholder="Lad være tom for alle organisationer"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Din Huntress API Key (hk_...)"
            />
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !apiKey}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : testSuccess ? (
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
            ) : null}
            Test forbindelse
          </Button>
          <Button onClick={handleSave} disabled={loading || !apiKey}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Gem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
