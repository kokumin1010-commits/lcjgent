import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { clearLiverToken } from "@/lib/liverAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Home,
  ShoppingBag,
  Layers,
  Calendar,
  BarChart3,
  Bot,
  User,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

interface LiverLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { path: "/liver/mypage", label: "ホーム", labelCn: "首页", icon: Home },
  { path: "/liver/products", label: "商品選品", labelCn: "主播选品", icon: ShoppingBag },
  { path: "/liver/set-application", label: "セット管理", labelCn: "セット管理", icon: Layers },
  { path: "/liver/schedule", label: "配信スケジュール", labelCn: "配信排期", icon: Calendar },
  { path: "/liver/dashboard", label: "配信実績", labelCn: "配信実績", icon: BarChart3 },
  { path: "/liver/coach", label: "神コーチ AI", labelCn: "神コーチ AI", icon: Bot },
  { path: "/liver/record", label: "配信記録", labelCn: "配信记录", icon: FileText },
  { path: "/liver/profile", label: "プロフィール", labelCn: "个人资料", icon: User },
];

export default function LiverLayout({ children }: LiverLayoutProps) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const liverMeQuery = trpc.liver.me.useQuery(undefined, { retry: false });
  const liverInfo = liverMeQuery.data;

  const handleLogout = () => {
    clearLiverToken();
    navigate("/liver/login");
  };

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-200 ease-out lg:translate-x-0 lg:relative lg:z-auto flex-shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={liverInfo?.profileImage || ""} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm font-bold">
                  {liverInfo?.streamerName?.charAt(0) || "L"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {liverInfo?.streamerName || "ライバー"}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {liverInfo?.email || ""}
                </p>
              </div>
              <button
                className="lg:hidden p-1 rounded hover:bg-gray-100"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = location === item.path || location.startsWith(item.path + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-purple-50 text-purple-700 border border-purple-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-purple-600" : "text-gray-400"}`} />
                  <span>{item.label}</span>
                  {isActive && <ChevronRight className="h-4 w-4 ml-auto text-purple-400" />}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-all"
            >
              <LogOut className="h-5 w-5" />
              <span>ログアウト</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden lg:ml-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">L</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">LCJ Liver</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
