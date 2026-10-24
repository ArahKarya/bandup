import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { Logo } from "@/components/logo";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await currentUser()) redirect("/dashboard");
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="rounded border border-border bg-surface p-6">{children}</div>
      </div>
    </main>
  );
}
