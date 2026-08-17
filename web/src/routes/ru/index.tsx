import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/marketing/pages";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/ru/")({
  head: () => pageHead("", "ru"),
  component: () => <HomePage locale="ru" />,
});
