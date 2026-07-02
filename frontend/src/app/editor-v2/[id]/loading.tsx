import { Loader2 } from "lucide-react";

export default function LoadingEditorV2() {
  return (
    <div className="grid h-screen place-items-center bg-pd-app text-pd-text">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-pd-accent" />
        <p className="mt-3 text-sm text-pd-text-secondary">Preparing AI-native editor...</p>
      </div>
    </div>
  );
}

