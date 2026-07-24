import { redirect } from "next/navigation";

// Root → canvas
export default function RootPage() {
  redirect("/canvas");
}
