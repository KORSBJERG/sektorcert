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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Save, ShieldCheck, User, Building2, AlertTriangle, RefreshCcw,
  Link2, Network, Search, Lock, Users, KeyRound, CheckCircle2,
  Clock, Circle, Minus,
} from "lucide-react";
import { DEFAULT_NIS2_CATEGORIES, type NIS2Category, type NIS2CategoryItem } from "./nis2-categories";

const planSchema = z.object({
  title: z.string().min(1, "Titel er påkrævet"),
  responsible_person: z.string().optional(),
  responsible_role: z.string().optional(),
  responsible_email: z.string().email("Ugyldig email").optional().or(z.literal("")),
  responsible_phone: z.string().optional(),
  risk_level: z.string().optional(),
  last_reviewed_by: z.string().optional(),
  additional_notes: z.string().optional(),
});

type PlanFormData = z.infer<typeof planSchema>;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  governance: <Building2 className="h-5 w-5" />,
  incident: <AlertTriangle className="h-5 w-5" />,
  continuity: <RefreshCcw className="h-5 w-5" />,
  supply_chain: <Link2 className="h-5 w-5" />,
  network: <Network className="h-5 w-5" />,
  vulnerability: <Search className="h-5 w-5" />,
  access: <Lock className="h-5 w-5" />,
  hr_awareness: <Users className="h-5 w-5" />,
  crypto: <KeyRound className="h-5 w-5" />,
};

const STATUS_CONFIG = {
  not_started: { label: "Ikke startet", icon: Circle, color: "text-muted-foreground" },
  in_progress: { label: "I gang", icon: Clock, color: "text-chart-4" },
  implemented: { label: "Implementeret", icon: CheckCircle2, color: "text-chart-2" },
  not_applicable: { label: "Ikke relevant", icon: Minus, color: "text-muted-foreground" },
};

interface NIS2PlanEditorProps {
  customerId: string;
  customerName: string;
  existingPlan?: any;
  onSave: () => void;
  onCancel: () => void;
}

