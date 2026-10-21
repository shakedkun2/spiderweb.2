import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  MdErrorOutline,
  MdWarningAmber,
  MdInfoOutline,
  MdNotifications,
  MdClose,
  MdSearch,
  MdFilterListOff,
  MdAutorenew,
  MdRefresh,
} from "react-icons/md";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAlerts,
  selectAllAlerts,
  selectAlertsStatus,
  selectSelectedPeriod,
  setSelectedPeriod,
} from "../redux/slices/alertsSlice";
import { selectTopologyDevices } from "../redux/slices/coreTopologySlice";
import { selectAllDevices } from "../redux/slices/devicesSlice";
import { getLinkNavigationTarget } from "../components/chart/linkNavigationHelpers";

// --- HELPER COMPONENTS ---

const AlertIcon = ({ type, size = 24 }) => {
  if (type === "error")
    return (
      <MdErrorOutline className="text-red-500 flex-shrink-0" size={size} />
    );
  if (type === "warning")
    return (
      <MdWarningAmber className="text-yellow-500 flex-shrink-0" size={size} />
    );
  return <MdInfoOutline className="text-blue-500 flex-shrink-0" size={size} />;
};

const AlertModal = ({ alert, onClose, topologyDevices, allDevices }) => {
  const navigate = useNavigate();

  if (!alert) return null;

  const handleSeeLine = () => {
    const navTarget =
      getLinkNavigationTarget(alert.link, topologyDevices, allDevices) ||
      alert.navigationTarget;

    if (navTarget && navTarget.path) {
      const state = {
        ...navTarget.state,
        openInspectPopup: true,
        inspectLinkId:
          alert.link?.id ||
          alert.link?.link_id ||
          navTarget.state?.inspectLinkId,
        selectedLink: alert.link || navTarget.state?.selectedLink,
      };
      navigate(navTarget.path, { state });
      onClose();
    } else {
      // Default to /Libot if target can't be resolved
      navigate("/Libot");
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto relative select-text"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Close modal"
        >
          <MdClose size={24} />
        </button>
        <div className="flex items-start space-x-3 mb-4">
          <AlertIcon type={alert.type} size={32} />
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Alert Details
            </h2>
            <p
              className={`text-sm font-medium ${
                alert.type === "error"
                  ? "text-red-600 dark:text-red-400"
                  : alert.type === "warning"
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-blue-600 dark:text-blue-400"
              }`}
            >
              Type: {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}
            </p>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <p>
            <strong className="text-gray-700 dark:text-gray-300">
              Message:
            </strong>
            <span className="text-gray-600 dark:text-gray-400 ml-1">
              {alert.message}
            </span>
          </p>
          <p>
            <strong className="text-gray-700 dark:text-gray-300">
              Timestamp:
            </strong>
            <span className="text-gray-600 dark:text-gray-400 ml-1">
              {new Date(alert.timestamp).toLocaleString()}
            </span>
          </p>
          <div className="pt-2">
            <strong className="text-gray-700 dark:text-gray-300 block mb-1">
              Details:
            </strong>
            <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-md text-xs leading-relaxed">
              {alert.details}
            </p>
          </div>
          {alert.history && alert.history.length > 1 && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60 mt-3">
              <strong className="text-gray-700 dark:text-gray-300 block mb-2 text-xs uppercase tracking-wider">
                Event History for this Line:
              </strong>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {alert.history.map((h, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs p-2 rounded bg-gray-50 dark:bg-gray-700/60"
                  >
                    <span
                      className={`font-semibold ${
                        h.eventType === "link_down" || h.eventType === "ospf_drop"
                          ? "text-red-600 dark:text-red-400"
                          : "text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {h.title || h.eventType}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                      {new Date(h.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSeeLine}
            className="px-4 py-2 bg-blue-600 text-white font-semibold text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors flex items-center gap-2"
          >
            <span>See Line</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const AlertCard = ({ alert, onClick }) => {
  return (
    <div
      onClick={(e) => {
        if (
          window.getSelection &&
          window.getSelection().toString().trim().length > 0
        )
          return;
        onClick(e);
      }}
      className="relative bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-transparent dark:hover:border-blue-500 hover:border-blue-400 flex flex-col h-full"
    >
      <div className="flex items-start space-x-4 flex-grow">
        <AlertIcon type={alert.type} size={28} />
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-gray-800 dark:text-white truncate"
            title={alert.message}
          >
            {alert.message}
          </p>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs space-y-1">
            <p className="text-gray-600 dark:text-gray-300">
              <strong>Network Line:</strong> {alert.networkLine}
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              {new Date(alert.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const timePeriods = [
  { label: "24 Hours", value: "24h" },
  { label: "1 Week", value: "1w" },
  { label: "2 Weeks", value: "2w" },
  { label: "1 Month", value: "1m" },
];

const alertTypes = [
  { value: "error", label: "Errors", color: "red" },
  { value: "warning", label: "Warnings", color: "yellow" },
  { value: "info", label: "Info", color: "blue" },
];

const initialTypeState = { error: true, warning: true, info: true };

const TypeFilterButton = ({ typeInfo, count, isActive, onClick }) => {
  const colors = {
    red: {
      active: "bg-red-500 text-white shadow-md",
      inactive:
        "bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
    },
    yellow: {
      active: "bg-yellow-500 text-white shadow-md",
      inactive:
        "bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
    },
    blue: {
      active: "bg-blue-500 text-white shadow-md",
      inactive:
        "bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
    },
  };
  const countColors = {
    red: { active: "bg-white/20", inactive: "bg-black/10 dark:bg-white/10" },
    yellow: { active: "bg-white/20", inactive: "bg-black/10 dark:bg-white/10" },
    blue: { active: "bg-white/20", inactive: "bg-black/10 dark:bg-white/10" },
  };
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-center px-4 py-2 text-sm font-semibold transition-all duration-200 ease-in-out flex items-center justify-center gap-2 ${
        isActive
          ? colors[typeInfo.color].active
          : colors[typeInfo.color].inactive
      }`}
    >
      <span>{typeInfo.label}</span>
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-mono transition-colors duration-200 ${
          isActive
            ? countColors[typeInfo.color].active
            : countColors[typeInfo.color].inactive
        }`}
      >
        {count}
      </span>
    </button>
  );
};

export function AlertsPage() {
  const dispatch = useDispatch();
  const allAlerts = useSelector(selectAllAlerts);
  const status = useSelector(selectAlertsStatus);
  const reduxSelectedPeriod = useSelector(selectSelectedPeriod);
  const topologyDevices = useSelector(selectTopologyDevices);
  const allDevices = useSelector(selectAllDevices);

  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPeriodLocal, setSelectedPeriodLocal] = useState(
    reduxSelectedPeriod || "24h"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(initialTypeState);
  const parentRef = useRef(null);
  const [columnCount, setColumnCount] = useState(3);

  // Sync redux period with local state
  useEffect(() => {
    if (reduxSelectedPeriod && reduxSelectedPeriod !== selectedPeriodLocal) {
      setSelectedPeriodLocal(reduxSelectedPeriod);
    }
  }, [reduxSelectedPeriod]);

  // Initial fetch if needed
  useEffect(() => {
    if (status === "idle") {
      dispatch(fetchAlerts({ period: selectedPeriodLocal }));
    }
  }, [status, selectedPeriodLocal, dispatch]);

  useEffect(() => {
    const updateColumnCount = () => {
      if (window.innerWidth >= 1024) setColumnCount(3);
      else if (window.innerWidth >= 768) setColumnCount(2);
      else setColumnCount(1);
    };
    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);

  // Update selected alert when the list updates
  useEffect(() => {
    if (selectedAlert) {
      const updatedAlert = allAlerts.find((a) => a.id === selectedAlert.id);
      if (updatedAlert) {
        if (updatedAlert !== selectedAlert) {
          setSelectedAlert(updatedAlert);
        }
      } else {
        setIsModalOpen(false);
        setSelectedAlert(null);
      }
    }
  }, [allAlerts, selectedAlert]);

  // Step 1: Sort alerts newest first
  const sortedAlerts = useMemo(() => {
    if (!Array.isArray(allAlerts)) return [];
    return [...allAlerts].sort(
      (a, b) =>
        (b.timestampMs || new Date(b.timestamp).getTime() || 0) -
        (a.timestampMs || new Date(a.timestamp).getTime() || 0)
    );
  }, [allAlerts]);

  // Step 2: Time filter window
  const timeFilteredAlerts = useMemo(() => {
    const now = Date.now();
    const periodHoursMap = {
      "24h": 24,
      "1w": 7 * 24,
      "2w": 14 * 24,
      "1m": 30 * 24,
    };
    const hours = periodHoursMap[selectedPeriodLocal] || 24;
    const cutoff = now - hours * 60 * 60 * 1000;

    return sortedAlerts.filter((a) => {
      const t = a.timestampMs || new Date(a.timestamp).getTime() || 0;
      return t >= cutoff;
    });
  }, [sortedAlerts, selectedPeriodLocal]);

  // Count by alert type
  const alertCountsByType = useMemo(() => {
    return timeFilteredAlerts.reduce(
      (acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      },
      { error: 0, warning: 0, info: 0 }
    );
  }, [timeFilteredAlerts]);

  // Step 3: Word-tokenized search matching device names, lines, interfaces, and IPs
  const filteredAlerts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const queryWords = query ? query.split(/\s+/).filter(Boolean) : [];

    return timeFilteredAlerts.filter((alert) => {
      if (!selectedTypes[alert.type]) return false;

      if (queryWords.length > 0) {
        const link = alert.link || {};
        const searchableFields = [
          alert.message,
          alert.networkLine,
          alert.source,
          alert.details,
          alert.eventType,
          alert.type,
          alert.id,
          link.id,
          link.link_id,
          link.sourceName,
          link.targetName,
          typeof link.source === "string" ? link.source : (link.source?.name || link.source?.id),
          typeof link.target === "string" ? link.target : (link.target?.name || link.target?.id),
          link.local_interface,
          link.remote_interface,
          link.interface,
          link.sourceZone,
          link.targetZone,
          link.description,
          link.local_interface_description,
          link.local_link_ip,
          link.remote_link_ip,
          link.local_ip,
          link.remote_ip,
          link.local_device_ip,
          link.remote_device_ip,
          link.destinationIp,
        ];

        const searchableText = searchableFields
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesAllWords = queryWords.every((word) =>
          searchableText.includes(word)
        );

        if (!matchesAllWords) return false;
      }

      return true;
    });
  }, [timeFilteredAlerts, searchTerm, selectedTypes]);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredAlerts.length / columnCount),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 5,
  });

  const handleTypeChange = (type) =>
    setSelectedTypes((prev) => ({ ...prev, [type]: !prev[type] }));

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedTypes(initialTypeState);
  };

  const handleAlertClick = (alert) => {
    setSelectedAlert(alert);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAlert(null);
  };

  const handlePeriodChange = (newPeriod) => {
    setSelectedPeriodLocal(newPeriod);
    dispatch(setSelectedPeriod(newPeriod));
    dispatch(fetchAlerts({ period: newPeriod, silent: false }));
  };

  const handleRefresh = () => {
    dispatch(fetchAlerts({ period: selectedPeriodLocal, silent: false }));
  };

  const renderContent = () => {
    if (status === "loading" && allAlerts.length === 0) {
      return (
        <div className="flex-grow flex items-center justify-center text-center px-4">
          <div>
            <MdAutorenew
              size={56}
              className="mx-auto text-blue-500 animate-spin mb-4"
            />
            <p className="text-xl font-semibold text-gray-600 dark:text-gray-400">
              Loading Alerts...
            </p>
          </div>
        </div>
      );
    }
    if (filteredAlerts.length === 0) {
      return (
        <div className="flex-grow flex items-center justify-center text-center px-4">
          <div>
            <MdNotifications
              size={56}
              className="mx-auto text-gray-400 dark:text-gray-500 mb-4"
            />
            <p className="text-xl font-semibold text-gray-600 dark:text-gray-400">
              No Matching Alerts
            </p>
            <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
              Try adjusting your time or type filters.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div ref={parentRef} className="w-full h-full overflow-y-auto pr-2">
        <div
          key={columnCount}
          className="relative w-full"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const cardsInRow = [];
            const startIndex = virtualRow.index * columnCount;
            const endIndex = Math.min(
              startIndex + columnCount,
              filteredAlerts.length
            );
            for (let i = startIndex; i < endIndex; i++) {
              const alert = filteredAlerts[i];
              cardsInRow.push(
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onClick={() => handleAlertClick(alert)}
                />
              );
            }
            return (
              <div
                key={virtualRow.key}
                className="absolute top-0 left-0 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-1"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {cardsInRow}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="p-6 bg-gray-50 dark:bg-gray-900 h-full flex flex-col">
        <header className="mb-6 flex-shrink-0">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            System Alerts
          </h1>
          <p className="text-md text-gray-600 dark:text-gray-400 mt-1">
            Review and filter real-time alerts from the network infrastructure.
          </p>
        </header>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 mb-8 flex-shrink-0">
          <div className="mb-4">
            <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 block">
              Time Period
            </label>
            <div className="flex flex-wrap gap-2">
              {timePeriods.map((period) => (
                <button
                  key={period.value}
                  onClick={() => handlePeriodChange(period.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 ${
                    selectedPeriodLocal === period.value
                      ? "bg-blue-600 text-white shadow"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pt-2">
            <div className="flex-shrink-0">
              <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 block mb-2">
                Type
              </label>
              <div className="flex w-full sm:w-auto rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                {alertTypes.map((typeInfo) => (
                  <TypeFilterButton
                    key={typeInfo.value}
                    typeInfo={typeInfo}
                    count={alertCountsByType[typeInfo.value] || 0}
                    isActive={selectedTypes[typeInfo.value]}
                    onClick={() => handleTypeChange(typeInfo.value)}
                  />
                ))}
              </div>
            </div>
            <div className="flex-grow"></div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative">
                <MdSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  id="search"
                  type="text"
                  placeholder="Search message, device, line..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 p-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={status === "loading"}
                title="Refresh Alerts"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MdRefresh
                  className={status === "loading" ? "animate-spin" : ""}
                />
                <span>
                  {status === "loading" ? "Refreshing..." : "Refresh"}
                </span>
              </button>
              <button
                onClick={handleResetFilters}
                title="Reset filters"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <MdFilterListOff />
              </button>
            </div>
          </div>
        </div>
        <div className="flex-grow min-h-0">{renderContent()}</div>
      </div>
      {isModalOpen && selectedAlert && (
        <AlertModal
          alert={selectedAlert}
          onClose={handleCloseModal}
          topologyDevices={topologyDevices}
          allDevices={allDevices}
        />
      )}
    </>
  );
}
