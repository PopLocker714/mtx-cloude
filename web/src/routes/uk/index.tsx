import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/marketing/pages";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/uk/")({
  head: () => pageHead("", "uk"),
  component: () => <HomePage locale="uk" />,
});
