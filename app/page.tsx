// =====================================================
// HOME PAGE - Página inicial (redirect para login)
// =====================================================

import { redirect } from "next/navigation"

export default function HomePage() {
  redirect("/login")
}
