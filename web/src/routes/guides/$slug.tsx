import { createFileRoute, redirect } from "@tanstack/react-router";
import { GuidePage } from "@/components/marketing/guides";
import { guideBySlug, guideHead } from "@/lib/guides";

export const Route = createFileRoute("/guides/$slug")({
  // Незнакомый slug честно уводит на индекс инструкций, а не рисует пустую страницу.
  beforeLoad: ({ params }) => {
    if (!guideBySlug(params.slug)) throw redirect({ to: "/guides" });
  },
  head: ({ params }) => {
    const g = guideBySlug(params.slug);
    return g ? guideHead(g.slug, "en", g.en.metaTitle, g.en.metaDesc) : {};
  },
  component: SlugPage,
});

function SlugPage() {
  const { slug } = Route.useParams();
  const g = guideBySlug(slug)!;
  return <GuidePage guide={g} locale="en" />;
}
