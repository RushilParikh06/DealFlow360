import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageClient } from "@/components/page-client";
import { loadLegacyPage } from "@/lib/legacy-pages";
import { resolvePage, staticRoutes } from "@/lib/routes";

type Props = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  return staticRoutes.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = resolvePage((await params).slug);
  return { title: page ? `${loadLegacyPage(page).title} | DealFlow360` : "DealFlow360" };
}

export default async function LegacyRoute({ params }: Props) {
  const page = resolvePage((await params).slug);
  if (!page) notFound();

  return <PageClient page={page} {...loadLegacyPage(page)} />;
}
