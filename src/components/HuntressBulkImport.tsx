import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Download,
  Loader2,
  CheckCircle2,
  Building2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface HuntressOrganization {
  id: number;
  name: string;
  agents_count?: number;
}

interface HuntressBulkImportProps {
  onImportComplete?: () => void;
}

export const HuntressBulkImport = ({ onImportComplete }: HuntressBulkImportProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [organizations, setOrganizations] = useState<HuntressOrganization[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<number[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleFetchOrganizations = async () => {
    if (!publicKey || !privateKey) {
      toast({
        title: "Manglende oplysninger",
        description: "Indtast venligst Public Key og Private Key",
        variant: "destructive",
      });
      return;
    }

    setFetching(true);
    try {
      const authHeader = btoa(`${publicKey}:${privateKey}`);
      const response = await fetch("https://api.huntress.io/v1/organizations", {
        headers: {
          "Authorization": `Basic ${authHeader}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const orgs = data.organizations || data.data || [];
      setOrganizations(orgs);
      setSelectedOrgs(orgs.map((o: HuntressOrganization) => o.id));
      
      toast({
        title: "Organisationer hentet",
        description: `Fandt ${orgs.length} organisationer`,
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: "Kunne ikke hente organisationer. Tjek dine credentials.",
        variant: "destructive",
      });
    } finally {
      setFetching(false);
    }
  };

  const handleToggleOrg = (orgId: number) => {
    setSelectedOrgs((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrgs.length === organizations.length) {
      setSelectedOrgs([]);
    } else {
      setSelectedOrgs(organizations.map((o) => o.id));
    }
  };

  const handleImport = async () => {
    if (selectedOrgs.length === 0) {
      toast({
        title: "Ingen organisationer valgt",
        description: "Vælg mindst én organisation at importere",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setImportProgress(0);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Fejl",
        description: "Du skal være logget ind",
        variant: "destructive",
      });
      setImporting(false);
      return;
    }

    const selectedOrgData = organizations.filter((o) => selectedOrgs.includes(o.id));
    let completed = 0;
    let errors: string[] = [];

    for (const org of selectedOrgData) {
      setImportStatus(`Importerer ${org.name}...`);
      
      try {
        // Check if customer exists with similar name
        const existingCustomer = customers?.find(
          (c) => c.name.toLowerCase().includes(org.name.toLowerCase()) ||
                 org.name.toLowerCase().includes(c.name.toLowerCase())
        );

        let customerId: string;

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          // Create new customer
          const { data: newCustomer, error: customerError } = await supabase
            .from("customers")
            .insert({
              name: org.name,
              operation_type: "IT",
              created_by_user_id: user.id,
            })
            .select()
            .single();

          if (customerError) {
            errors.push(`${org.name}: Kunne ikke oprette kunde`);
            continue;
          }
          customerId = newCustomer.id;
        }

        // Check if integration exists
        const { data: existingIntegration } = await supabase
          .from("huntress_integrations")
          .select("id")
          .eq("customer_id", customerId)
          .single();

        if (existingIntegration) {
          // Update existing
          await supabase
            .from("huntress_integrations")
            .update({
              organization_id: String(org.id),
              public_key: publicKey,
              private_key: privateKey,
              sync_status: "pending",
            })
            .eq("id", existingIntegration.id);
        } else {
          // Create new integration
          const { error: integrationError } = await supabase
            .from("huntress_integrations")
            .insert({
              customer_id: customerId,
              created_by_user_id: user.id,
              organization_id: String(org.id),
              public_key: publicKey,
              private_key: privateKey,
            });

          if (integrationError) {
            errors.push(`${org.name}: ${integrationError.message}`);
            continue;
          }
        }
      } catch (e: any) {
        errors.push(`${org.name}: ${e?.message || "Ukendt fejl"}`);
      }

      completed++;
      setImportProgress((completed / selectedOrgData.length) * 100);
    }

    setImportStatus("");
    setImporting(false);

    if (errors.length > 0) {
      toast({
        title: "Import afsluttet med fejl",
        description: `${completed - errors.length} af ${selectedOrgData.length} organisationer importeret`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Import fuldført",
        description: `${completed} organisationer importeret`,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["huntress-integrations"] });
    onImportComplete?.();
    setOpen(false);
  };

  const handleSyncAll = async () => {
    setLoading(true);
    setImportProgress(0);

    try {
      const { data: integrations, error } = await supabase
        .from("huntress_integrations")
        .select("id, customers(name)");

      if (error) throw error;

      if (!integrations || integrations.length === 0) {
        toast({
          title: "Ingen integrationer",
          description: "Der er ingen Huntress-integrationer at synkronisere",
        });
        setLoading(false);
        return;
      }

      let completed = 0;
      let errors: string[] = [];

      for (const integration of integrations) {
        setImportStatus(`Synkroniserer ${(integration.customers as any)?.name || "Ukendt"}...`);
        
        try {
          const { error: syncError } = await supabase.functions.invoke("huntress-sync", {
            body: { integrationId: integration.id },
          });

          if (syncError) {
            errors.push((integration.customers as any)?.name || integration.id);
          }
        } catch {
          errors.push((integration.customers as any)?.name || integration.id);
        }

        completed++;
        setImportProgress((completed / integrations.length) * 100);
      }

      setImportStatus("");

      if (errors.length > 0) {
        toast({
          title: "Synkronisering afsluttet med fejl",
          description: `${completed - errors.length} af ${integrations.length} synkroniseret`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Synkronisering fuldført",
          description: `${completed} kunder synkroniseret`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["huntress-incidents"] });
      queryClient.invalidateQueries({ queryKey: ["huntress-agents"] });
      queryClient.invalidateQueries({ queryKey: ["huntress-sync-results"] });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke synkronisere",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button onClick={handleSyncAll} disabled={loading} variant="outline" className="gap-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Synk alle
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Huntress Import
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import fra Huntress</DialogTitle>
            <DialogDescription>
              Hent alle organisationer fra din Huntress-konto og opret kunder automatisk
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Credentials */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bulk-publicKey">Public Key</Label>
                <Input
                  id="bulk-publicKey"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="Din Huntress Public Key"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-privateKey">Private Key</Label>
                <Input
                  id="bulk-privateKey"
                  type="password"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="Din Huntress Private Key"
                />
              </div>
            </div>

            <Button
              onClick={handleFetchOrganizations}
              disabled={fetching || !publicKey || !privateKey}
              className="w-full gap-2"
            >
              {fetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
              Hent organisationer
            </Button>

            {/* Organizations list */}
            {organizations.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-foreground">
                    Organisationer ({organizations.length})
                  </h4>
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {selectedOrgs.length === organizations.length ? "Fravælg alle" : "Vælg alle"}
                  </Button>
                </div>

                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {organizations.map((org) => {
                      const matchingCustomer = customers?.find(
                        (c) => c.name.toLowerCase().includes(org.name.toLowerCase()) ||
                               org.name.toLowerCase().includes(c.name.toLowerCase())
                      );

                      return (
                        <div
                          key={org.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent"
                        >
                          <Checkbox
                            checked={selectedOrgs.includes(org.id)}
                            onCheckedChange={() => handleToggleOrg(org.id)}
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-foreground">
                              {org.name}
                            </span>
                            {org.agents_count !== undefined && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({org.agents_count} agents)
                              </span>
                            )}
                          </div>
                          {matchingCustomer ? (
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              Eksisterer
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Ny kunde
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </Card>
            )}

            {/* Progress */}
            {(importing || loading) && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{importStatus}</span>
                  <span>{Math.round(importProgress)}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleImport}
              disabled={importing || selectedOrgs.length === 0}
              className="gap-2"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Importer {selectedOrgs.length} organisationer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
