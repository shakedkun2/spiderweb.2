import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * A custom hook to manage the shared logic for the main dashboard UI,
 * including tab navigation and state synchronization with the URL.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isAppFullscreen - Whether the entire app is in fullscreen mode.
 * @param {boolean} props.isSidebarCollapsed - Whether the main sidebar is collapsed.
 * @returns {object} - An object containing state and handlers for the dashboard.
 */
export function useDashboardLogic({ isAppFullscreen, isSidebarCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Determines the active tab value based on the current URL path.
   * This is used to initialize the state and to synchronize the UI
   * when the user navigates using browser back/forward buttons.
   * @param {string} path - The current location.pathname.
   * @returns {string} The corresponding tab value.
   */
  const getTabValueFromPath = (path) => {
    if (path.startsWith("/Libot") || path.startsWith("/libot") || path.startsWith("/l-chart")) return "l_network";
    if (path.startsWith("/Pikudim") || path.startsWith("/pikudim") || path.startsWith("/p-chart")) return "p_network";
    if (path.startsWith("/all_interfaces")) return "all_interfaces";
    if (path.startsWith("/favorites")) return "favorites";
    return "favorites"; // Default to 'favorites' if no match is found
  };

  // State to keep track of the currently active tab.
  // It's initialized based on the current URL path.
  const [activeTabValue, setActiveTabValue] = useState(
    getTabValueFromPath(location.pathname)
  );

  // This effect listens for changes in the URL (e.g., from browser navigation)
  // and updates the active tab state to keep the UI in sync.
  useEffect(() => {
    const newTabValue = getTabValueFromPath(location.pathname);
    if (newTabValue !== activeTabValue) {
      setActiveTabValue(newTabValue);
    }
  }, [location.pathname, activeTabValue]);

  /**
   * Handles the click event on a tab. It determines the correct URL path
   * for the clicked tab's value and navigates to it.
   * @param {string} value - The value of the clicked shadcn/ui TabsTrigger.
   */
  const handleTabChangeForNavigation = (value) => {
    let path;
    switch (value) {
      case "l_network":
        path = "/Libot";
        break;
      case "p_network":
        path = "/Pikudim";
        break;
      case "all_interfaces":
        path = "/all_interfaces"; // Correctly maps to the all_interfaces path
        break;
      case "favorites":
      default:
        path = "/favorites";
        break;
    }
    // Navigate to the new path if it's different from the current one
    if (path !== location.pathname) {
      navigate(path);
    }
  };

  // This memoized value creates a unique key suffix for the visualizer components.
  // This is useful for forcing a re-mount and re-render of the D3 charts
  // when certain UI states change (like entering fullscreen or collapsing the sidebar),
  // which might affect their container dimensions.
  const chartKeySuffix = useMemo(() => {
    return `${isAppFullscreen}-${isSidebarCollapsed}`;
  }, [isAppFullscreen, isSidebarCollapsed]);

  // The hook returns all the state and handlers that the DashboardPage component needs.
  return {
    theme: document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
    activeTabValue,
    handleTabChangeForNavigation,
    chartKeySuffix,
    // Note: popupAnchorCoords was in the original code but seems unused.
    // I'm keeping it here in case it's used by code not provided.
    popupAnchorCoords: null,
  };
}
