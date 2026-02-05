import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, FileText, Trash2, Copy } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { AssessmentVersionHistory } from "@/components/AssessmentVersionHistory";
import { SecurityReportUpload } from "@/components/SecurityReportUpload";
import { SecurityReportsList } from "@/components/SecurityReportsList";
import { SecurityReportsComparison } from "@/components/SecurityReportsComparison";
import { CustomerContactInfo } from "@/components/CustomerContactInfo";
import { EmergencyPlanSection } from "@/components/EmergencyPlanSection";

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedAssessments, setSelectedAssessments] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState<string | null>(null);
  const [creatingRevision, setCreatingRevision] = useState<string | null>(null);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: assessments } = useQuery({
    queryKey: ["customer-assessments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && assessments) {
      setSelectedAssessments(assessments.map((a) => a.id));
    } else {
      setSelectedAssessments([]);
    }
  };

  const handleSelectAssessment = (assessmentId: string, checked: boolean) => {
    if (checked) {
      setSelectedAssessments([...selectedAssessments, assessmentId]);
    } else {
      setSelectedAssessments(selectedAssessments.filter((id) => id !== assessmentId));
    }
  };

  const handleDeleteSingle = async () => {
    if (!assessmentToDelete) return;

    try {
      const { error } = await supabase
        .from("assessments")
        .delete()
        .eq("id", assessmentToDelete);

      if (error) throw error;

      toast({
        title: "Vurdering slettet",
        description: "Vurderingen er blevet slettet.",
      });

      queryClient.invalidateQueries({ queryKey: ["customer-assessments", id] });
      setDeleteDialogOpen(false);
      setAssessmentToDelete(null);
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved sletning af vurderingen.",
        variant: "destructive",
      });
    }
  };

  const handleCreateRevision = async (sourceAssessmentId: string) => {
    setCreatingRevision(sourceAssessmentId);
    
    try {
      // Fetch the source assessment
      const { data: sourceAssessment, error: assessmentError } = await supabase
        .from("assessments")
        .select("*")
        .eq("id", sourceAssessmentId)
        .single();
      
      if (assessmentError) throw assessmentError;
      
      // Determine the root parent (for version chain) and calculate new version
      const rootParentId = sourceAssessment.parent_assessment_id || sourceAssessmentId;
      
      // Get highest version in the chain
      const { data: versionData } = await supabase
        .from("assessments")
        .select("version")
        .or(`id.eq.${rootParentId},parent_assessment_id.eq.${rootParentId}`)
        .order("version", { ascending: false })
        .limit(1);
      
      const newVersion = (versionData?.[0]?.version || sourceAssessment.version) + 1;
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke logget ind");
      
      // Create new assessment as a revision
      const { data: newAssessment, error: createError } = await supabase
        .from("assessments")
        .insert({
          customer_id: sourceAssessment.customer_id,
          consultant_name: sourceAssessment.consultant_name,
          assessment_date: new Date().toISOString().split("T")[0],
          status: "in_progress",
          version: newVersion,
          parent_assessment_id: rootParentId,
          created_by_user_id: user.id,
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Fetch source assessment items
      const { data: sourceItems, error: itemsError } = await supabase
        .from("assessment_items")
        .select("*")
        .eq("assessment_id", sourceAssessmentId);
      
      if (itemsError) throw itemsError;
      
      // Copy all assessment items to the new assessment
      if (sourceItems && sourceItems.length > 0) {
        const newItems = sourceItems.map((item) => ({
          assessment_id: newAssessment.id,
          recommendation_id: item.recommendation_id,
          maturity_level: item.maturity_level,
          status: item.status,
          notes: item.notes,
          recommended_actions: item.recommended_actions,
        }));
        
        const { error: insertError } = await supabase
          .from("assessment_items")
          .insert(newItems);
        
        if (insertError) throw insertError;
      }
      
      toast({
        title: "Ny revision oprettet",
        description: `Version ${newVersion} er oprettet baseret på den tidligere vurdering.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["customer-assessments", id] });
      
      // Navigate to the wizard to continue editing
      navigate(`/assessment/${newAssessment.id}/wizard`);
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl ved oprettelse af revision.",
        variant: "destructive",
      });
    } finally {
      setCreatingRevision(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAssessments.length === 0) return;

    try {
      const { error } = await supabase
        .from("assessments")
        .delete()
        .in("id", selectedAssessments);

      if (error) throw error;

      toast({
        title: "Vurderinger slettet",
        description: `${selectedAssessments.length} vurdering(er) er blevet slettet.`,
      });

      queryClient.invalidateQueries({ queryKey: ["customer-assessments", id] });
      setSelectedAssessments([]);
      setDeleteDialogOpen(false);
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved sletning af vurderingerne.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <Card className="p-8">
          <p className="mb-4 text-foreground">Kunde ikke fundet</p>
          <Link to="/">
            <Button>Tilbage til oversigt</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="ghost" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            </div>
            <div className="flex gap-2">
              <SecurityReportUpload customerId={id!} />
              <Button
                onClick={() => navigate(`/assessments/new?customer=${id}`)}
                className="gap-2 bg-gradient-primary hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Ny Vurdering
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6 p-6 shadow-elevated">
          <h1 className="mb-4 text-2xl font-bold text-foreground">{customer.name}</h1>
        </Card>

        {/* Contact Info with CVR Lookup */}
        <div className="mb-6">
          <CustomerContactInfo customer={customer} />
        </div>


        <Card className="mb-6 p-6 shadow-elevated">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Sikkerhedsrapporter</h3>
            <SecurityReportsComparison customerId={id!} />
          </div>
          <SecurityReportsList customerId={id!} />
        </Card>

        {/* Emergency Plan Section */}
        <Card className="mb-6 p-6 shadow-elevated">
          <EmergencyPlanSection customerId={id!} customerName={customer.name} />
        </Card>

        <Card className="p-6 shadow-elevated">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Sikkerhedsvurderinger</h2>
            {selectedAssessments.length > 0 && (
              <Button
                onClick={() => setDeleteDialogOpen(true)}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Slet valgte ({selectedAssessments.length})
              </Button>
            )}
          </div>
          {assessments && assessments.length > 0 ? (
            <>
              <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                <Checkbox
                  checked={selectedAssessments.length === assessments.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">Vælg alle</span>
              </div>
              <div className="space-y-3">
                {assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedAssessments.includes(assessment.id)}
                      onCheckedChange={(checked) =>
                        handleSelectAssessment(assessment.id, checked as boolean)
                      }
                    />
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                     <div className="flex flex-1 items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          {format(new Date(assessment.assessment_date), "d. MMMM yyyy", {
                            locale: da,
                          })}
                          {assessment.version && assessment.version > 1 && (
                            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                              v{assessment.version}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Konsulent: {assessment.consultant_name}
                        </p>
                        <p className="text-xs text-muted-foreground">Status: {assessment.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <AssessmentVersionHistory
                          assessmentId={assessment.id}
                          parentAssessmentId={assessment.parent_assessment_id}
                          currentVersion={assessment.version}
                        />
                        <Button
                          onClick={() => navigate(`/assessments/${assessment.id}`)}
                          variant="outline"
                        >
                          {assessment.status === "completed" ? "Se rapport" : "Fortsæt vurdering"}
                        </Button>
                        {assessment.status === "completed" && (
                          <>
                            <Button
                              onClick={() => handleCreateRevision(assessment.id)}
                              variant="outline"
                              disabled={creatingRevision === assessment.id}
                              className="gap-2"
                            >
                              <Copy className="h-4 w-4" />
                              {creatingRevision === assessment.id ? "Opretter..." : "Ny Revision"}
                            </Button>
                            <Button
                              onClick={() => navigate(`/assessments/${assessment.id}/report`)}
                              variant="outline"
                            >
                              PDF Rapport
                            </Button>
                          </>
                        )}
                        <Button
                          onClick={() => {
                            setAssessmentToDelete(assessment.id);
                            setDeleteDialogOpen(true);
                          }}
                          variant="ghost"
                          size="icon"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground">Ingen vurderinger endnu</p>
              <Button
                onClick={() => navigate(`/assessments/new?customer=${id}`)}
                className="bg-gradient-primary hover:opacity-90"
              >
                Opret første vurdering
              </Button>
            </div>
          )}
        </Card>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
              <AlertDialogDescription>
                {assessmentToDelete
                  ? "Denne handling kan ikke fortrydes. Vurderingen vil blive permanent slettet."
                  : `Denne handling kan ikke fortrydes. ${selectedAssessments.length} vurdering(er) vil blive permanent slettet.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setAssessmentToDelete(null);
                }}
              >
                Annuller
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={assessmentToDelete ? handleDeleteSingle : handleBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Slet
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default CustomerDetail;
