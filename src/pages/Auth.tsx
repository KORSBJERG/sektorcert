import { useState } from "react";
 import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
 import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
 import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authSchema } from "@/lib/validations";
import { z } from "zod";
 import { Separator } from "@/components/ui/separator";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
   const [googleLoading, setGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
   const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

   const handleGoogleLogin = async () => {
     setGoogleLoading(true);
     try {
       const { error } = await lovable.auth.signInWithOAuth("google", {
         redirect_uri: window.location.origin,
       });
       if (error) throw error;
     } catch (error: any) {
       toast.error(error.message || "Der opstod en fejl ved Google login");
       setGoogleLoading(false);
     }
   };
 
   const handleForgotPassword = async (e: React.FormEvent) => {
     e.preventDefault();
     setLoading(true);
 
     try {
       if (!email) {
         toast.error("Indtast din email-adresse");
         return;
       }
 
       const { error } = await supabase.auth.resetPasswordForEmail(email, {
         redirectTo: `${window.location.origin}/auth?type=recovery`,
       });
       
       if (error) throw error;
       toast.success("Tjek din email for at nulstille dit password");
       setIsForgotPassword(false);
     } catch (error: any) {
       toast.error(error.message || "Der opstod en fejl");
     } finally {
       setLoading(false);
     }
   };
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validatedData = authSchema.parse({ email, password });

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: validatedData.email,
          password: validatedData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        if (error) throw error;
        toast.success("Konto oprettet! Du kan nu logge ind.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: validatedData.email,
          password: validatedData.password,
        });
        if (error) throw error;
        toast.success("Logget ind!");
        navigate("/");
      }
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
    <div className="flex min-h-screen items-center justify-center bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      
      <Card className="relative w-full max-w-md p-8 border-border/50 bg-card/95 backdrop-blur-sm shadow-elevated">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-foreground tracking-tight">PEAKNET & DSData</h1>
          <p className="text-muted-foreground">
             {isForgotPassword 
               ? "Nulstil dit password" 
               : isSignUp 
                 ? "Opret din konto" 
                 : "Log ind for at fortsætte"}
          </p>
        </div>

         {isForgotPassword ? (
           <form onSubmit={handleForgotPassword} className="space-y-5">
             <div className="space-y-2">
               <Label htmlFor="email" className="text-foreground">Email</Label>
               <Input
                 id="email"
                 type="email"
                 required
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 placeholder="din@email.dk"
                 className="bg-secondary/50 border-border focus:border-primary"
               />
             </div>
 
             <Button
               type="submit"
               disabled={loading}
               className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
             >
               {loading ? "Sender..." : "Send nulstillingslink"}
             </Button>
 
             <div className="text-center">
               <button
                 type="button"
                 onClick={() => setIsForgotPassword(false)}
                 className="text-sm text-muted-foreground hover:text-primary transition-colors"
               >
                 Tilbage til login
               </button>
             </div>
           </form>
         ) : (
           <>
             {/* Google Login Button */}
             <Button
               type="button"
               variant="outline"
               onClick={handleGoogleLogin}
               disabled={googleLoading}
               className="w-full mb-4 border-border hover:bg-secondary/50"
             >
               {googleLoading ? (
                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
               ) : (
                 <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                   <path
                     fill="currentColor"
                     d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                   />
                   <path
                     fill="currentColor"
                     d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                   />
                   <path
                     fill="currentColor"
                     d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                   />
                   <path
                     fill="currentColor"
                     d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                   />
                 </svg>
               )}
               Fortsæt med Google
             </Button>
 
             <div className="relative my-6">
               <Separator className="bg-border" />
               <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                 eller
               </span>
             </div>
 
             <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@email.dk"
              className="bg-secondary/50 border-border focus:border-primary"
            />
          </div>

          <div className="space-y-2">
             <div className="flex items-center justify-between">
               <Label htmlFor="password" className="text-foreground">Password</Label>
               {!isSignUp && (
                 <button
                   type="button"
                   onClick={() => setIsForgotPassword(true)}
                   className="text-xs text-muted-foreground hover:text-primary transition-colors"
                 >
                   Glemt password?
                 </button>
               )}
             </div>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="bg-secondary/50 border-border focus:border-primary"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {loading ? "Behandler..." : isSignUp ? "Opret konto" : "Log ind"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {isSignUp ? "Har du allerede en konto? " : "Har du ikke en konto? "}
            <span className="text-primary font-medium">
              {isSignUp ? "Log ind" : "Opret en"}
            </span>
          </button>
        </div>
           </>
         )}

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Enterprise-grade cybersikkerhed af PEAKNET & DSData
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Auth;