import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import type { Database } from "@/integrations/supabase/types";

export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type MemberRole = Database["public"]["Enums"]["member_role"];

export function useMyBusiness() {
  const { user, loading } = useAuth();

  const query = useQuery({
    queryKey: ["my-business", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from("business_members")
        .select("business_id, role, created_at")
        .order("created_at");
      if (error) throw error;
      if (!memberships || memberships.length === 0)
        return { business: null as Business | null, role: null as MemberRole | null, count: 0 };

      const stored =
        typeof window !== "undefined" ? window.localStorage.getItem("active_business") : null;
      const chosen =
        memberships.find((m) => m.business_id === stored) ?? memberships[0]!;

      const { data: business } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", chosen.business_id)
        .maybeSingle();

      return {
        business: (business ?? null) as Business | null,
        role: chosen.role as MemberRole,
        count: memberships.length,
      };
    },
  });

  return {
    ...query,
    authLoading: loading,
    business: query.data?.business ?? null,
    role: query.data?.role ?? null,
  };
}