export function NIS2PlanEditor({ customerId, customerName, existingPlan, onSave, onCancel }: NIS2PlanEditorProps) {
  const [categories, setCategories] = useState<NIS2Category[]>(DEFAULT_NIS2_CATEGORIES);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      title: existingPlan?.title || `NIS2 Sikkerhedsplan - ${customerName}`,
      responsible_person: existingPlan?.responsible_person || "",
      responsible_role: existingPlan?.responsible_role || "",
      responsible_email: existingPlan?.responsible_email || "",
      responsible_phone: existingPlan?.responsible_phone || "",
      risk_level: existingPlan?.risk_level || "medium",
      last_reviewed_by: existingPlan?.last_reviewed_by || "",
      additional_notes: existingPlan?.additional_notes || "",
    },
  });

  useEffect(() => {
    if (existingPlan?.categories) {
      const cats = existingPlan.categories as unknown as NIS2Category[];
      if (Array.isArray(cats) && cats.length > 0) {
        setCategories(cats);
      }
    }
  }, [existingPlan]);

  const updateItemStatus = (catId: string, itemId: string, status: NIS2CategoryItem["status"]) => {
    setCategories(prev =>
      prev.map(cat =>
        cat.id === catId
          ? { ...cat, items: cat.items.map(item => (item.id === itemId ? { ...item, status } : item)) }
          : cat
      )
    );
  };

  const updateItemNotes = (catId: string, itemId: string, notes: string) => {
    setCategories(prev =>
      prev.map(cat =>
        cat.id === catId
          ? { ...cat, items: cat.items.map(item => (item.id === itemId ? { ...item, notes } : item)) }
          : cat
      )
    );
  };

  const getCategoryProgress = (cat: NIS2Category) => {
    const applicable = cat.items.filter(i => i.status !== "not_applicable");
    if (applicable.length === 0) return 100;
    const done = applicable.filter(i => i.status === "implemented").length;
    return Math.round((done / applicable.length) * 100);
  };

  const handleSubmit = async (data: PlanFormData, createNewVersion = false) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke logget ind");

      const planData = {
        customer_id: customerId,
        created_by_user_id: user.id,
        title: data.title,
        responsible_person: data.responsible_person || null,
        responsible_role: data.responsible_role || null,
        responsible_email: data.responsible_email || null,
        responsible_phone: data.responsible_phone || null,
        categories: JSON.parse(JSON.stringify(categories)),
        risk_level: data.risk_level || "medium",
        last_reviewed_at: new Date().toISOString().split("T")[0],
        last_reviewed_by: data.last_reviewed_by || null,
        next_review_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        additional_notes: data.additional_notes || null,
        status: "active" as const,
      };

      if (existingPlan && !createNewVersion) {
        const { error } = await supabase.from("nis2_plans").update(planData).eq("id", existingPlan.id);
        if (error) throw error;
        toast.success("NIS2 plan opdateret");
      } else if (existingPlan && createNewVersion) {
        const { error } = await supabase.from("nis2_plans").insert({
          ...planData,
          version: existingPlan.version + 1,
          parent_plan_id: existingPlan.id,
        });
        if (error) throw error;
        toast.success(`Ny version ${existingPlan.version + 1} oprettet`);
      } else {
        const { error } = await supabase.from("nis2_plans").insert(planData);
        if (error) throw error;
        toast.success("NIS2 sikkerhedsplan oprettet");
      }

      onSave();
    } catch (error) {
      console.error("Error saving NIS2 plan:", error);
      toast.error("Kunne ikke gemme NIS2 plan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => handleSubmit(data, false))} className="space-y-6">
          {/* Title */}
          <Card className="border-chart-4/20">
            <CardHeader className="bg-chart-4/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-chart-4/10">
                  <ShieldCheck className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">NIS2 Plan Information</CardTitle>
                  <CardDescription>Grundlæggende oplysninger om NIS2-sikkerhedsplanen</CardDescription>
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
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="risk_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risikoniveau</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Vælg risikoniveau" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Lav</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">Høj</SelectItem>
                        <SelectItem value="critical">Kritisk</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Responsible person */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Ansvarlig Person</CardTitle>
                  <CardDescription>Ansvarlig for NIS2-compliance</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="responsible_person" render={({ field }) => (
                <FormItem>
                  <FormLabel>Navn</FormLabel>
                  <FormControl><Input placeholder="f.eks. Jan Hansen" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="responsible_role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rolle/Stilling</FormLabel>
                  <FormControl><Input placeholder="f.eks. IT-chef / CISO" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="responsible_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="f.eks. jan@firma.dk" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="responsible_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon</FormLabel>
                  <FormControl><Input placeholder="f.eks. 12 34 56 78" {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* NIS2 Categories */}
          <Card className="border-chart-4/20">
            <CardHeader className="bg-chart-4/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-chart-4/10">
                  <ShieldCheck className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">NIS2 Compliance Kategorier</CardTitle>
                  <CardDescription>Gennemgå og vurder status for hvert krav</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Accordion type="multiple" className="space-y-3">
                {categories.map((cat) => {
                  const progress = getCategoryProgress(cat);
                  return (
                    <AccordionItem key={cat.id} value={cat.id} className="border rounded-lg px-4 overflow-hidden">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-3 flex-1 mr-4">
                          <div className="p-2 rounded-lg bg-chart-4/10 text-chart-4">
                            {CATEGORY_ICONS[cat.id] || <ShieldCheck className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-semibold text-sm">{cat.title}</p>
                            <p className="text-xs text-muted-foreground">{cat.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${progress}%`,
                                  background: progress === 100
                                    ? "hsl(var(--chart-2))"
                                    : progress > 50
                                    ? "hsl(var(--chart-4))"
                                    : "hsl(var(--chart-5))",
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground w-10 text-right">{progress}%</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 space-y-3">
                        {cat.items.map((item) => {
                          const statusCfg = STATUS_CONFIG[item.status];
                          const StatusIcon = statusCfg.icon;
                          return (
                            <div key={item.id} className="p-4 rounded-lg border bg-card space-y-3">
                              <div className="flex items-start gap-3">
                                <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${statusCfg.color}`} />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{item.text}</p>
                                </div>
                                <Select
                                  value={item.status}
                                  onValueChange={(val) => updateItemStatus(cat.id, item.id, val as NIS2CategoryItem["status"])}
                                >
                                  <SelectTrigger className="w-[160px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="not_started">Ikke startet</SelectItem>
                                    <SelectItem value="in_progress">I gang</SelectItem>
                                    <SelectItem value="implemented">Implementeret</SelectItem>
                                    <SelectItem value="not_applicable">Ikke relevant</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Textarea
                                value={item.notes}
                                onChange={(e) => updateItemNotes(cat.id, item.id, e.target.value)}
                                placeholder="Tilføj noter eller dokumentation..."
                                className="text-xs min-h-[60px]"
                              />
                            </div>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <FormField control={form.control} name="last_reviewed_by" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gennemgået af</FormLabel>
                  <FormControl><Input placeholder="f.eks. Jan Hansen samt IT-konsulent" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="additional_notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Yderligere noter</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Evt. yderligere oplysninger..." className="min-h-[100px]" {...field} />
                  </FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <Button type="button" variant="outline" onClick={onCancel}>Annuller</Button>
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
              <Button type="submit" disabled={isSaving} className="bg-chart-4 hover:bg-chart-4/90 text-white">
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
