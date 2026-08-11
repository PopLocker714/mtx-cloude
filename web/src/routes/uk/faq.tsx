import { createFileRoute } from "@tanstack/react-router";
import { FaqPage } from "@/components/marketing/pages";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/uk/faq")({
  head: () => pageHead("faq", "uk"),
  component: () => <FaqPage locale="uk" />,
});
