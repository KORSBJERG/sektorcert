 import { useState, useEffect } from "react";
 import { useNavigate } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
 } from "@/components/ui/dropdown-menu";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { User, Settings, LogOut, Loader2 } from "lucide-react";
 import { toast } from "sonner";
 
 interface Profile {
   display_name: string | null;
   email: string | null;
   avatar_url: string | null;
 }
 
 const UserMenu = () => {
   const navigate = useNavigate();
   const [loading, setLoading] = useState(false);
   const [profile, setProfile] = useState<Profile | null>(null);
   const [userEmail, setUserEmail] = useState<string | null>(null);
 
   useEffect(() => {
     const fetchProfile = async () => {
       const { data: { session } } = await supabase.auth.getSession();
       if (session?.user) {
         setUserEmail(session.user.email || null);
         
         const { data } = await supabase
           .from("profiles")
           .select("display_name, email, avatar_url")
           .eq("user_id", session.user.id)
           .single();
         
         if (data) {
           setProfile(data);
         }
       }
     };
 
     fetchProfile();
 
     const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
       if (session?.user) {
         setUserEmail(session.user.email || null);
         
         const { data } = await supabase
           .from("profiles")
           .select("display_name, email, avatar_url")
           .eq("user_id", session.user.id)
           .single();
         
         if (data) {
           setProfile(data);
         }
       } else {
         setProfile(null);
         setUserEmail(null);
       }
     });
 
     return () => subscription.unsubscribe();
   }, []);
 
   const handleLogout = async () => {
     setLoading(true);
     try {
       const { error } = await supabase.auth.signOut();
       if (error) throw error;
       toast.success("Logget ud");
       navigate("/auth");
     } catch (error: any) {
       toast.error(error.message || "Kunne ikke logge ud");
     } finally {
       setLoading(false);
     }
   };
 
   const displayName = profile?.display_name || userEmail || "Bruger";
   const initials = displayName
     .split(" ")
     .map((n) => n[0])
     .join("")
     .toUpperCase()
     .slice(0, 2);
 
   return (
     <DropdownMenu>
       <DropdownMenuTrigger asChild>
         <Button variant="ghost" className="relative h-9 w-9 rounded-full">
           <Avatar className="h-9 w-9">
             <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
             <AvatarFallback className="bg-primary/10 text-primary text-sm">
               {initials}
             </AvatarFallback>
           </Avatar>
         </Button>
       </DropdownMenuTrigger>
       <DropdownMenuContent className="w-56" align="end" forceMount>
         <DropdownMenuLabel className="font-normal">
           <div className="flex flex-col space-y-1">
             <p className="text-sm font-medium leading-none">{displayName}</p>
             <p className="text-xs leading-none text-muted-foreground">
               {userEmail}
             </p>
           </div>
         </DropdownMenuLabel>
         <DropdownMenuSeparator />
         <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
           <User className="mr-2 h-4 w-4" />
           <span>Min profil</span>
         </DropdownMenuItem>
         <DropdownMenuSeparator />
         <DropdownMenuItem 
           onClick={handleLogout} 
           disabled={loading}
           className="cursor-pointer text-destructive focus:text-destructive"
         >
           {loading ? (
             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
           ) : (
             <LogOut className="mr-2 h-4 w-4" />
           )}
           <span>Log ud</span>
         </DropdownMenuItem>
       </DropdownMenuContent>
     </DropdownMenu>
   );
 };
 
 export default UserMenu;