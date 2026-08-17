import { createFileRoute } from "@tanstack/react-router";
import { HowItWorksPage } from "@/components/marketing/pages";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/ru/how-it-works")({
  head: () => pageHead("how-it-works", "ru"),
  component: () => <HowItWorksPage locale="ru" />,
});
