import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { CameraView } from "@/components/camera-view";
import { CameraSettings } from "@/components/camera-settings";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/camera/$cameraId")({ component: CameraDetail });

function CameraDetail() {
  const [locale] = useAppLocale();
  const { cameraId } = Route.useParams();
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/cameras">
          <ArrowLeft className="size-4" /> {m.cv_back({}, { locale })}
        </Link>
      </Button>
      <CameraView cameraId={cameraId} />
      <CameraSettings cameraId={cameraId} />
    </div>
  );
}
