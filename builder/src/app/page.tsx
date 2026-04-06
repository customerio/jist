"use client";

import dynamic from "next/dynamic";

const Builder = dynamic(() => import("@/components/Builder").then((m) => m.Builder), {
  ssr: false,
  loading: () => (
    <div className="h-screen flex items-center justify-center bg-background text-muted">
      Loading Jist Builder...
    </div>
  ),
});

export default function Home() {
  return <Builder />;
}
