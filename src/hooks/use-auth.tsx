import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "superadmin" | "driver" | "user";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [testRole, setTestRole] = useState<Role | null>(null);

  useEffect(() => {
    const storedRole = window.localStorage.getItem("seruit_test_role") as Role | null;
    if (storedRole === "superadmin" || storedRole === "driver" || storedRole === "user") {
      setTestRole(storedRole);
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const rolesQuery = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((r) => r.role as Role);
    },
  });

  const actualRoles = rolesQuery.data ?? [];
  const isActualAdmin = actualRoles.includes("superadmin");
  const activeRole = isActualAdmin ? testRole : null;

  const setSimulation = (role: Role | null) => {
    if (role) {
      window.localStorage.setItem("seruit_test_role", role);
    } else {
      window.localStorage.removeItem("seruit_test_role");
    }
    setTestRole(role);
    window.location.reload();
  };

  return {
    user,
    ready: ready && (!user || !rolesQuery.isLoading),
    roles: actualRoles,
    isAdmin: isActualAdmin,
    isDriver: activeRole ? activeRole === "driver" : actualRoles.includes("driver"),
    isCustomerView: activeRole === "user",
    testRole: isActualAdmin ? testRole : null,
    setSimulation,
  };
}
