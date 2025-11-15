import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        if (error) throw error;
        toast.success("Konto oprettet! Du kan nu logge ind.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Logget ind!");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Der opstod en fejl");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
      <Card className="w-full max-w-md p-8 shadow-elevated">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-primary">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">SektorCERT</h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? "Opret konto" : "Log ind på dit system"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@email.dk"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-primary hover:opacity-90"
          >
            {loading ? "Behandler..." : isSignUp ? "Opret konto" : "Log ind"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-primary hover:underline"
          >
            {isSignUp ? "Har du allerede en konto? Log ind" : "Har du ikke en konto? Opret en"}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
