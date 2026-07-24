import { redirect } from "next/navigation";

/**
 * /plus is no longer needed — everything is free.
 * Redirect anyone who lands here to the canvas.
 */
export default function PlusPage() {
  redirect("/canvas");
}
