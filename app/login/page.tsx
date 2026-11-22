import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { site } from "@/config/site";
import { isAdmin } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/");
  return <LoginForm name={site.familyName} />;
}
