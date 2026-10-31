import { redirect } from "next/navigation";

export default async function LoginRedirect({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(`/portal${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}
