import React, { useMemo } from "react";
import { Link } from "react-router-dom";
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
import { IgnoreAlertsButton } from "../ui/ignore-alerts-button";
import {
  selectSidebarToasts,
  dismissToast,
} from "../../redux/slices/alertsSlice";

// Map labels to URL paths for clean routing
const navLinks = {
  Dashboard: "/",
  "Admin Panel": "/admin",
  Alerts: "/alerts",
  Notifications: "/alerts",
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

// Individual Toast Alert Component with Link redirect (stays until dismissed or clicked)
// Redesigned with inspiration from AlertsPage core AlertCard / AlertIcon design
function SidebarToastItem({ toast, collapsed, onDismiss }) {
  const typeConfig = {
    error: {
      borderAccent: "border-l-red-500",
      badgeBg: "bg-red-500 text-white",
      iconColor: "text-red-500",
      dotColor: "bg-red-500",
      title: "Error",
      Icon: MdErrorOutline,
    },
    warning: {
      borderAccent: "border-l-yellow-500",
      badgeBg: "bg-yellow-500 text-white",
      iconColor: "text-yellow-500 dark:text-yellow-400",
      dotColor: "bg-yellow-500",
      title: "Warning",
      Icon: MdWarningAmber,
    },
    info: {
      borderAccent: "border-l-blue-500",
      badgeBg: "bg-blue-500 text-white",
      iconColor: "text-blue-500",
      dotColor: "bg-blue-500",
      title: "Info",
      Icon: MdInfoOutline,
    },
  };

  const config = typeConfig[toast.type] || typeConfig.info;
  const { Icon } = config;
  const lineOrSource = toast.networkLine || toast.source;

  const formattedTime = toast.timestamp
    ? new Date(toast.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  if (collapsed) {
    return (
      <div
        className={`group relative flex items-center justify-center p-2 rounded-lg bg-white dark:bg-gray-800 border-l-4 ${config.borderAccent} border border-gray-200/90 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-0.5 transition-all duration-200`}
      >
        <Link
          to="/alerts"
          onClick={() => onDismiss(toast.id)}
          title={`${config.title}: ${toast.message}${
            lineOrSource ? ` (${lineOrSource})` : ""
          } - Click to view alerts`}
          className="flex items-center justify-center w-full py-1 no-underline"
        >
          <div className="relative flex items-center justify-center">
            <Icon className={`shrink-0 ${config.iconColor}`} size={20} />
            <span
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${config.dotColor} ring-2 ring-white dark:ring-gray-800`}
            />
          </div>
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss(toast.id);
          }}
          title="Dismiss alert"
          aria-label="Dismiss alert"
          className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 shadow-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <MdClose size={12} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`group relative rounded-lg bg-white dark:bg-gray-800 border-l-4 ${config.borderAccent} border border-gray-200/90 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden`}
    >
      <Link
        to="/alerts"
        onClick={() => onDismiss(toast.id)}
        title="Click to view alerts"
        className="block p-2.5 no-underline text-left"
      >
        {/* Top bar: Badge, Timestamp, and space for Close button */}
        <div className="flex items-center justify-between gap-1 mb-1.5 pr-6">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shadow-xs ${config.badgeBg}`}
            >
              {config.title}
            </span>
            {formattedTime && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate">
                {formattedTime}
              </span>
            )}
          </div>
        </div>

        {/* Message row with Icon matching AlertsPage AlertIcon */}
        <div className="flex items-start gap-2">
          <Icon className={`shrink-0 mt-0.5 ${config.iconColor}`} size={16} />
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {toast.message}
          </p>
        </div>

        {/* Footer metadata matching AlertsPage AlertCard */}
        {lineOrSource && (
          <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-700/60 text-[10px] text-gray-600 dark:text-gray-300 flex items-center justify-between gap-1">
            <span className="truncate">
              <strong className="text-gray-700 dark:text-gray-200 font-semibold">
                {toast.networkLine ? "Line:" : "Source:"}
              </strong>{" "}
              {lineOrSource}
            </span>
            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              View &rarr;
            </span>
          </div>
        )}
      </Link>

      {/* Dismiss Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        title="Dismiss alert"
        aria-label="Dismiss alert"
        className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition z-10"
      >
        <MdClose size={13} />
      </button>
    </div>
  );
}

// Main Sidebar component
export function Sidebar({ currentPage, collapsed, setCollapsed }) {
  const dispatch = useDispatch();
  const sidebarToasts = useSelector(selectSidebarToasts);

  const navItems = [
    { label: "Dashboard", icon: <MdDashboard size={20} /> },
    { label: "Admin Panel", icon: <MdAdminPanelSettings size={20} /> },
    { label: "Alerts", icon: <MdNotifications size={20} /> },
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
        return (b.timestampMs || b.createdAt || 0) - (a.timestampMs || a.createdAt || 0);
      })
      .slice(0, 3);
  }, [sidebarToasts]);

  const handleDismissToast = (id) => {
    dispatch(dismissToast(id));
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
            ((item.label === "Alerts" || item.label === "Notifications") &&
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

      {/* Bottom-left Toast Alerts Section */}
      {visibleToasts.length > 0 && (
        <div className="border-t dark:border-gray-800 shrink-0 flex flex-col max-h-72 overflow-hidden">
          {!collapsed && (
            <div className="flex items-center justify-between px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider shrink-0 select-none bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800/60">
              <span>Alerts</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                {visibleToasts.length}
              </span>
            </div>
          )}
          <div className="p-2 space-y-2 overflow-y-auto flex-1">
            {visibleToasts.map((toast) => (
              <SidebarToastItem
                key={toast.id}
                toast={toast}
                collapsed={collapsed}
                onDismiss={handleDismissToast}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="p-2 border-t dark:border-gray-700 shrink-0 flex flex-col gap-1">
        <IgnoreAlertsButton collapsed={collapsed} />
        <DarkModeToggle collapsed={collapsed} />
      </div>
    </div>
  );
}
