import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { assessmentSchema } from "@/lib/validations";
import { z } from "zod";

const NewAssessment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get("customer");
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: preselectedCustomerId || "",
    consultant_name: "",
    assessment_date: new Date().toISOString().split("T")[0],
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (preselectedCustomerId) {
      setFormData((prev) => ({ ...prev, customer_id: preselectedCustomerId }));
    }
  }, [preselectedCustomerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validatedData = assessmentSchema.parse({
        customer_id: formData.customer_id,
        consultant_name: formData.consultant_name,
        assessment_date: formData.assessment_date,
      });

      // Create assessment
      const { data: assessment, error: assessmentError } = await supabase
        .from("assessments")
        .insert([
          {
            customer_id: validatedData.customer_id,
            consultant_name: validatedData.consultant_name,
            assessment_date: validatedData.assessment_date,
            status: "in_progress",
          },
        ])
        .select()
        .single();

      if (assessmentError) throw assessmentError;

      const newAssessmentId = assessment.id;

      // Fetch all recommendations
      const { data: recommendations, error: recsError } = await supabase
        .from("recommendations")
        .select("id");

      if (recsError) throw recsError;

      // Create assessment items for each recommendation
      const assessmentItems = recommendations.map((rec) => ({
        assessment_id: newAssessmentId,
        recommendation_id: rec.id,
        status: "not_started",
      }));

      const { error: itemsError } = await supabase
        .from("assessment_items")
        .insert(assessmentItems);

      if (itemsError) throw itemsError;

      toast.success("Vurdering oprettet succesfuldt!");
      navigate(`/assessment/${newAssessmentId}`);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.issues[0].message);
      } else {
        toast.error(error.message || "Der opstod en fejl");
      }
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
              Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card className="p-6 shadow-elevated">
          <h1 className="mb-6 text-2xl font-bold text-foreground">Opret Ny Sikkerhedsvurdering</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="customer">Kunde *</Label>
              <Select
                value={formData.customer_id}
                onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg kunde" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="consultant_name">Konsulent *</Label>
              <Input
                id="consultant_name"
                required
                value={formData.consultant_name}
                onChange={(e) => setFormData({ ...formData, consultant_name: e.target.value })}
                placeholder="Indtast navn på konsulent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessment_date">Dato *</Label>
              <Input
                id="assessment_date"
                type="date"
                required
                value={formData.assessment_date}
                onChange={(e) => setFormData({ ...formData, assessment_date: e.target.value })}
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 gap-2 bg-gradient-primary hover:opacity-90"
              >
                <Save className="h-4 w-4" />
                {loading ? "Opretter..." : "Start Vurdering"}
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

export default NewAssessment;
