import { createFileRoute } from "@tanstack/react-router";
import { FaqPage } from "@/components/marketing/pages";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/ru/faq")({
  head: () => pageHead("faq", "ru"),
  component: () => <FaqPage locale="ru" />,
});
