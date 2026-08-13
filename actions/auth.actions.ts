"use server";

import { signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect("/admin/login");
}