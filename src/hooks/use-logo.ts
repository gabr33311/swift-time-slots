import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Business logos live in a private bucket; resolve a temporary signed URL.
 * `path` is the storage path stored in businesses.logo_url.
 */
export function useLogoUrl(path: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["logo-url", path],
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data } = await supabase.storage
        .from("business-logos")
        .createSignedUrl(path, 60 * 60);
      return data?.signedUrl ?? null;
    },
  });
  return data ?? null;
}
