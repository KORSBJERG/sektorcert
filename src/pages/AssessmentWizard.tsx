import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const AssessmentWizard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);

  const { data: assessment, isLoading: loadingAssessment } = useQuery({
    queryKey: ["assessment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("*, customers(name, operation_type)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: assessmentItems, isLoading: loadingItems } = useQuery({
    queryKey: ["assessment-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_items")
        .select("*, recommendations(*)")
        .eq("assessment_id", id)
        .order("recommendations(number)");
      if (error) throw error;
      
      // If no items exist, create them automatically
      if (!data || data.length === 0) {
        const { data: recommendations, error: recError } = await supabase
          .from("recommendations")
          .select("id")
          .order("number");
        
        if (recError) throw recError;
        
        if (recommendations && recommendations.length > 0) {
          const assessmentItems = recommendations.map((rec) => ({
            assessment_id: id,
            recommendation_id: rec.id,
            status: "not_fulfilled",
          }));

          const { error: itemsError } = await supabase
            .from("assessment_items")
            .insert(assessmentItems);

          if (itemsError) throw itemsError;
          
          // Fetch the newly created items
          const { data: newData, error: newError } = await supabase
            .from("assessment_items")
            .select("*, recommendations(*)")
            .eq("assessment_id", id)
            .order("recommendations(number)");
          
          if (newError) throw newError;
          return newData;
        }
      }
      
      return data;
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      updates,
    }: {
      itemId: string;
      updates: {
        maturity_level?: number;
        notes?: string;
        recommended_actions?: string;
        status?: string;
      };
    }) => {
      const { error } = await supabase
        .from("assessment_items")
        .update(updates)
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-items", id] });
      toast.success("Gemt!");
    },
    onError: () => {
      toast.error("Kunne ikke gemme");
    },
  });

  const completeAssessmentMutation = useMutation({
    mutationFn: async () => {
      // Calculate average maturity score
      const totalScore =
        assessmentItems?.reduce((sum, item) => sum + (item.maturity_level || 0), 0) || 0;
      const avgScore = assessmentItems ? totalScore / assessmentItems.length : 0;

      const { error } = await supabase
        .from("assessments")
        .update({
          status: "completed",
          overall_maturity_score: avgScore,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vurdering afsluttet!");
      navigate(`/customers/${assessment?.customer_id}`);
    },
  });

  if (loadingAssessment || loadingItems) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!assessment) {
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
  
  if (!assessmentItems || assessmentItems.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <p className="text-muted-foreground">Indlæser vurderingspunkter...</p>
      </div>
    );
  }

  const currentItem = assessmentItems[currentStep];
  const recommendation = currentItem.recommendations;
  const progress = ((currentStep + 1) / assessmentItems.length) * 100;

  const handleNext = () => {
    if (currentStep < assessmentItems.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveAndNext = (data: any) => {
    updateItemMutation.mutate(
      {
        itemId: currentItem.id,
        updates: data,
      },
      {
        onSuccess: () => {
          if (currentStep < assessmentItems.length - 1) {
            handleNext();
          }
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <Link to={`/customers/${assessment.customer_id}`}>
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Tilbage
              </Button>
            </Link>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{assessment.customers?.name}</p>
              <p className="text-xs text-muted-foreground">
                Konsulent: {assessment.consultant_name}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Anbefaling {currentStep + 1} af {assessmentItems.length}
              </span>
              <span className="text-muted-foreground">{Math.round(progress)}% færdig</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left side - Recommendation info */}
          <Card className="p-6 shadow-elevated">
            <div className="mb-4">
              <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                #{recommendation.number}
              </span>
              <h2 className="mt-2 text-2xl font-bold text-foreground">{recommendation.title}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold text-foreground">Beskrivelse</h3>
                <p className="text-sm text-muted-foreground">{recommendation.description}</p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-foreground">Derfor er det vigtigt</h3>
                <p className="text-sm text-muted-foreground">{recommendation.importance_reason}</p>
              </div>

              {recommendation.it_recommendations && (
                <div>
                  <h3 className="mb-2 font-semibold text-foreground">IT Anbefalinger</h3>
                  <p className="text-sm text-muted-foreground">
                    {recommendation.it_recommendations}
                  </p>
                </div>
              )}

              {recommendation.ot_recommendations && assessment.customers?.operation_type !== "IT" && (
                <div>
                  <h3 className="mb-2 font-semibold text-foreground">OT Anbefalinger</h3>
                  <p className="text-sm text-muted-foreground">
                    {recommendation.ot_recommendations}
                  </p>
                </div>
              )}

              <div>
                <h3 className="mb-3 font-semibold text-foreground">Implementeringstrin</h3>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((level) => {
                    const desc =
                      recommendation[`level_${level}_description` as keyof typeof recommendation];
                    if (!desc) return null;
                    return (
                      <div key={level} className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="mb-1 text-sm font-semibold text-foreground">Niveau {level}</p>
                        <p className="text-xs text-muted-foreground">{desc as string}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Right side - Assessment form */}
          <Card className="p-6 shadow-elevated">
            <h3 className="mb-4 text-xl font-semibold text-foreground">Vurdering</h3>

            <form
              key={currentItem.id}
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveAndNext({
                  maturity_level: parseInt(formData.get("maturity_level") as string),
                  status: formData.get("status") as string,
                  notes: formData.get("notes") as string,
                  recommended_actions: formData.get("recommended_actions") as string,
                });
              }}
              className="space-y-6"
            >
              <div className="space-y-3">
                <Label>Modenhedsniveau *</Label>
                <RadioGroup
                  name="maturity_level"
                  defaultValue={currentItem.maturity_level?.toString() || "0"}
                  required
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="0" id="level-0" />
                    <Label htmlFor="level-0" className="font-normal">
                      0 - Ikke implementeret
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="level-1" />
                    <Label htmlFor="level-1" className="font-normal">
                      1 - Niveau 1
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2" id="level-2" />
                    <Label htmlFor="level-2" className="font-normal">
                      2 - Niveau 2
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="3" id="level-3" />
                    <Label htmlFor="level-3" className="font-normal">
                      3 - Niveau 3
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="4" id="level-4" />
                    <Label htmlFor="level-4" className="font-normal">
                      4 - Niveau 4 (Fuld implementering)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Status *</Label>
                <RadioGroup
                  name="status"
                  defaultValue={currentItem.status || "not_fulfilled"}
                  required
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="not_fulfilled" id="status-not" />
                    <Label htmlFor="status-not" className="font-normal">
                      Ikke opfyldt
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partially_fulfilled" id="status-partial" />
                    <Label htmlFor="status-partial" className="font-normal">
                      Delvist opfyldt
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fulfilled" id="status-fulfilled" />
                    <Label htmlFor="status-fulfilled" className="font-normal">
                      Opfyldt
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="not_applicable" id="status-na" />
                    <Label htmlFor="status-na" className="font-normal">
                      Ikke relevant
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Noter</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={currentItem.notes || ""}
                  placeholder="Tilføj noter om nuværende implementering..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recommended_actions">Anbefalede handlinger</Label>
                <Textarea
                  id="recommended_actions"
                  name="recommended_actions"
                  defaultValue={currentItem.recommended_actions || ""}
                  placeholder="Beskriv anbefalede næste skridt..."
                  rows={4}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Forrige
                </Button>
                {currentStep === assessmentItems.length - 1 ? (
                  <Button
                    type="button"
                    disabled={updateItemMutation.isPending || completeAssessmentMutation.isPending}
                    className="flex-1 gap-2 bg-success hover:bg-success/90"
                    onClick={() => {
                      const form = document.querySelector("form") as HTMLFormElement;
                      const formData = new FormData(form);
                      
                      // First update the current item
                      updateItemMutation.mutate(
                        {
                          itemId: currentItem.id,
                          updates: {
                            maturity_level: parseInt(formData.get("maturity_level") as string),
                            status: formData.get("status") as string,
                            notes: formData.get("notes") as string,
                            recommended_actions: formData.get("recommended_actions") as string,
                          },
                        },
                        {
                          onSuccess: () => {
                            // Then complete the assessment
                            completeAssessmentMutation.mutate();
                          },
                        }
                      );
                    }}
                  >
                    {updateItemMutation.isPending || completeAssessmentMutation.isPending ? (
                      <>Afslutter...</>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Afslut vurdering
                      </>
                    )}
                  </Button>
                ) : (
                  <Button 
                    type="submit" 
                    disabled={updateItemMutation.isPending}
                    className="flex-1 gap-2 bg-gradient-primary hover:opacity-90"
                  >
                    {updateItemMutation.isPending ? "Gemmer..." : (
                      <>
                        Gem og fortsæt
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AssessmentWizard;
