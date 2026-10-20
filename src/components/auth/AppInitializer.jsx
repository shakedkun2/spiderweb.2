import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createSelector } from "@reduxjs/toolkit";
import { fetchInitialData } from "../../redux/slices/authSlice";
import { startConnecting } from "../../redux/slices/realtimeSlice";
import { fetchAlerts } from "../../redux/slices/alertsSlice";
import { fetchAllCoreSitesTraffic } from "../../redux/slices/coreSiteTrafficSlice";
import { selectAllPikudim } from "../../redux/slices/corePikudimSlice";
import { Loader2, AlertTriangle } from "lucide-react";

// Memoized selector to prevent unnecessary re-renders
const selectPikudimStatus = (state) => state.corePikudim.status;
const selectDevicesStatus = (state) => state.devices.status;
const selectLinksStatus = (state) => state.tenGigLinks.status;
const selectSitesStatus = (state) => state.sites.status;

const selectCoreDataStatus = createSelector(
  [
    selectPikudimStatus,
    selectDevicesStatus,
    selectLinksStatus,
    selectSitesStatus,
  ],
  (pikudim, devices, links, sites) => ({
    pikudim,
    devices,
    links,
    sites,
  })
);

export function AppInitializer({ children }) {
  const dispatch = useDispatch();
  const dataStatus = useSelector(selectCoreDataStatus);
  const allCoreSites = useSelector(selectAllPikudim);

  // Derived state to determine the overall status
  const isIdle = Object.values(dataStatus).every((s) => s === "idle");
  const isSuccessful = Object.values(dataStatus).every(
    (s) => s === "succeeded"
  );
  const isLoading = Object.values(dataStatus).some((s) => s === "loading");
  const hasFailed = Object.values(dataStatus).some((s) => s === "failed");

  // Effect for fetching initial data and starting real-time connection
  useEffect(() => {
    if (isIdle) {
      dispatch(fetchInitialData());
    }

    if (isSuccessful) {
      dispatch(startConnecting());
    }
  }, [isIdle, isSuccessful, dispatch]);

  // --- Effect for immediate and periodic alert and core site traffic polling ---
  useEffect(() => {
    let alertsIntervalId;
    let trafficIntervalId;

    // Start polling only when the core application data has successfully loaded.
    if (isSuccessful) {
      // Fetch alerts immediately on initial load
      dispatch(fetchAlerts());

      // Fetch traffic for all core sites immediately on load
      const siteIds = allCoreSites && allCoreSites.length > 0
        ? allCoreSites.map((s) => s.id)
        : Array.from({ length: 11 }, (_, i) => i + 1);

      dispatch(fetchAllCoreSitesTraffic(siteIds));

      // Alerts polling every 5 seconds
      alertsIntervalId = setInterval(() => {
        dispatch(fetchAlerts({ silent: true }));
      }, 5000);

      // Core site traffic polling every 15 seconds
      trafficIntervalId = setInterval(() => {
        const currentIds = allCoreSites && allCoreSites.length > 0
          ? allCoreSites.map((s) => s.id)
          : Array.from({ length: 11 }, (_, i) => i + 1);
        dispatch(fetchAllCoreSitesTraffic(currentIds));
      }, 15000);
    }

    return () => {
      if (alertsIntervalId) clearInterval(alertsIntervalId);
      if (trafficIntervalId) clearInterval(trafficIntervalId);
    };
  }, [isSuccessful, allCoreSites, dispatch]);

  const handleRetry = () => {
    dispatch(fetchInitialData());
  };

  // --- RENDERING LOGIC ---

  // Display a loading screen while fetching initial data
  if (isLoading || isIdle) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4 text-center p-4">
          <Loader2 className="h-16 w-16 animate-spin text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-4">
            Initializing Spiderweb
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Fetching network topology and status...
          </p>
        </div>
      </div>
    );
  }

  // Display an error screen if any of the initial fetches fail
  if (hasFailed) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4 text-center p-4">
          <AlertTriangle className="h-16 w-16 text-red-500" />
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-4">
            Failed to Load Application Data
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-md">
            An error occurred while fetching critical network information.
            Please check your connection and try again.
          </p>
          <button
            onClick={handleRetry}
            className="mt-6 px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Once everything is loaded, render the main application
  return children;
}
