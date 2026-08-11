import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/components/marketing/pages";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () => pageHead("contact", "en"),
  component: () => <ContactPage locale="en" />,
});
