import { headers } from "next/headers";
import { DashboardLayoutClient } from "./dashboard-layout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <DashboardLayoutClient nonce={nonce}>{children}</DashboardLayoutClient>
  );
}
