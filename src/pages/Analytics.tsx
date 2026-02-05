import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Shield, TrendingUp, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Analytics = () => {
  const { data: assessments, isLoading } = useQuery({
    queryKey: ["all-assessments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("*, customers(name, operation_type)")
        .eq("status", "completed")
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allItems } = useQuery({
    queryKey: ["all-assessment-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_items")
        .select("*, recommendations(number, title), assessments!inner(status)")
        .eq("assessments.status", "completed");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <p className="text-muted-foreground">Indlæser analytics...</p>
      </div>
    );
  }

  // Calculate statistics
  const totalAssessments = assessments?.length || 0;
  const avgScore = assessments?.length
    ? (assessments.reduce((sum, a) => sum + (a.overall_maturity_score || 0), 0) / assessments.length).toFixed(2)
    : "0.00";

  // Maturity level distribution
  const maturityDistribution = [0, 0, 0, 0, 0];
  allItems?.forEach((item) => {
    maturityDistribution[item.maturity_level || 0]++;
  });

  const maturityChartData = maturityDistribution.map((count, level) => ({
    name: `Niveau ${level}`,
    antal: count,
    procent: allItems?.length ? ((count / allItems.length) * 100).toFixed(1) : 0,
  }));

  // Status distribution
  const statusCounts = {
    fulfilled: 0,
    partially_fulfilled: 0,
    not_fulfilled: 0,
    not_applicable: 0,
  };

  allItems?.forEach((item) => {
    if (item.status && item.status in statusCounts) {
      statusCounts[item.status as keyof typeof statusCounts]++;
    }
  });

  const statusChartData = [
    { name: "Opfyldt", value: statusCounts.fulfilled, color: "#22c55e" },
    { name: "Delvist opfyldt", value: statusCounts.partially_fulfilled, color: "#f59e0b" },
    { name: "Ikke opfyldt", value: statusCounts.not_fulfilled, color: "#ef4444" },
    { name: "Ikke relevant", value: statusCounts.not_applicable, color: "#6b7280" },
  ];

  // Top 5 weakest recommendations
  const recommendationScores = new Map<number, { title: string; totalScore: number; count: number }>();
  
  allItems?.forEach((item) => {
    const recNum = item.recommendations.number;
    const current = recommendationScores.get(recNum) || {
      title: item.recommendations.title,
      totalScore: 0,
      count: 0,
    };
    current.totalScore += item.maturity_level || 0;
    current.count++;
    recommendationScores.set(recNum, current);
  });

  const weakestRecommendations = Array.from(recommendationScores.entries())
    .map(([number, data]) => ({
      number,
      title: data.title,
      avgScore: data.totalScore / data.count,
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 5);

  const weaknessChartData = weakestRecommendations.map((rec) => ({
    name: `#${rec.number} ${rec.title.substring(0, 20)}...`,
    score: rec.avgScore.toFixed(2),
  }));

  // Industry comparison (IT vs OT vs BOTH)
  const industryScores = new Map<string, { totalScore: number; count: number }>();
  
  assessments?.forEach((assessment) => {
    const type = assessment.customers?.operation_type || "Unknown";
    const current = industryScores.get(type) || { totalScore: 0, count: 0 };
    current.totalScore += assessment.overall_maturity_score || 0;
    current.count++;
    industryScores.set(type, current);
  });

  const industryChartData = Array.from(industryScores.entries()).map(([type, data]) => ({
    type,
    score: (data.totalScore / data.count).toFixed(2),
  }));

  // Radar chart data - average by category groupings
  const categoryGroups = [
    { name: "Netværk", recommendations: [1, 2, 15, 16] },
    { name: "Endpoints", recommendations: [3, 10, 11] },
    { name: "Backup & Respons", recommendations: [4, 12, 23, 24] },
    { name: "Adgang", recommendations: [5, 6, 7, 8, 9, 19, 20] },
    { name: "Monitoring", recommendations: [13, 17, 25] },
    { name: "Governance", recommendations: [14, 18, 21, 22] },
  ];

  const radarData = categoryGroups.map((group) => {
    const relevantItems = allItems?.filter((item) =>
      group.recommendations.includes(item.recommendations.number)
    );
    const avgScore = relevantItems?.length
      ? relevantItems.reduce((sum, item) => sum + (item.maturity_level || 0), 0) / relevantItems.length
      : 0;
    
    return {
      category: group.name,
      score: parseFloat(avgScore.toFixed(2)),
      maxScore: 4,
    };
  });

  return (
    <div className="min-h-screen bg-gradient-hero pb-8">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
              <p className="text-sm text-muted-foreground">Overblik over alle sikkerhedsvurderinger</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* KPI Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vurderinger</p>
                <p className="text-2xl font-bold text-foreground">{totalAssessments}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gns. Score</p>
                <p className="text-2xl font-bold text-foreground">{avgScore}/4</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Opfyldte</p>
                <p className="text-2xl font-bold text-foreground">{statusCounts.fulfilled}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ikke opfyldte</p>
                <p className="text-2xl font-bold text-foreground">{statusCounts.not_fulfilled}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Maturity Distribution */}
          <Card className="p-6 shadow-elevated">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Modenhedsniveau Fordeling</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={maturityChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="antal" fill="hsl(var(--primary))" name="Antal" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Status Distribution */}
          <Card className="p-6 shadow-elevated">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Status Fordeling</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Radar Chart - Category Overview */}
          <Card className="p-6 shadow-elevated">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Kategori Overblik</h2>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" />
                <PolarRadiusAxis angle={90} domain={[0, 4]} />
                <Radar
                  name="Gennemsnitlig Score"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.6}
                />
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </Card>

          {/* Weakest Recommendations */}
          <Card className="p-6 shadow-elevated">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Områder med Lavest Score</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weaknessChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 4]} />
                <YAxis dataKey="name" type="category" width={150} />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" fill="hsl(var(--destructive))" name="Gns. Score" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Industry Comparison */}
          {industryChartData.length > 0 && (
            <Card className="p-6 shadow-elevated lg:col-span-2">
              <h2 className="mb-4 text-xl font-semibold text-foreground">Sammenligning: IT vs OT</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={industryChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis domain={[0, 4]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="score" fill="hsl(var(--secondary))" name="Gennemsnitlig Score" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>

        {/* Recent Assessments */}
        <Card className="mt-6 p-6 shadow-elevated">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Seneste Vurderinger</h2>
          <div className="space-y-3">
            {assessments?.slice(0, 5).map((assessment) => (
              <div
                key={assessment.id}
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent"
              >
                <div>
                  <h3 className="font-semibold text-foreground">{assessment.customers?.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Score: {assessment.overall_maturity_score?.toFixed(2)}/4 • {assessment.customers?.operation_type}
                  </p>
                </div>
                <Link to={`/assessments/${assessment.id}/report`}>
                  <Button variant="outline">Se rapport</Button>
                </Link>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Analytics;
