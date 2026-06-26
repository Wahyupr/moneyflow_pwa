import { redirect } from "next/navigation";

// Chat tersedia sebagai floating widget di semua halaman
export default function ChatPage() {
  redirect("/dashboard");
}
