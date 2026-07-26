import type { Metadata } from "next";
import ShareViewer from "@/components/share/ShareViewer";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Shared Design — Archly`,
    description: `View this system design shared via Archly (${slug})`,
    openGraph: {
      title: "Shared Archly design",
      description: "Read-only architecture diagram shared with Archly",
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { slug } = await params;
  return <ShareViewer slug={slug} />;
}
