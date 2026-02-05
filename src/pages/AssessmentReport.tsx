import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Loader2, Copy } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { AssessmentVersionHistory } from "@/components/AssessmentVersionHistory";

const AssessmentReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState<string>("");

  const { data: assessment, isLoading } = useQuery({
    queryKey: ["assessment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("*, customers(name, address, contact_person, operation_type)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: assessmentItems } = useQuery({
    queryKey: ["assessment-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_items")
        .select("*, recommendations(*)")
        .eq("assessment_id", id)
        .order("recommendations(number)");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .order("display_name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (assessment?.consultant_name) {
      setSelectedConsultant(assessment.consultant_name);
    }
  }, [assessment?.consultant_name]);

  const updateConsultantMutation = useMutation({
    mutationFn: async (consultantName: string) => {
      const { error } = await supabase
        .from("assessments")
        .update({ consultant_name: consultantName })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment", id] });
      toast.success("Konsulent opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere konsulent");
    },
  });

  const handleConsultantChange = (value: string) => {
    setSelectedConsultant(value);
    updateConsultantMutation.mutate(value);
  };

  const handleCreateNewVersion = async () => {
    if (!assessment || !assessmentItems) return;
    
    setCreatingVersion(true);
    try {
      // Create new assessment with incremented version
      const { data: newAssessment, error: assessmentError } = await supabase
        .from("assessments")
        .insert({
          customer_id: assessment.customer_id,
          consultant_name: assessment.consultant_name,
          assessment_date: new Date().toISOString().split('T')[0],
          status: 'in_progress',
          version: (assessment.version || 1) + 1,
          parent_assessment_id: assessment.parent_assessment_id || assessment.id,
        })
        .select()
        .single();

      if (assessmentError) throw assessmentError;

      // Copy all assessment items
      const newItems = assessmentItems.map((item) => ({
        assessment_id: newAssessment.id,
        recommendation_id: item.recommendation_id,
        maturity_level: item.maturity_level,
        status: item.status,
        notes: item.notes,
        recommended_actions: item.recommended_actions,
      }));

      const { error: itemsError } = await supabase
        .from("assessment_items")
        .insert(newItems);

      if (itemsError) throw itemsError;

      toast.success(`Version ${newAssessment.version} oprettet!`);
      navigate(`/assessment/${newAssessment.id}/wizard`);
    } catch (error) {
      console.error("Error creating new version:", error);
      toast.error("Kunne ikke oprette ny version");
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-assessment-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ assessmentId: id }),
        }
      );

      if (!response.ok) throw new Error("Failed to generate PDF");

      const { html } = await response.json();

      // Create a new window for printing
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Wait for content to load then trigger print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }

      toast.success("PDF rapport åbnet i nyt vindue");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Kunne ikke generere PDF rapport");
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!assessment || !assessmentItems) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <Card className="p-8">
          <p className="mb-4 text-foreground">Vurdering ikke fundet</p>
          <Link to="/">
            <Button>Tilbage til oversigt</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    not_fulfilled: "text-destructive",
    partially_fulfilled: "text-warning",
    fulfilled: "text-success",
    not_applicable: "text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    not_fulfilled: "Ikke opfyldt",
    partially_fulfilled: "Delvist opfyldt",
    fulfilled: "Opfyldt",
    not_applicable: "Ikke relevant",
  };

  const scoreDistribution = [0, 0, 0, 0, 0];
  assessmentItems.forEach((item) => {
    scoreDistribution[item.maturity_level || 0]++;
  });

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to={`/customers/${assessment.customer_id}`}>
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Tilbage
              </Button>
            </Link>
            <div className="flex gap-2">
              <AssessmentVersionHistory
                assessmentId={assessment.id}
                parentAssessmentId={assessment.parent_assessment_id}
                currentVersion={assessment.version || 1}
              />
              <Button
                onClick={handleCreateNewVersion}
                disabled={creatingVersion}
                variant="outline"
                className="gap-2"
              >
                {creatingVersion ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {creatingVersion ? "Opretter..." : "Opret Ny Version"}
              </Button>
              <Button
                onClick={handleDownloadPDF}
                disabled={generating}
                className="gap-2 bg-gradient-primary hover:opacity-90"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {generating ? "Genererer..." : "Download PDF"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Card className="mb-6 p-8 shadow-elevated">
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold text-foreground">{assessment.customers?.name}</h1>
            <p className="text-muted-foreground">Cybersikkerhedsvurdering</p>
            {assessment.version && assessment.version > 1 && (
              <p className="mt-1 text-sm font-semibold text-primary">Version {assessment.version}</p>
            )}
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Vurderingsdato</p>
              <p className="text-foreground">
                {format(new Date(assessment.assessment_date), "d. MMMM yyyy", { locale: da })}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Konsulent</p>
              <Select value={selectedConsultant} onValueChange={handleConsultantChange}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Vælg konsulent" />
                </SelectTrigger>
                <SelectContent>
                  {profiles?.map((profile) => (
                    <SelectItem 
                      key={profile.id} 
                      value={profile.display_name || profile.email || profile.id}
                    >
                      {profile.display_name || profile.email || "Ukendt"}
                    </SelectItem>
                  ))}
                  {/* Include current value if not in profiles */}
                  {selectedConsultant && !profiles?.some(p => 
                    (p.display_name || p.email || p.id) === selectedConsultant
                  ) && (
                    <SelectItem value={selectedConsultant}>
                      {selectedConsultant}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Adresse</p>
              <p className="text-foreground">{assessment.customers?.address || "Ikke angivet"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Driftstype</p>
              <p className="text-foreground">{assessment.customers?.operation_type}</p>
            </div>
          </div>
        </Card>

        <h2 className="mb-4 text-2xl font-bold text-foreground">Detaljeret Vurdering</h2>

        <div className="space-y-4">
          {assessmentItems.map((item) => (
            <Card key={item.id} className="p-6 shadow-card">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                  {item.recommendations.number}
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {item.recommendations.title}
                </h3>
              </div>

              <div className="mb-4 space-y-3 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Beskrivelse:</p>
                  <p className="text-foreground">{item.recommendations.description}</p>
                </div>

                <div>
                  <p className="font-medium text-muted-foreground">Derfor er det vigtigt:</p>
                  <p className="text-foreground">{item.recommendations.importance_reason}</p>
                </div>
              </div>

              <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Modenhedsniveau
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {item.maturity_level || 0}/4
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Status
                  </p>
                  <p className={`text-lg font-semibold ${statusColors[item.status || ""]}`}>
                    {statusLabels[item.status || ""] || item.status}
                  </p>
                </div>
              </div>

              {item.notes && (
                <div className="mt-4 rounded-lg bg-muted p-4">
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Noter
                  </p>
                  <p className="text-sm text-foreground">{item.notes}</p>
                </div>
              )}

              {item.recommended_actions && (
                <div className="mt-3 rounded-lg bg-warning/10 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase text-warning-foreground">
                    Anbefalede Handlinger
                  </p>
                  <p className="text-sm text-foreground">{item.recommended_actions}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AssessmentReport;
