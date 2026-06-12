import { OfflineIcon } from "./icons";

export const OfflineBanner = () => (
  <div
    className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-1.5 bg-warning text-[11px] font-bold text-black"
    style={{ paddingTop: "calc(0.375rem + env(safe-area-inset-top))" }}
  >
    <OfflineIcon className="w-3.5 h-3.5 shrink-0" />
    No connection — browsing cached content
  </div>
);
