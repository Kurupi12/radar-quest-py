import { redirect } from "next/navigation";

export default async function LegacyBrandAdminRedirect({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  redirect(`/b/${brand}/admin`);
}
