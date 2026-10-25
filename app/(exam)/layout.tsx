import { requireUser } from "@/lib/server/auth";

/** Focus mode for tests: no app sidebar; each page brings its own exam header. */
export default async function ExamLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return <div className="flex min-h-screen flex-1 flex-col">{children}</div>;
}
