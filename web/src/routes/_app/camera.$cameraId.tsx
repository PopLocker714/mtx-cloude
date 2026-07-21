import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CameraView } from "@/components/camera-view";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/camera/$cameraId")({ component: CameraDetail });

function CameraDetail() {
  const { cameraId } = Route.useParams();
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/cameras">
          <ArrowLeft className="size-4" /> К списку камер
        </Link>
      </Button>
      <CameraView cameraId={cameraId} />
    </div>
  );
}
