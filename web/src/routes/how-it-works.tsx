import { createFileRoute } from "@tanstack/react-router";
import { HowItWorksPage } from "@/components/marketing/pages";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/how-it-works")({
  head: () => pageHead("how-it-works", "en"),
  component: () => <HowItWorksPage locale="en" />,
});
