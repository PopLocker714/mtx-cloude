import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { API_BASE } from "./api-base";

// Клиент Better Auth. Ходит на отдельный API-поддомен с куками (credentials: include).
// adminClient — управление ролями/пользователями (listUsers, setRole, ban).
export const authClient = createAuthClient({
  baseURL: API_BASE,
  fetchOptions: { credentials: "include" },
  plugins: [adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
