import { createFileRoute } from "@tanstack/react-router";
import { FaqPage } from "@/components/marketing/pages";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/faq")({
  head: () => pageHead("faq", "en"),
  component: () => <FaqPage locale="en" />,
});
