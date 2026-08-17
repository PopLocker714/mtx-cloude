import { createFileRoute } from "@tanstack/react-router";
import { GuidesIndexPage } from "@/components/marketing/guides";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/ru/guides/")({
  head: () => pageHead("guides", "ru"),
  component: () => <GuidesIndexPage locale="ru" />,
});
