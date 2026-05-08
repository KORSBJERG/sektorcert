import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, UserPlus, Trash2, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emailSchema = z.string().trim().toLowerCase().email("Ugyldig email").max(255);

interface Props {
  customerId: string;
  customerName: string;
}

export const InviteCustomerDialog = ({ customerId, customerName }: Props) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: invitations } = useQuery({
    queryKey: ["customer-invitations", customerId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_invitations")
        .select("id, email, status, created_at, accepted_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: linkedUsers } = useQuery({
    queryKey: ["customer-linked-users", customerId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_users")
        .select("id, user_id, created_at")
        .eq("customer_id", customerId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleInvite = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast({ title: "Fejl", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke logget ind");

      const { error } = await supabase.from("customer_invitations").insert({
        customer_id: customerId,
        email: parsed.data,
        invited_by_user_id: user.id,
      });
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Allerede inviteret", description: "Denne email er allerede inviteret.", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }
      toast({
        title: "Invitation oprettet",
        description: `Bed ${parsed.data} om at oprette en konto med denne mailadresse — adgangen kobles automatisk.`,
      });
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["customer-invitations", customerId] });
    } catch (err: any) {
      toast({ title: "Fejl", description: err.message ?? "Kunne ikke invitere", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const { error } = await supabase.from("customer_invitations").delete().eq("id", id);
    if (error) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["customer-invitations", customerId] });
  };

  const handleUnlink = async (id: string) => {
    const { error } = await supabase.from("customer_users").delete().eq("id", id);
    if (error) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["customer-linked-users", customerId] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Kundelogin
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Inviter kunde — {customerName}</DialogTitle>
          <DialogDescription>
            Inviter en kontaktperson så de kan logge ind og se færdige rapporter for denne kunde.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <div className="flex gap-2">
            <Input
              id="invite-email"
              type="email"
              placeholder="kontakt@kunde.dk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
            <Button onClick={handleInvite} disabled={submitting || !email} className="gap-2">
              <Mail className="h-4 w-4" />
              Inviter
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Bed kunden om at oprette konto på siden med denne email — kobling sker automatisk.
          </p>
        </div>

        {linkedUsers && linkedUsers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Aktive logins ({linkedUsers.length})</h4>
            <ul className="space-y-1">
              {linkedUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Bruger #{u.user_id.slice(0, 8)}
                  </span>
                  <Button onClick={() => handleUnlink(u.id)} variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {invitations && invitations.filter((i) => i.status === "pending").length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Afventer accept</h4>
            <ul className="space-y-1">
              {invitations
                .filter((i) => i.status === "pending")
                .map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {i.email}
                    </span>
                    <Button onClick={() => handleRevoke(i.id)} variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline">Luk</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
