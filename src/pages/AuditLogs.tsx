import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Shield, FileText, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";

const AuditLogs = () => {
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case "INSERT":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "UPDATE":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "DELETE":
        return "bg-red-500/10 text-red-700 dark:text-red-400";
      case "SELECT":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTableDisplayName = (tableName: string) => {
    const names: Record<string, string> = {
      customers: "Kunder",
      assessments: "Vurderinger",
      assessment_items: "Vurderingspunkter",
    };
    return names[tableName] || tableName;
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="p-6 shadow-elevated">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Aktivitetslog</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Oversigt over alle ændringer i systemet
              </p>
            </div>
            <Badge variant="outline" className="gap-2">
              <Clock className="h-3 w-3" />
              Sidste 100 hændelser
            </Badge>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Indlæser...</div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Ingen aktivitet registreret endnu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                        <span className="font-medium text-foreground">
                          {getTableDisplayName(log.table_name)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ID: {log.record_id.substring(0, 8)}...
                        </span>
                      </div>

                      {log.changed_fields && log.changed_fields.length > 0 && (
                        <div className="text-sm text-muted-foreground mb-2">
                          Ændrede felter:{" "}
                          <span className="font-medium text-foreground">
                            {log.changed_fields.join(", ")}
                          </span>
                        </div>
                      )}

                      {log.action === "INSERT" && log.new_data && (
                        <details className="text-sm mt-2">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Vis nye data
                          </summary>
                          <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.new_data, null, 2)}
                          </pre>
                        </details>
                      )}

                      {log.action === "UPDATE" && (
                        <details className="text-sm mt-2">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Vis ændringer
                          </summary>
                          <div className="mt-2 grid grid-cols-2 gap-4">
                            {log.old_data && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Før:
                                </p>
                                <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
                                  {JSON.stringify(log.old_data, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.new_data && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Efter:
                                </p>
                                <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
                                  {JSON.stringify(log.new_data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </details>
                      )}

                      {log.action === "DELETE" && log.old_data && (
                        <details className="text-sm mt-2">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Vis slettede data
                          </summary>
                          <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.old_data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>

                    <div className="text-right text-sm">
                      <div className="text-muted-foreground">
                        {format(new Date(log.timestamp), "dd. MMM yyyy", { locale: da })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(log.timestamp), "HH:mm:ss")}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AuditLogs;
