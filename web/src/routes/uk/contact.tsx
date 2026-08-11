import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/components/marketing/pages";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/uk/contact")({
  head: () => pageHead("contact", "uk"),
  component: () => <ContactPage locale="uk" />,
});
