"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ExpiryRedirect({ until, to }: { until: number; to: string }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(to), Math.max(0, until - Date.now()) + 500);
    return () => clearTimeout(t);
  }, [until, to, router]);
  return null;
}
