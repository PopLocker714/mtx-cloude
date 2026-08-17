import { createFileRoute } from "@tanstack/react-router";
import { GuidesIndexPage } from "@/components/marketing/guides";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/guides/")({
  head: () => pageHead("guides", "en"),
  component: () => <GuidesIndexPage locale="en" />,
});
