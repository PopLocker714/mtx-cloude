import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/components/marketing/pages";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/ru/contact")({
  head: () => pageHead("contact", "ru"),
  component: () => <ContactPage locale="ru" />,
});
