import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    credentials: "include",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  return res;
}

const defaultQueryFn: QueryFunction = async ({ queryKey }) => {
  // Build URL from queryKey array — join segments with /
  const url = (queryKey as any[]).join("/").replace(/\/+/g, "/");
  const res = await fetch(`${API_BASE}${url}`, { credentials: "include" });

  if (res.status === 401) {
    // Return null/empty for auth failures — the AuthContext handles redirect to login
    return null;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }

  return await res.json();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
