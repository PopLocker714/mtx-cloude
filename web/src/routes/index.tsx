import { createFileRoute, redirect } from "@tanstack/react-router";

// Корень пока ведёт в кабинет; гард внутри /_app сам отправит на /login, если не залогинен.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/cameras" });
  },
});
