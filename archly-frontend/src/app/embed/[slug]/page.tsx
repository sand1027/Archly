import type { Metadata } from "next";
import ShareViewer from "@/components/share/ShareViewer";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Archly Embed",
};

export default async function EmbedPage({ params }: Props) {
  const { slug } = await params;
  return <ShareViewer slug={slug} embed />;
}
