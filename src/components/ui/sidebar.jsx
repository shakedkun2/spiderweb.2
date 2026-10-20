import React, { useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  MdDashboard,
  MdAdminPanelSettings,
  MdNotifications,
  MdChevronLeft,
  MdChevronRight,
  MdErrorOutline,
  MdWarningAmber,
  MdInfoOutline,
  MdClose,
} from "react-icons/md";
import { DarkModeToggle } from "../ui/dark-mode-toggle";
import {
  selectSidebarToasts,
  dismissToast,
} from "../../redux/slices/alertsSlice";

// Map labels to URL paths for clean routing
const navLinks = {
  Dashboard: "/",
  "Admin Panel": "/admin",
  Notifications: "/notifications",
};

// NavItem component
function NavItem({ label, icon, collapsed, active }) {
  return (
    <Link
      to={navLinks[label] || "/"}
      className={`flex items-center gap-3 text-sm px-3 py-2 rounded-md w-full transition
    ${
      active
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-white font-semibold"
        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
    }`}
    >
      <span className="text-xl">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

// Individual Toast Notification Component with auto-dismiss
function SidebarToastItem({ toast, collapsed, onDismiss, onNavigate }) {
  useEffect(() => {
    // Auto dismiss after 8 seconds
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 8000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const typeConfig = {
    error: {
      bg: "bg-red-50 dark:bg-red-950/70 border-red-300 dark:border-red-800",
      text: "text-red-900 dark:text-red-100",
      title: "Error",
      badge: "bg-red-600 text-white",
      Icon: MdErrorOutline,
      iconColor: "text-red-500",
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800",
      text: "text-amber-900 dark:text-amber-100",
      title: "Warning",
      badge: "bg-amber-500 text-white",
      Icon: MdWarningAmber,
      iconColor: "text-amber-500",
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-950/70 border-blue-300 dark:border-blue-800",
      text: "text-blue-900 dark:text-blue-100",
      title: "Info",
      badge: "bg-blue-600 text-white",
      Icon: MdInfoOutline,
      iconColor: "text-blue-500",
    },
  };

  const config = typeConfig[toast.type] || typeConfig.info;
  const { Icon } = config;

  return (
    <div
      onClick={onNavigate}
      title={`${config.title}: ${toast.message} - Click to view alerts`}
      className={`group relative flex items-start gap-2 p-2.5 rounded-lg border shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] ${config.bg} ${config.text}`}
    >
      <Icon className={`shrink-0 mt-0.5 ${config.iconColor}`} size={18} />

      {!collapsed ? (
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded leading-none ${config.badge}`}
            >
              {config.title}
            </span>
            {toast.timestamp && (
              <span className="text-[10px] opacity-60 truncate">
                {new Date(toast.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
          <p className="text-xs font-medium leading-snug line-clamp-2">
            {toast.message}
          </p>
          {toast.networkLine && (
            <p className="text-[10px] opacity-75 truncate mt-0.5">
              {toast.networkLine}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full py-0.5">
          <span className="sr-only">{config.title}</span>
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        title="Dismiss alert"
        aria-label="Dismiss alert"
        className="absolute top-1.5 right-1.5 p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition"
      >
        <MdClose size={14} />
      </button>
    </div>
  );
}

// Main Sidebar component
export function Sidebar({ currentPage, collapsed, setCollapsed }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const sidebarToasts = useSelector(selectSidebarToasts);

  const navItems = [
    { label: "Dashboard", icon: <MdDashboard size={20} /> },
    { label: "Admin Panel", icon: <MdAdminPanelSettings size={20} /> },
    { label: "Notifications", icon: <MdNotifications size={20} /> },
  ];

  // Filter and prioritize toasts:
  // Preference: Errors (1) > Warnings (2) > Info (3), newest first, max 3
  const visibleToasts = useMemo(() => {
    if (!Array.isArray(sidebarToasts)) return [];
    const typePriority = { error: 1, warning: 2, info: 3 };

    return [...sidebarToasts]
      .sort((a, b) => {
        const pA = typePriority[a.type] || 4;
        const pB = typePriority[b.type] || 4;
        if (pA !== pB) return pA - pB;
        return (b.createdAt || 0) - (a.createdAt || 0);
      })
      .slice(0, 3);
  }, [sidebarToasts]);

  const handleDismissToast = (id) => {
    dispatch(dismissToast(id));
  };

  const handleNavigateToAlerts = () => {
    navigate("/notifications");
  };

  return (
    <div
      className={`h-screen ${
        collapsed ? "w-16" : "w-60"
      } bg-white dark:bg-gray-900 border-r dark:border-gray-700 shadow-sm flex flex-col transition-all duration-300`}
    >
      {/* Header section */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 shrink-0">
        {!collapsed && (
          <h1 className="text-2xl font-extrabold text-white tracking-wide">
            SPIDERWEB
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          {collapsed ? (
            <MdChevronRight size={24} />
          ) : (
            <MdChevronLeft size={24} />
          )}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col space-y-1 p-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            currentPage === item.label ||
            (item.label === "Notifications" &&
              (currentPage === "Alerts" || currentPage === "Notifications"));

          return (
            <NavItem
              key={item.label}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              active={isActive}
            />
          );
        })}
      </nav>

      {/* Bottom-left Toast Notifications Section */}
      {visibleToasts.length > 0 && (
        <div className="p-2 border-t dark:border-gray-800 space-y-2 shrink-0 max-h-64 overflow-y-auto">
          {visibleToasts.map((toast) => (
            <SidebarToastItem
              key={toast.id}
              toast={toast}
              collapsed={collapsed}
              onDismiss={handleDismissToast}
              onNavigate={handleNavigateToAlerts}
            />
          ))}
        </div>
      )}

      {/* Footer Navigation */}
      <div className="p-2 border-t dark:border-gray-700 shrink-0">
        <DarkModeToggle collapsed={collapsed} />
      </div>
    </div>
  );
}
