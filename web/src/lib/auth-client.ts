import { createAuthClient } from "better-auth/react";
import { API_BASE } from "./api-base";

// Клиент Better Auth. Ходит на отдельный API-поддомен с куками (credentials: include).
export const authClient = createAuthClient({
  baseURL: API_BASE,
  fetchOptions: { credentials: "include" },
});

export const { signIn, signUp, signOut, useSession } = authClient;
