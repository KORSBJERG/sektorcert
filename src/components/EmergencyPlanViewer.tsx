import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Shield, Phone, Calendar, AlertTriangle, Edit, Download, Check, X } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

interface SecurityMeasure {
  id: string;
  text: string;
  enabled: boolean;
}

interface EmergencyPlanViewerProps {
  plan: Tables<"emergency_plans">;
  customerName: string;
  onEdit: () => void;
}

export function EmergencyPlanViewer({ plan, customerName, onEdit }: EmergencyPlanViewerProps) {
  const measures = (plan.security_measures as unknown as SecurityMeasure[]) || [];
  const enabledMeasures = measures.filter(m => m.enabled);

  const handleDownload = () => {
    // Generate a simple text/markdown version for download
    const content = `
# ${plan.title}

Ved cyberkriminalitet hos ${customerName} følges denne Incident Response plan:

## AKUT ALARM

Kontakt ${plan.it_contact_company || "IT-firma"} ved ${plan.it_contact_name || "IT-kontakt"} på tlf.: ${plan.it_contact_phone || "N/A"}
${plan.it_contact_email ? `Email: ${plan.it_contact_email}` : ""}

## FOREBYGGENDE TILTAG

Vi gør følgende for at undgå cyberkriminalitet i hverdagen:

${enabledMeasures.map(m => `• ${m.text}`).join("\n")}

## GENNEMGANG

Vi foretager gennemgang af denne plan og gennemgår ligeledes en awareness-træning af relevant personale en gang årligt.

Denne plan er gennemgået sidst den: ${plan.last_reviewed_at ? format(new Date(plan.last_reviewed_at), "d/M-yyyy", { locale: da }) : "N/A"}
${plan.last_reviewed_by ? `Gennemgået af: ${plan.last_reviewed_by}` : ""}

${plan.additional_notes ? `\n## YDERLIGERE NOTER\n\n${plan.additional_notes}` : ""}

---
Version: ${plan.version}
Oprettet: ${format(new Date(plan.created_at), "d. MMMM yyyy", { locale: da })}
Sidst opdateret: ${format(new Date(plan.updated_at), "d. MMMM yyyy", { locale: da })}
    `.trim();

    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beredskabsplan-${customerName.toLowerCase().replace(/\s+/g, "-")}-v${plan.version}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{plan.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">Version {plan.version}</Badge>
              <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                {plan.status === "active" ? "Aktiv" : plan.status === "draft" ? "Kladde" : "Arkiveret"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Rediger
          </Button>
        </div>
      </div>

      {/* Emergency Contact */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <CardTitle className="text-lg text-destructive">Akut Alarm</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg mb-4">
            Ved cyberkriminalitet hos <strong>{customerName}</strong> følges denne Incident Response plan:
          </p>
          <div className="flex items-center gap-4 p-4 rounded-lg bg-background border border-destructive/20">
            <Phone className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-medium text-lg">
                Kontakt {plan.it_contact_company || "IT-firma"} ved {plan.it_contact_name || "IT-kontakt"}
              </p>
              <p className="text-2xl font-bold text-destructive">
                Tlf.: {plan.it_contact_phone || "Ikke angivet"}
              </p>
              {plan.it_contact_email && (
                <p className="text-muted-foreground">{plan.it_contact_email}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Measures */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-chart-2/10">
              <Shield className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <CardTitle className="text-lg">Forebyggende Tiltag</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Vi gør følgende for at undgå cyberkriminalitet i hverdagen:
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {measures.map((measure) => (
              <li
                key={measure.id}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  measure.enabled 
                    ? "bg-chart-2/5 border border-chart-2/20" 
                    : "bg-muted/30 border border-border opacity-60"
                }`}
              >
                {measure.enabled ? (
                  <Check className="h-5 w-5 text-chart-2 mt-0.5 shrink-0" />
                ) : (
                  <X className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <span className={measure.enabled ? "" : "line-through"}>{measure.text}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Review Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Gennemgang</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Vi foretager gennemgang af denne plan og gennemgår ligeledes en awareness-træning 
            af relevant personale en gang årligt.
          </p>
          
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Sidst gennemgået</p>
              <p className="font-medium">
                {plan.last_reviewed_at 
                  ? format(new Date(plan.last_reviewed_at), "d. MMMM yyyy", { locale: da })
                  : "Ikke registreret"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gennemgået af</p>
              <p className="font-medium">{plan.last_reviewed_by || "Ikke angivet"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Næste gennemgang</p>
              <p className="font-medium">
                {plan.next_review_at 
                  ? format(new Date(plan.next_review_at), "d. MMMM yyyy", { locale: da })
                  : "Ikke planlagt"}
              </p>
            </div>
          </div>

          {plan.additional_notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Yderligere noter</p>
                <p className="whitespace-pre-wrap">{plan.additional_notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Meta Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          Oprettet: {format(new Date(plan.created_at), "d. MMMM yyyy", { locale: da })}
        </span>
        <span>
          Sidst opdateret: {format(new Date(plan.updated_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
        </span>
      </div>
    </div>
  );
}
