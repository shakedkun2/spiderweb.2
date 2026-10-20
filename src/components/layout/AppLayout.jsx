import React, { useState, useEffect, useMemo } from "react";
import { Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { LogOut } from "lucide-react";

// --- Redux Imports ---
import { logout } from "../../redux/slices/authSlice";
import { disconnect } from "../../redux/slices/realtimeSlice";

// --- Helper Components & Hooks ---
import { useDashboardLogic } from "../../pages/useDashboardLogic";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Sidebar } from "../ui/sidebar";

// --- Page Components ---
import { DashboardPage } from "../../pages/DashboardPage";
import { AdminPanelPage } from "../../pages/AdminPanelPage";
import { AlertsPage } from "../../pages/AlertsPage";

// --- Fullscreen Icon ---
export const FullscreenIcon = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9.75 9.75M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L14.25 9.75M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9.75 14.25m10.5 6.05v-4.5m0 4.5h-4.5m4.5 0L14.25 14.25"
    />
  </svg>
);

// --- Exit Fullscreen Icon ---
export const ExitFullscreenIcon = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25"
    />
  </svg>
);


// --- Main AppLayout Component ---
function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  );

  // --- Theme observer ---
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(
        document.documentElement.classList.contains("dark")
          ? "dark"
          : "light"
      );
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // --- Active page label ---
  const activePageLabel = useMemo(() => {
    const path = location.pathname;

    if (path.startsWith("/admin")) return "Admin Panel";
    if (path.startsWith("/notifications")) return "Notifications";

    return "Dashboard";
  }, [location.pathname]);

  // --- Document title update ---
  useEffect(() => {
    document.title = `Spiderweb | ${activePageLabel}`;
  }, [activePageLabel]);

  const isDashboardActive = activePageLabel === "Dashboard";

  // --- Dashboard logic ---
  const dashboardLogic = useDashboardLogic({
    isAppFullscreen: isFullscreen,
    isSidebarCollapsed,
  });

  const {
    activeTabValue,
    handleTabChangeForNavigation,
  } = dashboardLogic;

  // --- Fullscreen ---
  const toggleFullscreen = () => {
    if (!isDashboardActive) return;

    setIsFullscreen(!isFullscreen);
  };

  // --- Logout ---
  const handleLogout = () => {
    dispatch(disconnect());
    dispatch(logout());

    navigate("/login", {
      replace: true,
    });
  };

  // --- Fullscreen button ---
  const renderFullscreenToggleButton = () => {
    if (!isDashboardActive) return null;

    const ButtonIcon = isFullscreen
      ? ExitFullscreenIcon
      : FullscreenIcon;

    const buttonTitle = isFullscreen
      ? "Exit Fullscreen"
      : "Fullscreen";

    return (
      <button
        onClick={toggleFullscreen}
        title={buttonTitle}
        aria-label={buttonTitle}
        className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <ButtonIcon className="w-5 h-5" />
      </button>
    );
  };

  // --- Pages that have their own non-scrollable layout ---
  const isNonScrollablePage =
    location.pathname.startsWith("/all_interfaces") ||
    location.pathname.startsWith("/l-chart") ||
    location.pathname.startsWith("/p-chart");

  // --- Admin page ---
  const isAdminPage = location.pathname.startsWith("/admin");

  return (
    <div className="flex h-screen w-full bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-gray-100 transition-colors overflow-hidden">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}
      {!isFullscreen && (
        <Sidebar
          currentPage={activePageLabel}
          collapsed={isSidebarCollapsed}
          setCollapsed={setIsSidebarCollapsed}
        />
      )}

      {/* =====================================================
          MAIN APPLICATION
      ===================================================== */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col relative overflow-hidden">

        {/* ===================================================
            HEADER
        =================================================== */}
        <header
          className={`bg-white dark:bg-gray-800 shrink-0 flex items-center gap-4 ${isFullscreen
            ? "p-4 border-b dark:border-gray-700"
            : "p-4 shadow-sm"
            }`}
        >
          <h1
            className={`text-2xl shrink-0 ${isFullscreen
              ? "font-extrabold text-white tracking-wide"
              : "font-semibold text-gray-900 dark:text-white"
              }`}
          >
            {isFullscreen ? "SPIDERWEB" : activePageLabel}
          </h1>

          {/* Dashboard tabs */}
          {isDashboardActive && (
            <div className="flex-1 flex justify-center">
              <Tabs
                value={activeTabValue}
                onValueChange={handleTabChangeForNavigation}
                className="w-full md:w-[750px] lg:w-[800px]"
              >
                <TabsList className="grid-cols-4">
                  <TabsTrigger value="favorites">
                    Favorites
                  </TabsTrigger>

                  <TabsTrigger value="all_interfaces">
                    All Interfaces
                  </TabsTrigger>

                  <TabsTrigger value="l_network">
                    Libot
                  </TabsTrigger>

                  <TabsTrigger value="p_network">
                    Pikudim
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Right-side buttons */}
          <div className="flex items-center gap-4 ml-auto">
            {renderFullscreenToggleButton()}

            <button
              onClick={handleLogout}
              title="Log Out"
              aria-label="Log Out"
              className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 hover:bg-red-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/50 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ===================================================
            CONTENT CONTAINER
        =================================================== */}
        <div
          className={`flex-1 min-h-0 min-w-0 relative ${isAdminPage
            ? "overflow-hidden"
            : isNonScrollablePage
              ? "overflow-hidden flex flex-col"
              : "overflow-y-auto"
            } ${theme === "dark"
              ? "dark-scrollbar dark-scrollbar-firefox"
              : "light-scrollbar light-scrollbar-firefox"
            } ${!isFullscreen && !isAdminPage ? "p-4 md:p-6" : ""}`}
        >
          <Routes>

            {/* =================================================
                ADMIN
            ================================================= */}
            <Route
              path="/admin"
              element={<AdminPanelPage />}
            />

            {/* =================================================
                ALERTS
            ================================================= */}
            <Route
              path="/notifications"
              element={<AlertsPage />}
            />

            {/* Redirect unneeded pages */}
            <Route path="/search" element={<Navigate to="/" replace />} />
            <Route path="/help" element={<Navigate to="/" replace />} />

            {/* =================================================
                DASHBOARD
            ================================================= */}
            <Route
              path="/*"
              element={
                <DashboardPage
                  isAppFullscreen={isFullscreen}
                  activeTabValue={activeTabValue}
                  theme={theme}
                  popupAnchorCoords={
                    dashboardLogic.popupAnchorCoords
                  }
                  chartKeySuffix={
                    dashboardLogic.chartKeySuffix
                  }
                />
              }
            />

          </Routes>
        </div>
      </main>
    </div>
  );
}

export default AppLayout;