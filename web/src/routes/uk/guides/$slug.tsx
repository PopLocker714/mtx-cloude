import { createFileRoute, redirect } from "@tanstack/react-router";
import { GuidePage } from "@/components/marketing/guides";
import { guideBySlug, guideHead } from "@/lib/guides";

export const Route = createFileRoute("/uk/guides/$slug")({
  beforeLoad: ({ params }) => {
    if (!guideBySlug(params.slug)) throw redirect({ to: "/uk/guides" });
  },
  head: ({ params }) => {
    const g = guideBySlug(params.slug);
    return g ? guideHead(g.slug, "uk", g.uk.metaTitle, g.uk.metaDesc) : {};
  },
  component: SlugPage,
});

function SlugPage() {
  const { slug } = Route.useParams();
  const g = guideBySlug(slug)!;
  return <GuidePage guide={g} locale="uk" />;
}
