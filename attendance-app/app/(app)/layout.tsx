import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import NavBar, { MobileNav } from "@/components/NavBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <NavBar />
      <main className="flex-1 md:ml-56 pb-16 md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
