import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, FileText, Shield, Phone, Calendar, AlertTriangle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const planSchema = z.object({
  title: z.string().min(1, "Titel er påkrævet"),
  it_contact_name: z.string().optional(),
  it_contact_company: z.string().optional(),
  it_contact_phone: z.string().optional(),
  it_contact_email: z.string().email("Ugyldig email").optional().or(z.literal("")),
  last_reviewed_by: z.string().optional(),
  additional_notes: z.string().optional(),
});

type PlanFormData = z.infer<typeof planSchema>;

interface SecurityMeasure {
  id: string;
  text: string;
  enabled: boolean;
}

const DEFAULT_MEASURES: SecurityMeasure[] = [
  { id: "1", text: "Firewall og malwarebeskyttelse der løbende og automatisk opdateres", enabled: true },
  { id: "2", text: "Opdateringer (patches) til kritiske IT-systemer installeres indenfor 7 dage", enabled: true },
  { id: "3", text: "Daglig backup (Microsoft365 - email, sharepoint, onedrive)", enabled: true },
  { id: "4", text: "Der opbevares kopier af backup med fysisk og logisk adskillelse", enabled: true },
  { id: "5", text: "Backupper er beskyttede mod manipulation og sletning, vha. kryptering", enabled: true },
  { id: "6", text: "MFA (Multifaktorgodkendelse) anvendes på alle login", enabled: true },
  { id: "7", text: "Administratoradgang via MFA (Multifaktorgodkendelse) med separat konto", enabled: true },
  { id: "8", text: "Ingen lokale administratorrettigheder", enabled: true },
];

interface EmergencyPlanEditorProps {
  customerId: string;
  customerName: string;
  existingPlan?: Tables<"emergency_plans"> | null;
  onSave: () => void;
  onCancel: () => void;
}

