import { createAuthClient } from "better-auth/react";

// Клиент Better Auth. Ходит на отдельный API-поддомен с куками (credentials: include).
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL as string,
  fetchOptions: { credentials: "include" },
});

export const { signIn, signUp, signOut, useSession } = authClient;
