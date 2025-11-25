// =====================================================
// SIDEBAR - Menu lateral do dashboard
// =====================================================

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  ShoppingCart,
  FileText,
  Settings,
  Webhook,
  Smartphone,
  LogOut,
} from "lucide-react"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/flows", label: "Fluxos", icon: MessageSquare },
  { href: "/dashboard/customers", label: "Clientes", icon: Users },
  { href: "/dashboard/orders", label: "Pedidos", icon: ShoppingCart },
  { href: "/dashboard/logs", label: "Logs", icon: FileText },
  { href: "/dashboard/events", label: "Eventos", icon: Webhook },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: Smartphone },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <MessageSquare className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">SaaS Bot</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 truncate">
            <p className="text-sm font-medium truncate">{user?.name || "Usuário"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  )
}
