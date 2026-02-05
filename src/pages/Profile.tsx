 import { useState, useEffect } from "react";
 import { useNavigate } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { ArrowLeft, Save, Loader2, User } from "lucide-react";
 import { toast } from "sonner";
 import { NavLink } from "@/components/NavLink";
 import UserMenu from "@/components/UserMenu";
 
 interface Profile {
   id: string;
   user_id: string;
   display_name: string | null;
   email: string | null;
   phone: string | null;
   avatar_url: string | null;
 }
 
 const Profile = () => {
   const navigate = useNavigate();
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState("");
   const [displayName, setDisplayName] = useState("");
   const [phone, setPhone] = useState("");
 
   useEffect(() => {
     const fetchProfile = async () => {
       try {
         const { data: { session } } = await supabase.auth.getSession();
         if (!session?.user) {
           navigate("/auth");
           return;
         }
 
        // Get email directly from auth session (always available)
        setUserEmail(session.user.email || "");

         const { data, error } = await supabase
           .from("profiles")
           .select("*")
           .eq("user_id", session.user.id)
           .single();
 
         if (error && error.code !== "PGRST116") {
           throw error;
         }
 
         if (data) {
           setProfile(data);
           setDisplayName(data.display_name || "");
           setPhone(data.phone || "");
         }
       } catch (error: any) {
         toast.error("Kunne ikke hente profil");
       } finally {
         setLoading(false);
       }
     };
 
     fetchProfile();
   }, [navigate]);
 
   const handleSave = async () => {
     if (!profile) return;
     
     setSaving(true);
     try {
       const { error } = await supabase
         .from("profiles")
         .update({
           display_name: displayName.trim() || null,
           phone: phone.trim() || null,
         })
         .eq("id", profile.id);
 
       if (error) throw error;
       toast.success("Profil opdateret");
     } catch (error: any) {
       toast.error(error.message || "Kunne ikke opdatere profil");
     } finally {
       setSaving(false);
     }
   };
 
   if (loading) {
     return (
       <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   return (
     <div className="min-h-screen bg-gradient-hero">
       {/* Header */}
       <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-md">
         <div className="flex h-16 items-center justify-between px-6">
           <div className="flex items-center gap-6">
             <NavLink to="/">Dashboard</NavLink>
             <NavLink to="/customers">Kunder</NavLink>
             <NavLink to="/analytics">Analytics</NavLink>
             <NavLink to="/audit-logs">Audit Logs</NavLink>
           </div>
           <UserMenu />
         </div>
       </header>
 
       {/* Main content */}
       <main className="p-6">
         <div className="max-w-2xl mx-auto">
           <Button
             variant="ghost"
             onClick={() => navigate(-1)}
             className="mb-6 text-muted-foreground hover:text-foreground"
           >
             <ArrowLeft className="h-4 w-4 mr-2" />
             Tilbage
           </Button>
 
           <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
             <CardHeader>
               <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-primary/10">
                   <User className="h-6 w-6 text-primary" />
                 </div>
                 <div>
                   <CardTitle>Min profil</CardTitle>
                   <CardDescription>Administrer dine profiloplysninger</CardDescription>
                 </div>
               </div>
             </CardHeader>
             <CardContent className="space-y-6">
               <div className="space-y-2">
                 <Label htmlFor="email">Email</Label>
                 <Input
                   id="email"
                   type="email"
                    value={userEmail}
                   disabled
                   className="bg-muted/50"
                 />
                 <p className="text-xs text-muted-foreground">
                   Email kan ikke ændres
                 </p>
               </div>
 
               <div className="space-y-2">
                 <Label htmlFor="displayName">Visningsnavn</Label>
                 <Input
                   id="displayName"
                   type="text"
                   value={displayName}
                   onChange={(e) => setDisplayName(e.target.value)}
                   placeholder="Dit navn"
                   className="bg-secondary/50 border-border focus:border-primary"
                 />
               </div>
 
               <div className="space-y-2">
                 <Label htmlFor="phone">Telefon</Label>
                 <Input
                   id="phone"
                   type="tel"
                   value={phone}
                   onChange={(e) => setPhone(e.target.value)}
                   placeholder="+45 12 34 56 78"
                   className="bg-secondary/50 border-border focus:border-primary"
                 />
               </div>
 
               <Button
                 onClick={handleSave}
                 disabled={saving}
                 className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
               >
                 {saving ? (
                   <>
                     <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                     Gemmer...
                   </>
                 ) : (
                   <>
                     <Save className="h-4 w-4 mr-2" />
                     Gem ændringer
                   </>
                 )}
               </Button>
             </CardContent>
           </Card>
         </div>
       </main>
     </div>
   );
 };
 
 export default Profile;