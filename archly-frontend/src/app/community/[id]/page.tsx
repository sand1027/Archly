import type { Metadata } from "next";
import CommunityDesignDetail from "./CommunityDesignDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Design ${id} — Archly Community`,
  };
}

/**
 * Published design detail — open on canvas or fork a private copy.
 */
export default async function CommunityDesignPage({ params }: Props) {
  const { id } = await params;
  return <CommunityDesignDetail id={id} />;
}
