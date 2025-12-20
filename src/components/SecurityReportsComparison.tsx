import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface SecurityReportsComparisonProps {
  customerId: string;
}

interface SecurityReport {
  id: string;
  file_name: string;
  analysis_status: string;
  secure_score_current: number | null;
  secure_score_predicted: number | null;
  overall_status_percentage: number | null;
  created_at: string;
}

interface ReportMatch {
  id: string;
  report_recommendation_name: string;
  report_status: string | null;
  recommendation_id: number | null;
  match_confidence: number | null;
  suggested_maturity_level: number | null;
  recommendations?: {
    number: number;
    title: string;
  } | null;
}

export function SecurityReportsComparison({ customerId }: SecurityReportsComparisonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);

  const { data: reports } = useQuery({
    queryKey: ["security-reports", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_reports")
        .select("*")
        .eq("customer_id", customerId)
        .eq("analysis_status", "completed")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as SecurityReport[];
    },
  });

  const { data: allMatches } = useQuery({
    queryKey: ["all-security-matches", customerId],
    enabled: isOpen && (reports?.length ?? 0) > 0,
    queryFn: async () => {
      const reportIds = reports?.map(r => r.id) || [];
      const { data, error } = await supabase
        .from("security_report_matches")
        .select("*, recommendations(number, title), security_reports(created_at)")
        .in("security_report_id", reportIds);
      if (error) throw error;
      return data as (ReportMatch & { security_reports: { created_at: string } })[];
    },
  });

  if (!reports || reports.length < 2) {
    return null;
  }

  // Prepare chart data
  const chartData = reports.map(report => ({
    date: format(new Date(report.created_at), "d. MMM", { locale: da }),
    fullDate: format(new Date(report.created_at), "d. MMMM yyyy", { locale: da }),
    secureScore: report.secure_score_current || 0,
    predictedScore: report.secure_score_predicted || 0,
    statusPercentage: report.overall_status_percentage || 0,
    reportId: report.id,
    fileName: report.file_name,
  }));

  // Calculate improvements
  const latestReport = reports[reports.length - 1];
  const firstReport = reports[0];
  
  const scoreChange = (latestReport.secure_score_current || 0) - (firstReport.secure_score_current || 0);
  const statusChange = (latestReport.overall_status_percentage || 0) - (firstReport.overall_status_percentage || 0);

  // Group matches by recommendation to track changes
  const matchesByRecommendation = new Map<number, { changes: { date: string; level: number; status: string }[]; name: string; title: string }>();
  
  allMatches?.forEach(match => {
    if (!match.recommendation_id || !match.recommendations) return;
    
    const existing = matchesByRecommendation.get(match.recommendation_id);
    const changeEntry = {
      date: match.security_reports.created_at,
      level: match.suggested_maturity_level || 0,
      status: match.report_status || "Unknown",
    };
    
    if (existing) {
      existing.changes.push(changeEntry);
    } else {
      matchesByRecommendation.set(match.recommendation_id, {
        changes: [changeEntry],
        name: match.report_recommendation_name,
        title: `#${match.recommendations.number}: ${match.recommendations.title}`,
      });
    }
  });

  // Sort changes by date and calculate trends
  const recommendationTrends = Array.from(matchesByRecommendation.entries()).map(([id, data]) => {
    const sortedChanges = data.changes.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const firstLevel = sortedChanges[0]?.level || 0;
    const lastLevel = sortedChanges[sortedChanges.length - 1]?.level || 0;
    const trend = lastLevel - firstLevel;
    
    return {
      id,
      name: data.name,
      title: data.title,
      firstLevel,
      lastLevel,
      trend,
      changes: sortedChanges,
    };
  }).filter(r => r.changes.length > 1);

  const improved = recommendationTrends.filter(r => r.trend > 0);
  const declined = recommendationTrends.filter(r => r.trend < 0);
  const unchanged = recommendationTrends.filter(r => r.trend === 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Sammenlign rapporter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Sikkerhedsrapport-sammenligning over tid
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Score ændring</p>
                      <p className="text-2xl font-bold">
                        {scoreChange >= 0 ? "+" : ""}{scoreChange.toFixed(0)}
                      </p>
                    </div>
                    {scoreChange > 0 ? (
                      <ArrowUpRight className="h-8 w-8 text-success" />
                    ) : scoreChange < 0 ? (
                      <ArrowDownRight className="h-8 w-8 text-destructive" />
                    ) : (
                      <Minus className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fra {firstReport.secure_score_current?.toFixed(0) || 0} til {latestReport.secure_score_current?.toFixed(0) || 0}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Status ændring</p>
                      <p className="text-2xl font-bold">
                        {statusChange >= 0 ? "+" : ""}{statusChange.toFixed(0)}%
                      </p>
                    </div>
                    {statusChange > 0 ? (
                      <ArrowUpRight className="h-8 w-8 text-success" />
                    ) : statusChange < 0 ? (
                      <ArrowDownRight className="h-8 w-8 text-destructive" />
                    ) : (
                      <Minus className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Overordnet status forbedring
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Antal rapporter</p>
                      <p className="text-2xl font-bold">{reports.length}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Analyserede over tid
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score udvikling</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs fill-muted-foreground"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs fill-muted-foreground"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="secureScore" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                        name="Secure Score"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="statusPercentage" 
                        stroke="hsl(var(--success))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--success))' }}
                        name="Status %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Trends by Recommendation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Improved */}
              <Card className="border-success/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-success">
                    <TrendingUp className="h-4 w-4" />
                    Forbedret ({improved.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {improved.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Ingen forbedringer endnu</p>
                    ) : (
                      improved.map(rec => (
                        <div key={rec.id} className="text-sm p-2 rounded bg-success/5">
                          <p className="font-medium truncate" title={rec.title}>
                            {rec.title}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              Niveau {rec.firstLevel}
                            </Badge>
                            <span>→</span>
                            <Badge className="text-xs bg-success">
                              Niveau {rec.lastLevel}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Unchanged */}
              <Card className="border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                    <Minus className="h-4 w-4" />
                    Uændret ({unchanged.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {unchanged.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Alle har ændret sig</p>
                    ) : (
                      unchanged.map(rec => (
                        <div key={rec.id} className="text-sm p-2 rounded bg-muted/30">
                          <p className="font-medium truncate" title={rec.title}>
                            {rec.title}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            Niveau {rec.lastLevel}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Declined */}
              <Card className="border-destructive/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <TrendingDown className="h-4 w-4" />
                    Forværret ({declined.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {declined.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Ingen forværringer</p>
                    ) : (
                      declined.map(rec => (
                        <div key={rec.id} className="text-sm p-2 rounded bg-destructive/5">
                          <p className="font-medium truncate" title={rec.title}>
                            {rec.title}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              Niveau {rec.firstLevel}
                            </Badge>
                            <span>→</span>
                            <Badge variant="destructive" className="text-xs">
                              Niveau {rec.lastLevel}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Report Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rapport tidslinje</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {[...reports].reverse().map((report, index) => (
                      <div key={report.id} className="relative pl-10">
                        <div className="absolute left-2 w-4 h-4 rounded-full bg-primary border-2 border-background" />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{report.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(report.created_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {report.secure_score_current && (
                              <Badge variant="outline">
                                Score: {report.secure_score_current.toFixed(0)}
                              </Badge>
                            )}
                            {report.overall_status_percentage && (
                              <Badge variant="secondary">
                                {report.overall_status_percentage.toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default SecurityReportsComparison;
