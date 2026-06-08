"use client";

import dynamic from "next/dynamic";

const FinanceApp = dynamic(() => import("@/App"), {
  ssr: false,
  loading: () => <div className="finance-loading">Loading setu finance...</div>,
});

export function FinancePortal() {
  return <FinanceApp />;
}