export function EmergencyPlanEditor({ 
  customerId, 
  customerName, 
  existingPlan, 
  onSave, 
  onCancel 
}: EmergencyPlanEditorProps) {
  const [securityMeasures, setSecurityMeasures] = useState<SecurityMeasure[]>(DEFAULT_MEASURES);
  const [newMeasure, setNewMeasure] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      title: existingPlan?.title || `Beredskabsplan for Cyberkriminalitet - ${customerName}`,
      it_contact_name: existingPlan?.it_contact_name || "",
      it_contact_company: existingPlan?.it_contact_company || "",
      it_contact_phone: existingPlan?.it_contact_phone || "",
      it_contact_email: existingPlan?.it_contact_email || "",
      last_reviewed_by: existingPlan?.last_reviewed_by || "",
      additional_notes: existingPlan?.additional_notes || "",
    },
  });

  useEffect(() => {
    if (existingPlan?.security_measures) {
      const measures = existingPlan.security_measures as unknown as SecurityMeasure[];
      if (Array.isArray(measures) && measures.length > 0) {
        setSecurityMeasures(measures);
      }
    }
  }, [existingPlan]);

  const toggleMeasure = (id: string) => {
    setSecurityMeasures(prev =>
      prev.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const addMeasure = () => {
    if (!newMeasure.trim()) return;
    setSecurityMeasures(prev => [
      ...prev,
      { id: crypto.randomUUID(), text: newMeasure.trim(), enabled: true },
    ]);
    setNewMeasure("");
  };

  const removeMeasure = (id: string) => {
    setSecurityMeasures(prev => prev.filter(m => m.id !== id));
  };

  const updateMeasureText = (id: string, text: string) => {
    setSecurityMeasures(prev =>
      prev.map(m => (m.id === id ? { ...m, text } : m))
    );
  };

  const handleSubmit = async (data: PlanFormData, createNewVersion: boolean = false) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke logget ind");

      const planData = {
        customer_id: customerId,
        created_by_user_id: user.id,
        title: data.title,
        it_contact_name: data.it_contact_name || null,
        it_contact_company: data.it_contact_company || null,
        it_contact_phone: data.it_contact_phone || null,
        it_contact_email: data.it_contact_email || null,
        security_measures: JSON.parse(JSON.stringify(securityMeasures)),
        last_reviewed_at: new Date().toISOString().split("T")[0],
        last_reviewed_by: data.last_reviewed_by || null,
        next_review_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        additional_notes: data.additional_notes || null,
        status: "active" as const,
      };

      if (existingPlan && !createNewVersion) {
        // Update existing plan
        const { error } = await supabase
          .from("emergency_plans")
          .update(planData)
          .eq("id", existingPlan.id);

        if (error) throw error;
        toast.success("Beredskabsplan opdateret");
      } else if (existingPlan && createNewVersion) {
        // Create new version
        const { error } = await supabase.from("emergency_plans").insert({
          ...planData,
          version: existingPlan.version + 1,
          parent_plan_id: existingPlan.id,
        });

        if (error) throw error;
        toast.success(`Ny version ${existingPlan.version + 1} oprettet`);
      } else {
        // Create new plan
        const { error } = await supabase.from("emergency_plans").insert(planData);

        if (error) throw error;
        toast.success("Beredskabsplan oprettet");
      }

      onSave();
    } catch (error) {
      console.error("Error saving plan:", error);
      toast.error("Kunne ikke gemme beredskabsplan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => handleSubmit(data, false))} className="space-y-6">
          {/* Header Card */}
          <Card className="border-primary/20">
            <CardHeader className="bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Plan Information</CardTitle>
                  <CardDescription>Grundlæggende oplysninger om beredskabsplanen</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titel</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Emergency Contact Card */}
          <Card className="border-destructive/20">
            <CardHeader className="bg-destructive/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-lg">Akut Alarm</CardTitle>
                  <CardDescription>Kontaktperson ved cyberkriminalitet</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="it_contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kontaktperson</FormLabel>
                    <FormControl>
                      <Input placeholder="f.eks. Peter Korsbjerg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="it_contact_company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IT-firma</FormLabel>
                    <FormControl>
                      <Input placeholder="f.eks. PEAKNET" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="it_contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon</FormLabel>
                    <FormControl>
                      <Input placeholder="f.eks. 26 16 65 07" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="it_contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="f.eks. it@firma.dk" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Security Measures Card */}
          <Card className="border-chart-2/30">
            <CardHeader className="bg-chart-2/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-chart-2/10">
                  <Shield className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <CardTitle className="text-lg">Sikkerhedsforanstaltninger</CardTitle>
                  <CardDescription>Forebyggende tiltag mod cyberkriminalitet</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {securityMeasures.map((measure) => (
                <div
                  key={measure.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    measure.enabled 
                      ? "bg-chart-2/5 border-chart-2/20" 
                      : "bg-muted/50 border-border opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={measure.enabled}
                    onChange={() => toggleMeasure(measure.id)}
                    className="mt-1 h-4 w-4 rounded border-input"
                  />
                  <Input
                    value={measure.text}
                    onChange={(e) => updateMeasureText(measure.id, e.target.value)}
                    className="flex-1 border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMeasure(measure.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <div className="flex gap-2">
                <Input
                  value={newMeasure}
                  onChange={(e) => setNewMeasure(e.target.value)}
                  placeholder="Tilføj ny sikkerhedsforanstaltning..."
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMeasure())}
                />
                <Button type="button" variant="outline" onClick={addMeasure}>
                  <Plus className="h-4 w-4 mr-1" />
                  Tilføj
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Review Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Gennemgang</CardTitle>
                  <CardDescription>Årlig gennemgang og awareness-træning</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <FormField
                control={form.control}
                name="last_reviewed_by"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gennemgået af</FormLabel>
                    <FormControl>
                      <Input placeholder="f.eks. Hanne Sundin samt IT-konsulent" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="additional_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yderligere noter</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Evt. yderligere oplysninger..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuller
            </Button>
            <div className="flex gap-2">
              {existingPlan && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => form.handleSubmit((data) => handleSubmit(data, true))()}
                  disabled={isSaving}
                >
                  Gem som ny version
                </Button>
              )}
              <Button type="submit" disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Gemmer..." : existingPlan ? "Opdater plan" : "Opret plan"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
