import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Building2, ClipboardList, Shield, FileText, ScrollText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type SearchResult = {
  id: string;
  type: "customer" | "assessment" | "emergency_plan" | "nis2_plan" | "document";
  label: string;
  sublabel?: string;
  route: string;
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: customers = [] } = useQuery({
    queryKey: ["global-search", "customers"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, contact_person, operation_type")
        .order("name");
      return data ?? [];
    },
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ["global-search", "assessments"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("assessments")
        .select("id, consultant_name, status, assessment_date, version, customer_id, customers(name)")
        .order("assessment_date", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: emergencyPlans = [] } = useQuery({
    queryKey: ["global-search", "emergency_plans"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("emergency_plans")
        .select("id, title, version, customer_id, customers(name)")
        .order("updated_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: nis2Plans = [] } = useQuery({
    queryKey: ["global-search", "nis2_plans"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("nis2_plans")
        .select("id, title, version, customer_id, customers(name)")
        .order("updated_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["global-search", "documents"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_documents")
        .select("id, title, file_name, category, customer_id, customers(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const results: SearchResult[] = useMemo(() => {
    const out: SearchResult[] = [];
    for (const c of customers as any[]) {
      out.push({
        id: c.id,
        type: "customer",
        label: c.name,
        sublabel: [c.contact_person, c.operation_type].filter(Boolean).join(" · "),
        route: `/customers/${c.id}`,
      });
    }
    for (const a of assessments as any[]) {
      out.push({
        id: a.id,
        type: "assessment",
        label: `Assessment v${a.version} – ${a.customers?.name ?? "Kunde"}`,
        sublabel: `${a.consultant_name} · ${a.assessment_date} · ${a.status}`,
        route: a.status === "completed" ? `/assessment/${a.id}/report` : `/assessments/${a.id}`,
      });
    }
    for (const p of emergencyPlans as any[]) {
      out.push({
        id: p.id,
        type: "emergency_plan",
        label: `${p.title} (v${p.version})`,
        sublabel: p.customers?.name,
        route: `/customers/${p.customer_id}`,
      });
    }
    for (const p of nis2Plans as any[]) {
      out.push({
        id: p.id,
        type: "nis2_plan",
        label: `${p.title} (v${p.version})`,
        sublabel: p.customers?.name,
        route: `/customers/${p.customer_id}`,
      });
    }
    for (const d of documents as any[]) {
      out.push({
        id: d.id,
        type: "document",
        label: d.title || d.file_name,
        sublabel: [d.customers?.name, d.category].filter(Boolean).join(" · "),
        route: `/customers/${d.customer_id}`,
      });
    }
    return out;
  }, [customers, assessments, emergencyPlans, nis2Plans, documents]);

  const grouped = useMemo(() => {
    const groups: Record<SearchResult["type"], SearchResult[]> = {
      customer: [],
      assessment: [],
      emergency_plan: [],
      nis2_plan: [],
      document: [],
    };
    for (const r of results) groups[r.type].push(r);
    return groups;
  }, [results]);

  const go = (route: string) => {
    setOpen(false);
    setQuery("");
    navigate(route);
  };

  const groupConfig: Array<{ key: SearchResult["type"]; heading: string; icon: any }> = [
    { key: "customer", heading: "Kunder", icon: Building2 },
    { key: "assessment", heading: "Assessments", icon: ClipboardList },
    { key: "emergency_plan", heading: "Beredskabsplaner", icon: Shield },
    { key: "nis2_plan", heading: "NIS2 planer", icon: ScrollText },
    { key: "document", heading: "Dokumenter", icon: FileText },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Søg kunder, assessments, planer, dokumenter…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Ingen resultater.</CommandEmpty>
        {groupConfig.map((g, idx) => {
          const items = grouped[g.key];
          if (!items.length) return null;
          const Icon = g.icon;
          return (
            <div key={g.key}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={g.heading}>
                {items.slice(0, 25).map((r) => (
                  <CommandItem
                    key={`${g.key}-${r.id}`}
                    value={`${r.label} ${r.sublabel ?? ""} ${g.heading}`}
                    onSelect={() => go(r.route)}
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{r.label}</span>
                      {r.sublabel && (
                        <span className="text-xs text-muted-foreground">{r.sublabel}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

export function GlobalSearchTrigger() {
  const [, force] = useState(0);
  const trigger = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
    force((n) => n + 1);
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={trigger}
      className="gap-2 text-muted-foreground"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Søg…</span>
      <CommandShortcut className="hidden md:inline">⌘K</CommandShortcut>
    </Button>
  );
}