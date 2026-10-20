import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectAllDevices } from "../../redux/slices/devicesSlice";
import { selectTopologyDevices } from "../../redux/slices/coreTopologySlice";
import {
  ArrowUp,
  ArrowDown,
  Clock,
  Search,
  X,
  Activity,
  CheckCircle2,
  ExternalLink,
  Layers,
  Eye,
  EyeOff,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Compass,
} from "lucide-react";
import { api } from "../../services/apiServices";
import { formatPingRateWithPackets, calculatePingSummary } from "../shared/pingHelpers";
import PingSummaryModal from "../shared/PingSummaryModal";
import FrequentLinkDropsModal from "../shared/FrequentLinkDropsModal";
import { createLinkPopupPayload } from "./handleInteractions";
import { normalizeInterfaceName, cleanDeviceKey } from "./drawHelpers";

/**
 * Formats elapsed time since a given date into a human readable duration string.
 * e.g., "3d 4h", "2h 15m", "45m", "< 1m"
 */
export function formatDuration(timestamp) {
  if (!timestamp) return "N/A";

  // If it's a duration string like "4d21h" or "4d 21h"
  if (typeof timestamp === "string") {
    const s = timestamp.trim();
    if (/^\d+\s*[wdhms]/i.test(s)) {
      return s.replace(/([a-zA-Z])(?=\d)/g, "$1 ").trim();
    }
  }

  // If it's a numeric duration in seconds (e.g. 424720)
  if (typeof timestamp === "number" && timestamp >= 0 && timestamp < 100000000) {
    const diffSec = Math.floor(timestamp);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks > 0) {
      const remDays = diffDays % 7;
      return remDays > 0 ? `${diffWeeks}w ${remDays}d` : `${diffWeeks}w`;
    }
    if (diffDays > 0) {
      const remHours = diffHours % 24;
      return remHours > 0 ? `${diffDays}d ${remHours}h` : `${diffDays}d`;
    }
    if (diffHours > 0) {
      const remMin = diffMin % 60;
      return remMin > 0 ? `${diffHours}h ${remMin}m` : `${diffHours}h`;
    }
    if (diffMin > 0) {
      return `${diffMin}m`;
    }
    return "< 1m";
  }

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "N/A";

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffWeeks > 0) {
    const remDays = diffDays % 7;
    return remDays > 0 ? `${diffWeeks}w ${remDays}d` : `${diffWeeks}w`;
  }
  if (diffDays > 0) {
    const remHours = diffHours % 24;
    return remHours > 0 ? `${diffDays}d ${remHours}h` : `${diffDays}d`;
  }
  if (diffHours > 0) {
    const remMin = diffMin % 60;
    return remMin > 0 ? `${diffHours}h ${remMin}m` : `${diffHours}h`;
  }
  if (diffMin > 0) {
    return `${diffMin}m`;
  }
  return "< 1m";
}

/**
 * Formats a timestamp into a clean localized time string for tooltips.
 */
export function formatExactTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

import { getLinkStatusAndDate } from "./drawHelpers";

/**
 * EventLinkCard
 * Renders an expandable card for a link's status events in the "All" tab.
 * Includes:
 * - A chevron arrow indicator that shows it can be opened, rotating smoothly when expanded
 * - A lightweight CSS grid-template-rows & opacity animation on expand/collapse
 */
function EventLinkCard({ group, isExpanded, onToggle, onInspect, onShowInZone, isDark }) {
  const eventCount = group.events.length;
  const isGroupDown =
    group.fullLink?.normalizedStatus === "down" ||
    group.fullLink?.status === "down" ||
    group.fullLink?.category === "down" ||
    (group.events &&
      group.events[0] &&
      (group.events[0].new_oper_status || group.events[0].new_status || "").toLowerCase() === "down");

  return (
    <div
      className={`group relative p-3 rounded-xl border transition-all duration-200 ${
        isDark
          ? "bg-gray-800/60 border-gray-700/60 hover:border-gray-600"
          : "bg-white border-gray-200/80 hover:border-gray-300 shadow-sm"
      }`}
    >
      {/* Link Header (Clickable) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (window.getSelection && window.getSelection().toString().trim().length > 0) return;
          onToggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex items-center justify-between cursor-pointer"
      >
        <div className="flex flex-col min-w-0 pr-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-100">
            <span
              className="truncate font-mono"
              title={group.localDeviceIp ? `${group.deviceName} (${group.localDeviceIp})` : group.deviceName}
            >
              {group.deviceName}
            </span>
            <span className="text-gray-400 dark:text-gray-500 font-mono text-[10px]">⟷</span>
            <span
              className="truncate font-mono"
              title={group.remoteDeviceIp ? `${group.remoteDeviceName} (${group.remoteDeviceIp})` : group.remoteDeviceName}
            >
              {group.remoteDeviceName}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>
              {group.interface && group.remoteInterface && group.interface !== group.remoteInterface
                ? `${group.interface} ⟷ ${group.remoteInterface}`
                : group.interface || group.remoteInterface || "Unknown Interface"}
            </span>
            {(group.localDeviceIp || group.remoteDeviceIp) && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                ({group.localDeviceIp || "N/A"} ⟷ {group.remoteDeviceIp || "N/A"})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
            {eventCount} {eventCount === 1 ? "event" : "events"}
          </span>

          {isGroupDown && !group.isVisibleOnMap && onShowInZone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShowInZone();
              }}
              title="Show in zone"
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                isDark
                  ? "bg-sky-900/40 hover:bg-sky-800/60 text-sky-300 border border-sky-800/50"
                  : "bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold hidden sm:inline">Show in zone</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect();
            }}
            title="Inspect link details"
            className={`p-1.5 rounded-lg transition-colors ${
              isDark
                ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Expand / Collapse Chevron Arrow Indicator */}
          <div
            className={`p-1 rounded-lg transition-colors flex items-center justify-center ${
              isExpanded
                ? isDark
                  ? "bg-blue-900/40 text-blue-400"
                  : "bg-blue-50 text-blue-600"
                : isDark
                ? "text-gray-400 group-hover:text-gray-200 group-hover:bg-gray-700/50"
                : "text-gray-400 group-hover:text-gray-600 group-hover:bg-gray-100"
            }`}
            title={isExpanded ? "Collapse status changes" : "Expand to view status changes"}
            aria-expanded={isExpanded}
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ease-in-out ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>
      </div>

      {/* Expanded Events List with Lightweight Animation */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: "grid-template-rows 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`transition-opacity duration-200 ease-out ${
              isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div
              className={`mt-3 pt-3 border-t space-y-2.5 ${
                isDark ? "border-gray-700/50" : "border-gray-100"
              }`}
            >
              {group.events.map((event, index) => {
                const statusColors = {
                  up: { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
                  down: { bg: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
                  issue: { bg: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
                };

                const isOspfEvent = Boolean(
                  event.old_ospf_state ||
                  event.new_ospf_state ||
                  String(event.event_type || "").toLowerCase().startsWith("ospf")
                );
                const isDrop = event.event_type === "ospf_drop";
                const oldStatusStr = isOspfEvent
                  ? event.old_ospf_state || (isDrop ? "Full" : "Down")
                  : event.old_oper_status;
                const newStatusStr = isOspfEvent
                  ? event.new_ospf_state || (isDrop ? "Down" : "Full")
                  : event.new_oper_status;

                const getStatusColor = (statusStr) => {
                  if (!statusStr) return statusColors.issue;
                  const s = statusStr.toLowerCase();
                  if (s === "up" || s === "full") return statusColors.up;
                  if (s === "down" || s === "drop") return statusColors.down;
                  return statusColors.issue;
                };

                const oldStyle = getStatusColor(oldStatusStr);
                const newStyle = getStatusColor(newStatusStr);

                const oldLabel = oldStatusStr ? String(oldStatusStr).toUpperCase() : "N/A";
                const newLabel = newStatusStr ? String(newStatusStr).toUpperCase() : "N/A";

                const eventTime = formatExactTime(event.created_at || event.changed_at);
                const eventDuration = formatDuration(event.created_at || event.changed_at);

                const eventTypeLabel = String(event.event_type || "Event")
                  .replace(/_/g, " ")
                  .toUpperCase();

                return (
                  <div
                    key={event.id ?? `${event.event_type}-${event.created_at || event.changed_at}-${index}`}
                    className={`p-2 rounded-lg border ${
                      isDark ? "bg-gray-800/80 border-gray-700/80" : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    {/* Status Change Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${oldStyle.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${oldStyle.bg}`} />
                          {oldLabel}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${newStyle.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${newStyle.bg}`} />
                          {newLabel}
                        </span>
                      </div>
                      <div
                        title={eventTime}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white dark:bg-gray-700 shadow-sm text-gray-600 dark:text-gray-300"
                      >
                        <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                        <span>{eventDuration} ago</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5 flex-wrap">
                        <span>{eventTypeLabel}</span>
                        {event.local_device_name && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal font-mono">
                            ({event.local_device_name}{event.local_interface ? `:${event.local_interface}` : ""})
                          </span>
                        )}
                      </span>
                      <span className="font-mono">{eventTime}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * NetworkLinksSideDrawer
 *
 * Renders:
 * 1. Two side buttons (Up / Down) with live count badges on the network chart.
 * 2. A slide-out side panel showing all Up or Down links, search filtering,
 *    and how long each link has been up or down.
 * 3. Mark / Highlight link controls to display relevant links prominently on the chart.
 */
export default function NetworkLinksSideDrawer({
  links = [],
  onLinkClick,
  theme = "light",
  chartName = "Network",
  isOpen: controlledIsOpen,
  onOpenChange,
  activeFilter: controlledActiveFilter,
  onActiveFilterChange,
  pingSubFilter: controlledPingSubFilter,
  onPingSubFilterChange,
  markedLinkIds = new Set(),
  onToggleMarkLink,
  onMarkAll,
  onClearMarks,
  onHoverLink,
  onHoverFilter,
  onShowInZone: propOnShowInZone,
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setIsOpen = (val) => {
    const nextVal = typeof val === "function" ? val(isOpen) : val;
    setInternalIsOpen(nextVal);
    onOpenChange?.(nextVal);
  };

  const [internalActiveFilter, setInternalActiveFilter] = useState("up"); // 'up' | 'down' | 'issue' | 'ping' | 'all'
  const activeFilter =
    controlledActiveFilter !== undefined && controlledActiveFilter !== null
      ? controlledActiveFilter
      : internalActiveFilter;

  const setActiveFilter = (val) => {
    const nextVal = typeof val === "function" ? val(activeFilter) : val;
    setInternalActiveFilter(nextVal);
    onActiveFilterChange?.(nextVal);
  };

  const [internalPingSubFilter, setInternalPingSubFilter] = useState("all"); // 'all' | 'issues' | 'healthy'
  const pingSubFilter =
    controlledPingSubFilter !== undefined
      ? controlledPingSubFilter
      : internalPingSubFilter;

  const setPingSubFilter = (val) => {
    const nextVal = typeof val === "function" ? val(pingSubFilter) : val;
    setInternalPingSubFilter(nextVal);
    onPingSubFilterChange?.(nextVal);
  };

  const [timeFilter, setTimeFilter] = useState(null); // null | '24h' | '7d' | '30d'
  const [isPingModalOpen, setIsPingModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Local state to trigger re-computation of durations every 10 seconds
  const [, setTimerTick] = useState(0);

  const isDark = theme === "dark";

  // State for the "All" tab event log
  const [statusEvents, setStatusEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [expandedEventLinks, setExpandedEventLinks] = useState(new Set());
  
  // Advanced filters for the "All" tab events
  const [apiEventType, setApiEventType] = useState("");
  const [apiLocalDevice, setApiLocalDevice] = useState("");
  const [apiRemoteDevice, setApiRemoteDevice] = useState("");

  // State for Frequent Link Drops (>= 10 link down events in last 24h)
  const [frequentDropLinks, setFrequentDropLinks] = useState([]);
  const [isDropsModalOpen, setIsDropsModalOpen] = useState(false);
  const [lastDropsCheckTime, setLastDropsCheckTime] = useState(null);

  const allDevices = useSelector(selectAllDevices);
  const topologyDevices = useSelector(selectTopologyDevices);

  // Map for fast device IP lookup by device id, name, or hostname
  const deviceIpMap = useMemo(() => {
    const map = new Map();
    const registerDevice = (d) => {
      if (!d) return;
      const ip = d.ip || d.ip_address;
      if (!ip) return;
      if (d.id != null) {
        map.set(String(d.id), ip);
        map.set(Number(d.id), ip);
      }
      if (d.name) {
        map.set(String(d.name).toLowerCase(), ip);
      }
      if (d.hostname) {
        map.set(String(d.hostname).toLowerCase(), ip);
      }
    };
    if (Array.isArray(allDevices)) {
      allDevices.forEach(registerDevice);
    }
    if (Array.isArray(topologyDevices)) {
      topologyDevices.forEach(registerDevice);
    }
    return map;
  }, [allDevices, topologyDevices]);

  const getDeviceIp = useCallback(
    (deviceRef, fallbackName) => {
      if (!deviceRef && !fallbackName) return null;
      if (typeof deviceRef === "object" && deviceRef !== null) {
        if (deviceRef.ip) return deviceRef.ip;
        if (deviceRef.ip_address) return deviceRef.ip_address;
        if (deviceRef.name && deviceIpMap.has(String(deviceRef.name).toLowerCase())) {
          return deviceIpMap.get(String(deviceRef.name).toLowerCase());
        }
        if (deviceRef.hostname && deviceIpMap.has(String(deviceRef.hostname).toLowerCase())) {
          return deviceIpMap.get(String(deviceRef.hostname).toLowerCase());
        }
        if (deviceRef.id != null && deviceIpMap.has(String(deviceRef.id))) {
          return deviceIpMap.get(String(deviceRef.id));
        }
      }
      if (typeof deviceRef === "string" || typeof deviceRef === "number") {
        const key = String(deviceRef).toLowerCase();
        if (deviceIpMap.has(key)) return deviceIpMap.get(key);
      }
      if (fallbackName) {
        const key = String(fallbackName).toLowerCase();
        if (deviceIpMap.has(key)) return deviceIpMap.get(key);
      }
      return null;
    },
    [deviceIpMap]
  );

  const navigate = useNavigate();
  const location = useLocation();

  const getZoneDeviceList = useCallback(
    (zoneName) => {
      if (!zoneName || zoneName === "Unknown") return [];
      const norm = cleanDeviceKey(zoneName);
      const set = new Map();
      const addDev = (d) => {
        if (!d) return;
        const z = d.coresite_name || d.zoneName || d.core_site_name;
        if (z && (cleanDeviceKey(z) === norm || z.toLowerCase() === zoneName.toLowerCase())) {
          const key = d.hostname || d.name || d.id;
          if (key && !set.has(key)) set.set(key, d);
        }
      };
      if (Array.isArray(topologyDevices)) topologyDevices.forEach(addDev);
      if (Array.isArray(allDevices)) allDevices.forEach(addDev);
      return Array.from(set.values());
    },
    [topologyDevices, allDevices]
  );

  const getLinkZoneInfo = useCallback(
    (link) => {
      if (!link) return null;

      const srcName = link.sourceName || link.source || link.local_device_name || link.deviceName;
      const tgtName = link.targetName || link.target || link.remote_device_name || link.remoteDeviceName;

      let srcZone = link.sourceZone;
      let tgtZone = link.targetZone;

      const findDev = (name, id) => {
        if (!name && id == null) return null;
        const clean = cleanDeviceKey(name || "");
        return (
          (Array.isArray(topologyDevices)
            ? topologyDevices.find(
                (d) =>
                  (id != null && (String(d.id) === String(id) || d.id === id)) ||
                  (d.name && cleanDeviceKey(d.name) === clean) ||
                  (d.hostname && cleanDeviceKey(d.hostname) === clean)
              )
            : null) ||
          (Array.isArray(allDevices)
            ? allDevices.find(
                (d) =>
                  (id != null && (String(d.id) === String(id) || d.id === id)) ||
                  (d.hostname && cleanDeviceKey(d.hostname) === clean) ||
                  (d.name && cleanDeviceKey(d.name) === clean)
              )
            : null)
        );
      };

      const srcDev = findDev(srcName, link.coredevice_id || link.local_device_id);
      const tgtDev = findDev(tgtName, link.remote_device_id || link.neighbor_coredevice_id);

      if (!srcZone || srcZone === "Unknown") {
        srcZone = srcDev?.coresite_name || srcDev?.zoneName || srcDev?.core_site_name || null;
      }
      if (!tgtZone || tgtZone === "Unknown") {
        tgtZone = tgtDev?.coresite_name || tgtDev?.zoneName || tgtDev?.core_site_name || null;
      }

      const srcDevList = srcZone ? getZoneDeviceList(srcZone) : [];
      const tgtDevList = tgtZone ? getZoneDeviceList(tgtZone) : [];

      let chosenZone = null;
      let chosenDevList = [];

      // Determine target zone:
      // "opens the zone of the core site the line goes (if the downed line is in the zone with the six devices show the specific four that are relevent to the line)"
      if (srcZone && tgtZone && srcZone.toLowerCase() === tgtZone.toLowerCase()) {
        chosenZone = srcZone;
        chosenDevList = srcDevList.length > 0 ? srcDevList : tgtDevList;
      } else if (tgtDevList.length === 6) {
        chosenZone = tgtZone;
        chosenDevList = tgtDevList;
      } else if (srcDevList.length === 6) {
        chosenZone = srcZone;
        chosenDevList = srcDevList;
      } else if (tgtZone && tgtZone !== "Unknown") {
        chosenZone = tgtZone;
        chosenDevList = tgtDevList;
      } else if (srcZone && srcZone !== "Unknown") {
        chosenZone = srcZone;
        chosenDevList = srcDevList;
      }

      if (!chosenZone) return null;

      const priorityOrder = [1, 2, 4, 5, 7, 8];
      const getEnding = (name) => {
        if (!name) return 99;
        const match = String(name).match(/(\d+)(?!.*\d)/);
        return match ? parseInt(match[1], 10) : 99;
      };

      const sortedDevs = [...chosenDevList].sort((a, b) => {
        const aEnd = getEnding(a.hostname || a.name);
        const bEnd = getEnding(b.hostname || b.name);
        const aP = priorityOrder.indexOf(aEnd) === -1 ? 99 : priorityOrder.indexOf(aEnd);
        const bP = priorityOrder.indexOf(bEnd) === -1 ? 99 : priorityOrder.indexOf(bEnd);
        return aP - bP;
      });

      const isSixDeviceZone = sortedDevs.length >= 6;
      let shouldShowExtended = false;
      let relevantDevice = null;

      const srcClean = cleanDeviceKey(srcName || "");
      const tgtClean = cleanDeviceKey(tgtName || "");

      const connectedInZone = sortedDevs.filter(
        (d) =>
          cleanDeviceKey(d.name) === srcClean ||
          cleanDeviceKey(d.hostname) === srcClean ||
          cleanDeviceKey(d.name) === tgtClean ||
          cleanDeviceKey(d.hostname) === tgtClean ||
          (link.coredevice_id != null && String(d.id) === String(link.coredevice_id)) ||
          (link.remote_device_id != null && String(d.id) === String(link.remote_device_id)) ||
          (link.neighbor_coredevice_id != null && String(d.id) === String(link.neighbor_coredevice_id))
      );

      relevantDevice = connectedInZone[0]?.hostname || connectedInZone[0]?.name || null;

      if (isSixDeviceZone) {
        // If any connected device has ending 7 or 8 (or index 4 or 5 in sorted devices),
        // we must show the extended 4 devices (slice(2, 6)), which are [4, 5, 7, 8].
        // If neither has ending 7 or 8, we show the initial 4 devices (slice(0, 4)), which are [1, 2, 4, 5].
        const hasExtendedEndpoint = connectedInZone.some((d) => {
          const ending = getEnding(d.hostname || d.name);
          const idx = sortedDevs.indexOf(d);
          return ending === 7 || ending === 8 || idx >= 4;
        });

        const isExtendedFromDirectEnding = [getEnding(srcName), getEnding(tgtName)].some(
          (end) => end === 7 || end === 8
        );

        shouldShowExtended = hasExtendedEndpoint || isExtendedFromDirectEnding;
      }

      return {
        zone: chosenZone,
        isSixDeviceZone,
        shouldShowExtended,
        relevantDevice,
      };
    },
    [topologyDevices, allDevices, getZoneDeviceList]
  );

  const handleShowInZone = useCallback(
    (link) => {
      if (propOnShowInZone) {
        propOnShowInZone(link);
        return;
      }

      const zoneInfo = getLinkZoneInfo(link);
      if (!zoneInfo || !zoneInfo.zone) return;

      const isP =
        location.pathname.startsWith("/Pikudim") ||
        location.pathname.startsWith("/pikudim") ||
        location.pathname.startsWith("/p-chart") ||
        (chartName && (chartName.toLowerCase().includes("p") || chartName.includes("5") || chartName.toLowerCase().includes("pikud"))) ||
        link.network_type_id === 2;

      const basePath = isP ? "/Pikudim" : "/Libot";
      const url = `${basePath}/zone/${encodeURIComponent(zoneInfo.zone)}?showExtended=${zoneInfo.shouldShowExtended}`;

      navigate(url, {
        state: {
          showExtendedNodes: zoneInfo.shouldShowExtended,
          targetNodeId: zoneInfo.relevantDevice,
          focusedNode: zoneInfo.relevantDevice,
          downedLinkId: link.id,
        },
      });
    },
    [propOnShowInZone, getLinkZoneInfo, location.pathname, chartName, navigate]
  );

  const deviceFilterOptions = useMemo(() => {
    if (!Array.isArray(allDevices)) return [];
    const options = allDevices
      .filter((d) => d && d.id && (d.hostname || d.name))
      .map((d) => ({ id: String(d.id), label: d.hostname || d.name }));
    const uniqueMap = new Map();
    options.forEach((opt) => uniqueMap.set(opt.id, opt.label));
    return Array.from(uniqueMap.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allDevices]);

  // Fetch events when the "All" tab is active and time filter changes
  const fetchEvents = useCallback(async (since, eventType, localId, remoteId, silent = false) => {
    if (!silent) setEventsLoading(true);

    let params;
    if (since === "72h_ospf") {
      params = {
        days: 3,
        "event-type": "ospf_drop",
        offset: 0,
        include_summary: true,
      };
      if (eventType && eventType !== "ospf_drop") {
        params["event-type"] = eventType;
      }
    } else {
      let days = 1;
      if (since === "7d") days = 7;
      if (since === "30d") days = 30;

      params = { days };
      if (eventType) params.event_type = eventType;
    }

    if (localId) params.local_device_id = parseInt(localId, 10);
    if (remoteId) params.remote_device_id = parseInt(remoteId, 10);

    try {
      const data = await api.getCoreTopologyEvents(params);
      const rawEvents = Array.isArray(data)
        ? data
        : Array.isArray(data?.events)
        ? data.events
        : Array.isArray(data?.data?.events)
        ? data.data.events
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setStatusEvents(rawEvents);
    } catch (err) {
      console.error("Failed to fetch topology events:", err);
      setStatusEvents([]);
    } finally {
      if (!silent) setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeFilter === "all") {
      fetchEvents(timeFilter || "24h", apiEventType, apiLocalDevice, apiRemoteDevice);
    }
    
    // Polling every 30 seconds
    const interval = setInterval(() => {
      if (activeFilter === "all") {
        fetchEvents(timeFilter || "24h", apiEventType, apiLocalDevice, apiRemoteDevice, true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeFilter, timeFilter, apiEventType, apiLocalDevice, apiRemoteDevice, fetchEvents]);

  // Re-calculate durations periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Classify and enrich links
  const enrichedLinks = useMemo(() => {
    return links.map((link) => {
      const { status: normalizedStatus, statusDate: computedDate } = getLinkStatusAndDate(link);
      const statusDate =
        computedDate ||
        link.statusDate ||
        link.statusChangedAt ||
        link.status_changed_at ||
        link.updated_at ||
        link.timestamp ||
        link.created_at ||
        new Date().toISOString();
      const durationStr = formatDuration(statusDate);
      const exactTimeStr = formatExactTime(statusDate);

      const sourceName =
        typeof link.source === "object"
          ? link.source.id || link.source.name
          : link.source;
      const targetName =
        typeof link.target === "object"
          ? link.target.id || link.target.name
          : link.target;

      const localDeviceIp =
        link.local_device_ip ||
        link.source_device_ip ||
        getDeviceIp(link.source, sourceName) ||
        (link.coredevice_id != null ? deviceIpMap.get(String(link.coredevice_id)) : null) ||
        link.rawLink?.local_device_ip ||
        null;

      const remoteDeviceIp =
        link.remote_device_ip ||
        link.target_device_ip ||
        getDeviceIp(link.target, targetName) ||
        (link.remote_device_id != null ? deviceIpMap.get(String(link.remote_device_id)) : null) ||
        (link.neighbor_coredevice_id != null ? deviceIpMap.get(String(link.neighbor_coredevice_id)) : null) ||
        link.rawLink?.remote_device_ip ||
        link.rawLink?.neighbor_ip ||
        null;

      const localLinkIp =
        link.local_link_ip ||
        link.local_ip ||
        link.rawLink?.local_link_ip ||
        link.rawLink?.local_ip ||
        null;

      const remoteLinkIp =
        link.remote_link_ip ||
        link.remote_ip ||
        link.destinationIp ||
        link.rawLink?.remote_link_ip ||
        link.rawLink?.remote_ip ||
        link.rawLink?.destinationIp ||
        null;

      return {
        ...link,
        sourceName,
        targetName,
        local_device_ip: localDeviceIp,
        source_device_ip: localDeviceIp,
        remote_device_ip: remoteDeviceIp,
        target_device_ip: remoteDeviceIp,
        local_link_ip: localLinkIp,
        remote_link_ip: remoteLinkIp,
        normalizedStatus,
        statusDate,
        durationStr,
        exactTimeStr,
      };
    });
  }, [links, deviceIpMap, getDeviceIp]);

  // Helper to match an event to its unified canonical link in enrichedLinks
  const findCanonicalLinkForEvent = useCallback(
    (event) => {
      if (!event) return null;
      if (event.link_id != null) {
        const directMatch = enrichedLinks.find(
          (l) =>
            l.id === event.link_id ||
            (Array.isArray(l.allIds) && l.allIds.includes(event.link_id))
        );
        if (directMatch) return directMatch;
      }

      const evDev1 = cleanDeviceKey(event.local_device_name);
      const evDev2 = cleanDeviceKey(event.remote_device_name);
      if (!evDev1 || !evDev2) return null;

      const evIf1 = normalizeInterfaceName(event.local_interface);
      const evIf2 = normalizeInterfaceName(event.remote_interface);

      // 1. Device names + interface match in either direction
      const candidate = enrichedLinks.find((l) => {
        const lSrc = cleanDeviceKey(l.sourceName);
        const lTgt = cleanDeviceKey(l.targetName);
        const sameDir = lSrc === evDev1 && lTgt === evDev2;
        const revDir = lSrc === evDev2 && lTgt === evDev1;
        if (!sameDir && !revDir) return false;

        const lIf1 = normalizeInterfaceName(l.local_interface);
        const lIf2 = normalizeInterfaceName(l.remote_interface);
        const lAllLocal = (l.allLocalInterfaces || []).map(normalizeInterfaceName);
        const lAllRemote = (l.allRemoteInterfaces || []).map(normalizeInterfaceName);

        if (evIf1) {
          if (sameDir && lIf1 !== evIf1 && !lAllLocal.includes(evIf1)) return false;
          if (revDir && lIf2 !== evIf1 && !lAllRemote.includes(evIf1) && lIf1 !== evIf1) return false;
        }
        if (evIf2) {
          if (sameDir && lIf2 !== evIf2 && !lAllRemote.includes(evIf2)) return false;
          if (revDir && lIf1 !== evIf2 && !lAllLocal.includes(evIf2) && lIf2 !== evIf2) return false;
        }
        return true;
      });

      if (candidate) return candidate;

      // 2. Device pair fallback if there's only 1 link between these devices
      const pairMatches = enrichedLinks.filter((l) => {
        const lSrc = cleanDeviceKey(l.sourceName);
        const lTgt = cleanDeviceKey(l.targetName);
        return (lSrc === evDev1 && lTgt === evDev2) || (lSrc === evDev2 && lTgt === evDev1);
      });
      if (pairMatches.length === 1) return pairMatches[0];

      return null;
    },
    [enrichedLinks]
  );

  // Poll api/core-topology-events?days=1&event_type=link_down every 5 minutes.
  // If any line has at least 10 link down events in the last 24 hours, show a popup listing all of those links.
  const checkFrequentLinkDrops = useCallback(async () => {
    try {
      const data = await api.getCoreTopologyEvents({
        days: 1,
        event_type: "link_down",
      });

      const rawEvents = Array.isArray(data)
        ? data
        : Array.isArray(data?.events)
        ? data.events
        : Array.isArray(data?.data?.events)
        ? data.data.events
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const now = Date.now();
      const cutoff24h = now - 24 * 60 * 60 * 1000;

      // Filter strictly to link_down events within last 24 hours
      const downEvents = rawEvents.filter((ev) => {
        const type = String(ev?.event_type || "").toLowerCase();
        if (type !== "link_down") return false;
        const tStr = ev.created_at || ev.changed_at;
        if (!tStr) return true;
        const t = new Date(tStr).getTime();
        return isNaN(t) || t >= cutoff24h;
      });

      // Group events by line / canonical link
      const groupsByLink = new Map();

      downEvents.forEach((ev) => {
        const canonicalLink = findCanonicalLinkForEvent(ev);

        let groupKey;
        let linkId;
        let sourceName;
        let targetName;
        let localInterface;
        let remoteInterface;
        let localDeviceIp;
        let remoteDeviceIp;
        let isVisibleOnMap = false;

        if (canonicalLink) {
          groupKey = `canonical-${canonicalLink.id}`;
          linkId = canonicalLink.id;
          sourceName = canonicalLink.sourceName;
          targetName = canonicalLink.targetName;
          localInterface = canonicalLink.local_interface;
          remoteInterface = canonicalLink.remote_interface;
          localDeviceIp = canonicalLink.local_device_ip || getDeviceIp(canonicalLink.sourceName);
          remoteDeviceIp = canonicalLink.remote_device_ip || getDeviceIp(canonicalLink.targetName);
          isVisibleOnMap = Boolean(canonicalLink.isVisibleOnMap);
        } else {
          const d1 = ev.local_device_name || `Device-${ev.local_device_id || "A"}`;
          const d2 = ev.remote_device_name || `Device-${ev.remote_device_id || "B"}`;
          const isSorted = d1.localeCompare(d2) <= 0;
          const canD1 = isSorted ? d1 : d2;
          const canD2 = isSorted ? d2 : d1;
          const if1 = isSorted ? ev.local_interface : ev.remote_interface;
          const if2 = isSorted ? ev.remote_interface : ev.local_interface;
          const normIf1 = normalizeInterfaceName(if1);
          const normIf2 = normalizeInterfaceName(if2);
          const ifSuffix = (normIf1 && normIf2) ? `-${normIf1}-${normIf2}` : "";

          linkId = ev.link_id != null ? ev.link_id : `unmapped-${canD1}---${canD2}`;
          groupKey = ev.link_id != null
            ? `linkid-${ev.link_id}`
            : `endpoints-${canD1.toLowerCase()}---${canD2.toLowerCase()}${ifSuffix}`;

          sourceName = canD1;
          targetName = canD2;
          localInterface = if1;
          remoteInterface = if2;
          localDeviceIp = getDeviceIp(canD1);
          remoteDeviceIp = getDeviceIp(canD2);
          isVisibleOnMap = false;
        }

        if (!groupsByLink.has(groupKey)) {
          groupsByLink.set(groupKey, {
            key: groupKey,
            linkId,
            canonicalLink: canonicalLink || null,
            sourceName,
            targetName,
            localInterface,
            remoteInterface,
            localDeviceIp,
            remoteDeviceIp,
            isVisibleOnMap,
            events: [],
          });
        }

        const grp = groupsByLink.get(groupKey);
        grp.events.push(ev);
      });

      // Filter to lines having at least 10 link down events in the last 24h
      const qualifyingLinks = [];

      groupsByLink.forEach((group) => {
        group.events.sort((a, b) => {
          const ta = new Date(a.created_at || a.changed_at || 0).getTime();
          const tb = new Date(b.created_at || b.changed_at || 0).getTime();
          return tb - ta;
        });

        const dropCount = group.events.length;
        if (dropCount >= 10) {
          qualifyingLinks.push({
            ...group,
            dropCount,
            lastDropTime: group.events[0]?.created_at || group.events[0]?.changed_at,
          });
        }
      });

      qualifyingLinks.sort((a, b) => b.dropCount - a.dropCount);

      setFrequentDropLinks(qualifyingLinks);
      setLastDropsCheckTime(new Date());

      // If at least one line has at least 10 link down events in the last 24h, show the popup
      if (qualifyingLinks.length > 0) {
        setIsDropsModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to check frequent link down events:", err);
    }
  }, [findCanonicalLinkForEvent, getDeviceIp]);

  // Store latest checkFrequentLinkDrops in a ref to decouple the 5-minute timer from re-renders
  const checkFrequentLinkDropsRef = useRef(checkFrequentLinkDrops);
  useEffect(() => {
    checkFrequentLinkDropsRef.current = checkFrequentLinkDrops;
  });

  // Periodic 5-minute poll
  useEffect(() => {
    // Initial call on mount
    checkFrequentLinkDropsRef.current();

    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const interval = setInterval(() => {
      checkFrequentLinkDropsRef.current();
    }, FIVE_MINUTES_MS);

    return () => clearInterval(interval);
  }, []);

  // Counts
  const upCount = useMemo(
    () => enrichedLinks.filter((l) => l.normalizedStatus === "up").length,
    [enrichedLinks]
  );
  const downCount = useMemo(
    () => enrichedLinks.filter((l) => l.normalizedStatus === "down").length,
    [enrichedLinks]
  );
  const issueCount = useMemo(
    () => enrichedLinks.filter((l) => l.normalizedStatus === "issue").length,
    [enrichedLinks]
  );

  // Ping Telemetry Summary
  const pingSummary = useMemo(
    () => calculatePingSummary(enrichedLinks),
    [enrichedLinks]
  );

  // Filtered links for the active view, time window, and search
  const filteredLinks = useMemo(() => {
    const baseList = enrichedLinks.filter((link) => {
      // Status filter
      if (activeFilter === "up" && link.normalizedStatus !== "up") return false;
      if (activeFilter === "down" && link.normalizedStatus !== "down") return false;
      if (activeFilter === "issue" && link.normalizedStatus !== "issue") return false;
      if (activeFilter === "ping") {
        const pInfo = formatPingRateWithPackets(link);
        if (!pInfo) return false;
        const numRate = pInfo.rate;
        const hasLoss = (pInfo.packetsLost ?? 0) > 0 || numRate < 100;
        if (pingSubFilter === "issues" && !hasLoss) return false;
        if (pingSubFilter === "healthy" && hasLoss) return false;
      }

      // Time filter (<= 24h, <= 1 week, <= 1 month)
      if (timeFilter && activeFilter !== "ping") {
        if (timeFilter === "72h_ospf") {
          const hasOspfDrop = (link.ospf_drops_last_24h ?? 0) > 0 || link.rawLink?.ospf_drops_last_24h > 0 || (link.ospf_state && link.ospf_state.toLowerCase() !== "full");
          if (!hasOspfDrop) return false;
        } else {
          const targetDate = new Date(link.statusDate);
          if (!isNaN(targetDate.getTime())) {
            const diffHours = (Date.now() - targetDate.getTime()) / (1000 * 60 * 60);
            
            // <= X time filter: all lines with status changed within the last X duration
            if (timeFilter === "24h" && diffHours > 24) return false;
            if (timeFilter === "7d" && diffHours > 24 * 7) return false;
            if (timeFilter === "30d" && diffHours > 24 * 30) return false;
          }
        }
      }

      // Search filter - search by word and not by entire term
      if (searchQuery.trim()) {
        const queryWords = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const searchableFields = [
          link.sourceName,
          link.targetName,
          typeof link.source === "string" ? link.source : (link.source?.name || link.source?.id),
          typeof link.target === "string" ? link.target : (link.target?.name || link.target?.id),
          link.name,
          link.interface,
          link.local_interface,
          link.remote_interface,
          ...(link.allInterfaces || []),
          link.id,
          link.sourceZone,
          link.targetZone,
          link.description,
          link.Description,
          link.local_interface_description,
          // Link interface IP addresses (local and remote link IPs)
          link.ip,
          link.local_ip,
          link.local_link_ip,
          link.remote_ip,
          link.remote_link_ip,
          link.destinationIp,
          link.rawLink?.local_link_ip,
          link.rawLink?.remote_link_ip,
          link.rawLink?.local_ip,
          link.rawLink?.remote_ip,
          link.rawLink?.neighbor_ip,
          // Device IP addresses (local device A and remote device B)
          link.local_device_ip,
          link.source_device_ip,
          link.remote_device_ip,
          link.target_device_ip,
          link.device_ip,
          link.rawLink?.local_device_ip,
          link.rawLink?.remote_device_ip,
          link.media_type,
          link.MediaType,
          link.bandwidth,
          link.Bandwidth,
          ...(Array.isArray(link.allIds) ? link.allIds : []),
        ];
        const searchableText = searchableFields.filter(Boolean).join(" ").toLowerCase();

        const matchesAllWords = queryWords.every((word) => searchableText.includes(word));
        if (!matchesAllWords) return false;
      }

      return true;
    });

    if (activeFilter === "ping") {
      // Sort worst ping first: any link with lost packets first, descending by packet loss count / ascending by rate
      return [...baseList].sort((a, b) => {
        const infoA = formatPingRateWithPackets(a);
        const infoB = formatPingRateWithPackets(b);
        const lostA = infoA?.packetsLost ?? (infoA && infoA.rate < 100 ? 1 : 0);
        const lostB = infoB?.packetsLost ?? (infoB && infoB.rate < 100 ? 1 : 0);
        if (lostA !== lostB) return lostB - lostA;
        const rateA = infoA?.rate ?? 100;
        const rateB = infoB?.rate ?? 100;
        return rateA - rateB;
      });
    }

    return baseList;
  }, [enrichedLinks, activeFilter, timeFilter, searchQuery, pingSubFilter]);

  // Helper to get links matching status and time window for marking on chart
  const getMatchingLinks = (statusF, timeF, pingSubF = pingSubFilter) => {
    return enrichedLinks.filter((link) => {
      // Status filter
      if (statusF === "up" && link.normalizedStatus !== "up") return false;
      if (statusF === "down" && link.normalizedStatus !== "down") return false;
      if (statusF === "issue" && link.normalizedStatus !== "issue") return false;
      if (statusF === "ping") {
        const pInfo = formatPingRateWithPackets(link);
        if (!pInfo) return false;
        const numRate = pInfo.rate;
        const hasLoss = (pInfo.packetsLost ?? 0) > 0 || numRate < 100;
        if (pingSubF === "issues" && !hasLoss) return false;
        if (pingSubF === "healthy" && hasLoss) return false;
      }

      // Time filter (<= 24h, <= 1 week, <= 1 month)
      if (timeF && statusF !== "ping") {
        if (timeF === "72h_ospf") {
          return (link.ospf_drops_last_24h ?? 0) > 0 || link.rawLink?.ospf_drops_last_24h > 0 || (link.ospf_state && link.ospf_state.toLowerCase() !== "full");
        }
        const targetDate = new Date(link.statusDate);
        if (!isNaN(targetDate.getTime())) {
          const diffHours =
            (Date.now() - targetDate.getTime()) / (1000 * 60 * 60);
          
          // <= X time filter: all lines with status changed within the last X duration
          if (timeF === "24h" && diffHours > 24) return false;
          if (timeF === "7d" && diffHours > 24 * 7) return false;
          if (timeF === "30d" && diffHours > 24 * 30) return false;
        }
      }
      return true;
    });
  };

  // Handle closing drawer and clearing filters
  const handleCloseDrawer = () => {
    setIsOpen(false);
    onActiveFilterChange?.(null);
    onClearMarks?.();
  };

  // Handle clicking floating buttons (Up, Down, Issue, Ping)
  const handleButtonClick = (filterType) => {
    if (isOpen && activeFilter === filterType) {
      handleCloseDrawer();
    } else {
      setActiveFilter(filterType);
      setIsOpen(true);
      if (filterType === "all") {
        onClearMarks?.();
      } else {
        const matching = getMatchingLinks(filterType, timeFilter);
        onMarkAll?.(matching.map((l) => l.id));
      }
    }
  };

  // Handle status tab clicks (Up, Down, Issue, Ping, All)
  const handleStatusTabClick = (filterType) => {
    setActiveFilter(filterType);
    let nextTimeFilter = timeFilter;
    if (filterType !== "all" && timeFilter === "72h_ospf") {
      nextTimeFilter = null;
      setTimeFilter(null);
    }
    if (filterType === "all") {
      onClearMarks?.();
    } else {
      const matching = getMatchingLinks(filterType, nextTimeFilter);
      onMarkAll?.(matching.map((l) => l.id));
    }
  };

  // Handle ping sub-filters (All, Packet Loss, 100% Healthy)
  const handlePingSubFilterClick = (subFilter) => {
    setPingSubFilter(subFilter);
    const matching = getMatchingLinks("ping", timeFilter, subFilter);
    onMarkAll?.(matching.map((l) => l.id));
  };

  // Handle time window filter clicks (<24h, <7d, <1 Month, All)
  const handleTimeFilterClick = (newTimeFilter) => {
    setTimeFilter(newTimeFilter);
    if (activeFilter === "all") {
      onClearMarks?.();
    } else {
      const matching = getMatchingLinks(activeFilter, newTimeFilter);
      onMarkAll?.(matching.map((l) => l.id));
    }
  };

  return (
    <>
      {/* ========================================================= */}
      {/* FLOATING SIDE ACTION BUTTONS (UP, DOWN, ISSUE, PING TOTAL) */}
      {/* ========================================================= */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 flex-wrap">
        {/* UP Links Button */}
        <button
          type="button"
          onClick={() => handleButtonClick("up")}
          onMouseEnter={() => onHoverFilter?.("up")}
          onMouseLeave={() => onHoverFilter?.(null)}
          title={`View all Up links (${upCount})`}
          className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold shadow-lg transition-all duration-200 border ${
            isOpen && activeFilter === "up"
              ? "bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400/50 shadow-emerald-500/20"
              : isDark
              ? "bg-gray-800/90 hover:bg-gray-700/90 text-emerald-400 border-gray-700/80 hover:border-emerald-500/50 backdrop-blur-md shadow-black/20"
              : "bg-white/95 hover:bg-emerald-50/90 text-emerald-700 border-gray-200 hover:border-emerald-300 backdrop-blur-md shadow-gray-200/50"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
              isOpen && activeFilter === "up"
                ? "bg-white/20 text-white"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white"
            }`}
          >
            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span>Up</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
              isOpen && activeFilter === "up"
                ? "bg-emerald-700 text-white"
                : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {upCount}
          </span>
        </button>

        {/* DOWN Links Button */}
        <button
          type="button"
          onClick={() => handleButtonClick("down")}
          onMouseEnter={() => onHoverFilter?.("down")}
          onMouseLeave={() => onHoverFilter?.(null)}
          title={`View all Down links (${downCount})`}
          className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold shadow-lg transition-all duration-200 border ${
            isOpen && activeFilter === "down"
              ? "bg-rose-600 text-white border-rose-500 ring-2 ring-rose-400/50 shadow-rose-500/20"
              : isDark
              ? "bg-gray-800/90 hover:bg-gray-700/90 text-rose-400 border-gray-700/80 hover:border-rose-500/50 backdrop-blur-md shadow-black/20"
              : "bg-white/95 hover:bg-rose-50/90 text-rose-700 border-gray-200 hover:border-rose-300 backdrop-blur-md shadow-gray-200/50"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
              isOpen && activeFilter === "down"
                ? "bg-white/20 text-white"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white"
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span>Down</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
              isOpen && activeFilter === "down"
                ? "bg-rose-700 text-white"
                : downCount > 0
                ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            {downCount}
          </span>
        </button>

        {/* ISSUE Links Button */}
        <button
          type="button"
          onClick={() => handleButtonClick("issue")}
          onMouseEnter={() => onHoverFilter?.("issue")}
          onMouseLeave={() => onHoverFilter?.(null)}
          title={`View all Issue links (${issueCount})`}
          className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold shadow-lg transition-all duration-200 border ${
            isOpen && activeFilter === "issue"
              ? "bg-amber-600 text-white border-amber-500 ring-2 ring-amber-400/50 shadow-amber-500/20"
              : isDark
              ? "bg-gray-800/90 hover:bg-gray-700/90 text-amber-400 border-gray-700/80 hover:border-amber-500/50 backdrop-blur-md shadow-black/20"
              : "bg-white/95 hover:bg-amber-50/90 text-amber-700 border-gray-200 hover:border-amber-300 backdrop-blur-md shadow-gray-200/50"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
              isOpen && activeFilter === "issue"
                ? "bg-white/20 text-white"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white"
            }`}
          >
            <Activity className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span>Issue</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
              isOpen && activeFilter === "issue"
                ? "bg-amber-700 text-white"
                : issueCount > 0
                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            {issueCount}
          </span>
        </button>

        {/* PING TOTAL Button */}
        <button
          type="button"
          onClick={() => handleButtonClick("ping")}
          onMouseEnter={() => onHoverFilter?.("ping")}
          onMouseLeave={() => onHoverFilter?.(null)}
          title={`Total Ping: ${pingSummary.formattedRate} (${pingSummary.formattedPackets} packets received${pingSummary.totalPacketsLost > 0 ? `, ${pingSummary.totalPacketsLost} lost!` : ""}). Click to view ping telemetry.`}
          className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold shadow-lg transition-all duration-200 border ${
            isOpen && activeFilter === "ping"
              ? "bg-blue-600 text-white border-blue-500 ring-2 ring-blue-400/50 shadow-blue-500/20"
              : isDark
              ? "bg-gray-800/90 hover:bg-gray-700/90 border-gray-700/80 backdrop-blur-md shadow-black/20"
              : "bg-white/95 hover:bg-blue-50/90 border-gray-200 backdrop-blur-md shadow-gray-200/50"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
              isOpen && activeFilter === "ping"
                ? "bg-white/20 text-white"
                : pingSummary.statusCategory === "optimal"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white"
                : pingSummary.statusCategory === "degraded"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white"
            }`}
          >
            {pingSummary.totalPacketsLost > 0 && activeFilter !== "ping" ? (
              <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <Activity className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
          </div>
          <span
            className={
              isOpen && activeFilter === "ping"
                ? "text-white"
                : pingSummary.statusCategory === "optimal"
                ? "text-emerald-700 dark:text-emerald-300"
                : pingSummary.statusCategory === "degraded"
                ? "text-amber-700 dark:text-amber-300"
                : "text-rose-700 dark:text-rose-300"
            }
          >
            Ping Total
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
              isOpen && activeFilter === "ping"
                ? "bg-blue-700 text-white"
                : pingSummary.statusCategory === "optimal"
                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                : pingSummary.statusCategory === "degraded"
                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                : "bg-rose-500/20 text-rose-700 dark:text-rose-300"
            }`}
          >
            {pingSummary.formattedRate}
          </span>
          {pingSummary.totalPacketsLost > 0 ? (
            <span
              className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                isOpen && activeFilter === "ping"
                  ? "bg-rose-500/30 text-rose-100"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              }`}
            >
              {pingSummary.totalPacketsLost} lost
            </span>
          ) : (
            <span
              className={`text-xs font-mono hidden md:inline opacity-75 ${
                isOpen && activeFilter === "ping" ? "text-white" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              ({pingSummary.formattedPackets})
            </span>
          )}
        </button>

        {/* FREQUENT DROPS (10+ IN 24H) ALERT BUTTON */}
        {frequentDropLinks.length > 0 && (
          <button
            type="button"
            onClick={() => setIsDropsModalOpen(true)}
            title={`${frequentDropLinks.length} line(s) have experienced ≥10 link down events in the last 24 hours. Click to view alert.`}
            className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold shadow-lg transition-all duration-200 border animate-pulse ${
              isDark
                ? "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-700/80 backdrop-blur-md shadow-rose-950/40"
                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 backdrop-blur-md shadow-rose-100/50"
            }`}
          >
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-rose-500/20 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors">
              <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <span>10+ Drops</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs">
              {frequentDropLinks.length}
            </span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* SLIDE-OUT SIDE DRAWER / PANEL                             */}
      {/* ========================================================= */}
      {/* Backdrop overlay for smaller screens or click away */}
      {isOpen && (
        <div
          onClick={handleCloseDrawer}
          className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-25 transition-opacity"
        />
      )}

      <aside
        aria-label="Network Links Side Drawer"
        className={`absolute top-0 right-0 h-full w-full sm:w-[460px] max-w-full z-30 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out border-l ${
          isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        } ${
          isDark
            ? "bg-gray-900/95 border-gray-800 text-gray-100 backdrop-blur-xl"
            : "bg-white/95 border-gray-200 text-gray-900 backdrop-blur-xl"
        }`}
      >
        {/* --- Drawer Header --- */}
        <div
          className={`p-4 border-b flex-shrink-0 flex items-center justify-between ${
            isDark ? "border-gray-800 bg-gray-900/60" : "border-gray-100 bg-gray-50/60"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                activeFilter === "up"
                  ? "bg-emerald-500/15 text-emerald-500"
                  : activeFilter === "down"
                  ? "bg-rose-500/15 text-rose-500"
                  : activeFilter === "issue"
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-blue-500/15 text-blue-500"
              }`}
            >
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {activeFilter === "up"
                  ? "Up Links"
                  : activeFilter === "down"
                  ? "Down Links"
                  : activeFilter === "issue"
                  ? "Issue Links"
                  : activeFilter === "ping"
                  ? "Ping Telemetry"
                  : "All Network Links"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {activeFilter === "all"
                  ? `${chartName} Chart • Event Log`
                  : `${chartName} Chart • ${filteredLinks.length} visible link${filteredLinks.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseDrawer}
            title="Close panel"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* --- Filter Tabs, Time Range & Search Controls --- */}
        <div
          className={`p-3 border-b flex-shrink-0 space-y-2.5 ${
            isDark ? "border-gray-800" : "border-gray-100"
          }`}
        >
          {/* Frequent Drop Warning Banner */}
          {frequentDropLinks.length > 0 && (
            <div
              className={`p-2.5 px-3 rounded-xl border flex items-center justify-between text-xs gap-2 ${
                isDark
                  ? "bg-rose-950/30 border-rose-800/40 text-rose-300"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="truncate">
                  <strong>{frequentDropLinks.length} line{frequentDropLinks.length === 1 ? "" : "s"}</strong> experienced ≥10 link down events in 24h
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDropsModalOpen(true)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shrink-0 shadow-xs"
              >
                View Popup
              </button>
            </div>
          )}

          {/* Status Tabs switch */}
          <div className="grid grid-cols-5 gap-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => handleStatusTabClick("up")}
              onMouseEnter={() => onHoverFilter?.("up")}
              onMouseLeave={() => onHoverFilter?.(null)}
              className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                activeFilter === "up"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <ArrowUp className="w-3 h-3 shrink-0" />
              <span className="truncate">Up ({upCount})</span>
            </button>

            <button
              type="button"
              onClick={() => handleStatusTabClick("down")}
              onMouseEnter={() => onHoverFilter?.("down")}
              onMouseLeave={() => onHoverFilter?.(null)}
              className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                activeFilter === "down"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <ArrowDown className="w-3 h-3 shrink-0" />
              <span className="truncate">Down ({downCount})</span>
            </button>

            <button
              type="button"
              onClick={() => handleStatusTabClick("issue")}
              onMouseEnter={() => onHoverFilter?.("issue")}
              onMouseLeave={() => onHoverFilter?.(null)}
              className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                activeFilter === "issue"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <Activity className="w-3 h-3 shrink-0" />
              <span className="truncate">Issue ({issueCount})</span>
            </button>

            <button
              type="button"
              onClick={() => handleStatusTabClick("ping")}
              onMouseEnter={() => onHoverFilter?.("ping")}
              onMouseLeave={() => onHoverFilter?.(null)}
              className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                activeFilter === "ping"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              {pingSummary.totalPacketsLost > 0 ? (
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
              ) : (
                <Activity className="w-3 h-3 shrink-0" />
              )}
              <span className="truncate">Ping ({pingSummary.formattedRate})</span>
              {pingSummary.totalPacketsLost > 0 && (
                <span
                  className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"
                  title={`${pingSummary.totalPacketsLost} packets lost`}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleStatusTabClick("all")}
              className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                activeFilter === "all"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <Layers className="w-3 h-3 shrink-0" />
              <span className="truncate">All ({enrichedLinks.length})</span>
            </button>
          </div>

          {/* Controls below status tabs: either Ping Controls or Time Filter */}
          {activeFilter === "ping" ? (
            <div className="space-y-2 pt-0.5">
              {/* Mini Ping Summary Banner */}
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                  isDark ? "bg-gray-800/80 border-gray-700/60" : "bg-gray-100/80 border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded-lg ${pingSummary.totalPacketsLost > 0 ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}>
                    {pingSummary.totalPacketsLost > 0 ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <Activity className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100 flex-wrap">
                      <span>{pingSummary.formattedRate}</span>
                      <span className="text-[11px] font-normal text-gray-400 font-mono">
                        ({pingSummary.formattedPackets} received)
                      </span>
                      {pingSummary.totalPacketsLost > 0 && (
                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{pingSummary.totalPacketsLost} lost ({pingSummary.formattedLossRate || (pingSummary.overallLossRate < 0.1 ? "<0.1%" : `${pingSummary.overallLossRate}%`)})</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">
                      {pingSummary.healthyCount} Healthy • {pingSummary.degradedCount} Degraded (Loss) • {pingSummary.downCount} Offline
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPingModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1 shadow-sm"
                >
                  <span>Summary Report</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* Sub-filters for Ping */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 shrink-0">
                  Filter:
                </span>
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 flex-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => handlePingSubFilterClick("all")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      pingSubFilter === "all"
                        ? "bg-blue-600 text-white shadow-xs"
                        : isDark
                        ? "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                  >
                    All ({pingSummary.monitoredCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePingSubFilterClick("issues")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      pingSubFilter === "issues"
                        ? "bg-amber-600 text-white shadow-xs"
                        : isDark
                        ? "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                  >
                    Packet Loss ({pingSummary.problemLinks.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePingSubFilterClick("healthy")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      pingSubFilter === "healthy"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : isDark
                        ? "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                  >
                    100% Healthy ({pingSummary.healthyCount})
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Time Filter Bar */
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3 text-gray-400" />
                Time:
              </span>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none flex-1">
                {[
                  { id: "24h", label: "≤ 24h" },
                  { id: "7d", label: "≤ 1 Week" },
                  { id: "30d", label: "≤ 1 Month" },
                  ...(activeFilter === "all"
                    ? [{ id: "72h_ospf", label: "OSPF Drops (72h)" }]
                    : []),
                ].map((opt) => {
                  const isSelected = timeFilter === opt.id;
                  const isOspf = opt.id === "72h_ospf";
                  const displayLabel = opt.label;
                  
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        if (timeFilter === opt.id) {
                          handleTimeFilterClick(null); // toggle off
                        } else {
                          handleTimeFilterClick(opt.id);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap flex items-center justify-center ${
                        isSelected
                          ? isOspf
                            ? "bg-amber-600 text-white shadow-sm font-semibold ring-1 ring-amber-400/50"
                            : "bg-blue-600 text-white shadow-sm font-semibold"
                          : isOspf
                          ? isDark
                            ? "bg-amber-950/40 text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 border border-amber-800/40"
                            : "bg-amber-50 text-amber-700 hover:text-amber-900 hover:bg-amber-100 border border-amber-200"
                          : isDark
                          ? "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                          : "bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                      }`}
                    >
                      <span>{displayLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by device, zone, IP..."
                className={`w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border outline-none transition-all ${
                  isDark
                    ? "bg-gray-800/80 border-gray-700 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Advanced API Filters for All tab */}
          {activeFilter === "all" && (
            <div className="grid grid-cols-3 gap-2 mt-1">
              <select
                value={apiEventType}
                onChange={(e) => setApiEventType(e.target.value)}
                className={`text-[11px] p-1.5 rounded-lg border outline-none ${
                  isDark
                    ? "bg-gray-800/80 border-gray-700 text-gray-100 focus:border-blue-500"
                    : "bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500"
                }`}
              >
                <option value="">All Types</option>
                <option value="link_up">Link Up</option>
                <option value="link_down">Link Down</option>
                <option value="ospf_full">OSPF Full</option>
                <option value="ospf_recovery">OSPF Recovery</option>
                <option value="ospf_drop">OSPF Drop</option>
              </select>
              <select
                value={apiLocalDevice}
                onChange={(e) => setApiLocalDevice(e.target.value)}
                className={`text-[11px] p-1.5 rounded-lg border outline-none ${
                  isDark
                    ? "bg-gray-800/80 border-gray-700 text-gray-100 focus:border-blue-500"
                    : "bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500"
                }`}
              >
                <option value="">Local Device (Any)</option>
                {deviceFilterOptions.filter(d => d.id !== "all").map((dev) => (
                  <option key={`local-${dev.id}`} value={dev.id}>
                    {dev.label}
                  </option>
                ))}
              </select>
              <select
                value={apiRemoteDevice}
                onChange={(e) => setApiRemoteDevice(e.target.value)}
                className={`text-[11px] p-1.5 rounded-lg border outline-none ${
                  isDark
                    ? "bg-gray-800/80 border-gray-700 text-gray-100 focus:border-blue-500"
                    : "bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500"
                }`}
              >
                <option value="">Remote Device (Any)</option>
                {deviceFilterOptions.filter(d => d.id !== "all").map((dev) => (
                  <option key={`remote-${dev.id}`} value={dev.id}>
                    {dev.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* --- Content Area (Scrollable) --- */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none p-3 space-y-2.5">
          {activeFilter === "all" ? (
            /* ===== EVENT LOG for the "All" tab ===== */
            eventsLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Loading events...</span>
                </div>
              </div>
            ) : statusEvents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-gray-100 dark:bg-gray-800 text-gray-400">
                  <Activity className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  No Status Changes
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[240px]">
                  No link status changes were recorded in the selected time window.
                </p>
              </div>
            ) : (
              (() => {
                const filteredEvents = statusEvents.filter((event) => {
                  if (!searchQuery.trim()) return true;
                  const queryWords = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);

                  const localDevIp =
                    (event.local_device_name ? deviceIpMap.get(String(event.local_device_name).toLowerCase()) : null) ||
                    (event.local_device_id != null ? deviceIpMap.get(String(event.local_device_id)) : null);
                  const remoteDevIp =
                    (event.remote_device_name ? deviceIpMap.get(String(event.remote_device_name).toLowerCase()) : null) ||
                    (event.remote_device_id != null ? deviceIpMap.get(String(event.remote_device_id)) : null);

                  const relatedLink = findCanonicalLinkForEvent(event);

                  const searchableEventText = [
                    event.local_device_name,
                    event.remote_device_name,
                    event.local_interface,
                    event.remote_interface,
                    event.event_type,
                    String(event.link_id || ""),
                    // Device IP addresses
                    localDevIp,
                    remoteDevIp,
                    // Canonical link metadata
                    relatedLink?.sourceName,
                    relatedLink?.targetName,
                    relatedLink?.sourceZone,
                    relatedLink?.targetZone,
                    relatedLink?.description,
                    relatedLink?.local_interface_description,
                    relatedLink?.local_interface,
                    relatedLink?.remote_interface,
                    ...(relatedLink?.allInterfaces || []),
                    relatedLink?.local_link_ip,
                    relatedLink?.local_ip,
                    relatedLink?.remote_link_ip,
                    relatedLink?.remote_ip,
                    relatedLink?.destinationIp,
                    relatedLink?.local_device_ip,
                    relatedLink?.remote_device_ip,
                  ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                  return queryWords.every((word) => searchableEventText.includes(word));
                });

                // Group all events by unified canonical link to prevent duplicate & inconsistent entries
                const groupsById = {};

                filteredEvents.forEach((event) => {
                  const canonicalLink = findCanonicalLinkForEvent(event);

                  let groupId;
                  let deviceName;
                  let remoteDeviceName;
                  let localDeviceIp;
                  let remoteDeviceIp;
                  let iface;
                  let remoteIface;
                  let isVisibleOnMap;
                  let fullLink = canonicalLink || null;

                  if (canonicalLink) {
                    groupId = `link-${canonicalLink.id}`;
                    deviceName = canonicalLink.sourceName;
                    remoteDeviceName = canonicalLink.targetName;
                    localDeviceIp = canonicalLink.local_device_ip || getDeviceIp(canonicalLink.sourceName);
                    remoteDeviceIp = canonicalLink.remote_device_ip || getDeviceIp(canonicalLink.targetName);
                    iface = canonicalLink.local_interface;
                    remoteIface = canonicalLink.remote_interface;
                    isVisibleOnMap = Boolean(canonicalLink.isVisibleOnMap);
                  } else {
                    // Unmapped link (not present in current chart's topology)
                    const d1 = event.local_device_name || "";
                    const d2 = event.remote_device_name || "";
                    const isSorted = d1.localeCompare(d2) <= 0;
                    const canD1 = isSorted ? d1 : d2;
                    const canD2 = isSorted ? d2 : d1;
                    const if1 = isSorted ? event.local_interface : event.remote_interface;
                    const if2 = isSorted ? event.remote_interface : event.local_interface;

                    const normIf1 = normalizeInterfaceName(if1);
                    const normIf2 = normalizeInterfaceName(if2);
                    // If both interfaces are specified, include them; otherwise key by device pair to avoid directional splits
                    const ifSuffix = (normIf1 && normIf2) ? `-${normIf1}-${normIf2}` : "";
                    groupId = `unmapped-${canD1.toLowerCase()}---${canD2.toLowerCase()}${ifSuffix}`;
                    deviceName = canD1;
                    remoteDeviceName = canD2;
                    localDeviceIp = getDeviceIp(canD1);
                    remoteDeviceIp = getDeviceIp(canD2);
                    iface = if1;
                    remoteIface = if2;
                    isVisibleOnMap = false;
                  }
                  if (!groupsById[groupId]) {
                    groupsById[groupId] = {
                      linkId: canonicalLink?.id || groupId,
                      groupId,
                      deviceName,
                      remoteDeviceName,
                      localDeviceIp,
                      remoteDeviceIp,
                      interface: iface,
                      remoteInterface: remoteIface,
                      isVisibleOnMap,
                      fullLink,
                      rawEvents: [],
                    };
                  } else {
                    // Update interface / remoteInterface if newly discovered from reciprocal event
                    if (!groupsById[groupId].interface && iface) {
                      groupsById[groupId].interface = iface;
                    }
                    if (!groupsById[groupId].remoteInterface && remoteIface) {
                      groupsById[groupId].remoteInterface = remoteIface;
                    }
                  }

                  groupsById[groupId].rawEvents.push(event);
                });

                const getEventTimestamp = (e) => {
                  const t = e.created_at || e.changed_at;
                  if (!t) return 0;
                  const d = new Date(t);
                  return isNaN(d.getTime()) ? 0 : d.getTime();
                };

                // Deduplicate and sort events within each canonical group
                const allGroups = Object.values(groupsById).map((group) => {
                  const sortedEvents = [...group.rawEvents].sort(
                    (a, b) => getEventTimestamp(b) - getEventTimestamp(a)
                  );

                  const deduplicatedEvents = [];

                  sortedEvents.forEach((ev) => {
                    const evTime = getEventTimestamp(ev);
                    const evType = (ev.event_type || "").toLowerCase();

                    // Check for duplicate event (e.g. reciprocal endpoint logging the same transition at same time)
                    const existingIndex = deduplicatedEvents.findIndex((existing) => {
                      if (ev.id != null && existing.id != null && ev.id === existing.id) {
                        return true;
                      }

                      const existingTime = getEventTimestamp(existing);
                      const existingType = (existing.event_type || "").toLowerCase();

                      // Same event type within 60s
                      if (evType === existingType && Math.abs(evTime - existingTime) <= 60000) {
                        if (evType.startsWith("ospf")) {
                          const evState = ev.new_ospf_state || ev.old_ospf_state;
                          const exState = existing.new_ospf_state || existing.old_ospf_state;
                          return !evState || !exState || evState === exState;
                        }
                        return true;
                      }
                      return false;
                    });

                    if (existingIndex >= 0) {
                      // Enrich existing with any extra details from this reciprocal event
                      const existing = deduplicatedEvents[existingIndex];
                      if (!existing.details && ev.details) existing.details = ev.details;
                      if (!existing.old_ospf_state && ev.old_ospf_state) existing.old_ospf_state = ev.old_ospf_state;
                      if (!existing.new_ospf_state && ev.new_ospf_state) existing.new_ospf_state = ev.new_ospf_state;
                    } else {
                      deduplicatedEvents.push(ev);
                    }
                  });

                  return {
                    ...group,
                    events: deduplicatedEvents,
                  };
                });

                const visibleGroupedEvents = allGroups.filter((group) => group.isVisibleOnMap);
                const notVisibleGroupedEvents = allGroups.filter((group) => !group.isVisibleOnMap);

                const handleInspectGroup = (group) => {
                  if (group.fullLink) {
                    const payload = createLinkPopupPayload(group.fullLink) || group.fullLink;
                    onLinkClick?.(payload);
                  } else {
                    const fallbackData = {
                      id: group.linkId,
                      sourceName: group.deviceName,
                      targetName: group.remoteDeviceName,
                      sourceNode: group.deviceName,
                      targetNode: group.remoteDeviceName,
                      local_interface: group.interface,
                      remote_interface: group.remoteInterface,
                      statusChangedAt: group.events[0]?.created_at,
                      category: "issue",
                      status: "issue",
                    };
                    const payload = createLinkPopupPayload(fallbackData) || fallbackData;
                    onLinkClick?.(payload);
                  }
                };

                return (
                  <>
                    {visibleGroupedEvents.length > 0 && (
                      <div className="mb-4 space-y-2.5">
                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                          Visible on Map
                        </h4>
                        {visibleGroupedEvents.map((group) => (
                          <EventLinkCard
                            key={group.groupId || group.linkId}
                            group={group}
                            isExpanded={expandedEventLinks.has(group.groupId || group.linkId)}
                            onToggle={() => {
                              setExpandedEventLinks((prev) => {
                                const next = new Set(prev);
                                const gId = group.groupId || group.linkId;
                                if (next.has(gId)) next.delete(gId);
                                else next.add(gId);
                                return next;
                              });
                            }}
                            onInspect={() => handleInspectGroup(group)}
                            onShowInZone={() => handleShowInZone(group.fullLink || group)}
                            isDark={isDark}
                          />
                        ))}
                      </div>
                    )}

                    {visibleGroupedEvents.length > 0 && notVisibleGroupedEvents.length > 0 && (
                      <div className="my-4 border-t border-gray-200 dark:border-gray-700"></div>
                    )}

                    {notVisibleGroupedEvents.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                          Not Shown on Map
                        </h4>
                        {notVisibleGroupedEvents.map((group) => (
                          <EventLinkCard
                            key={group.groupId || group.linkId}
                            group={group}
                            isExpanded={expandedEventLinks.has(group.groupId || group.linkId)}
                            onToggle={() => {
                              setExpandedEventLinks((prev) => {
                                const next = new Set(prev);
                                const gId = group.groupId || group.linkId;
                                if (next.has(gId)) next.delete(gId);
                                else next.add(gId);
                                return next;
                              });
                            }}
                            onInspect={() => handleInspectGroup(group)}
                            onShowInZone={() => handleShowInZone(group.fullLink || group)}
                            isDark={isDark}
                          />
                        ))}
                      </div>
                    )}
                  </>
                );
              })()
            )
          ) : (
            /* ===== STANDARD LINK CARDS for Up/Down/Issue tabs ===== */
            filteredLinks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                    activeFilter === "down"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : activeFilter === "issue"
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                  }`}
                >
                  {activeFilter === "down" || activeFilter === "issue" ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <Search className="w-6 h-6" />
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {activeFilter === "down"
                    ? "No Down Links Detected"
                    : activeFilter === "issue"
                    ? "No Issue Links Detected"
                    : activeFilter === "ping"
                    ? (pingSubFilter === "issues" ? "No Packet Loss Detected" : "No Ping Telemetry Found")
                    : searchQuery
                    ? "No Matching Links Found"
                    : timeFilter
                    ? "No Links in Selected Timeframe"
                    : "No Links Available"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[240px]">
                  {activeFilter === "down"
                    ? "All chart links are currently healthy and operational."
                    : activeFilter === "issue"
                    ? "There are no links with issues on the chart."
                    : activeFilter === "ping"
                    ? (pingSubFilter === "issues" ? "All active monitored lines are delivering 100% of packets." : "No link matches your current ping filter.")
                    : searchQuery
                    ? `No links matched your query "${searchQuery}".`
                    : timeFilter
                    ? "No links matched the selected time range. Try clearing the time filter."
                    : "No links found for the selected category."}
                </p>
                {timeFilter && (
                  <button
                    type="button"
                    onClick={() => setTimeFilter(null)}
                    className="mt-3 px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-sm"
                  >
                    Clear Time Filter
                  </button>
                )}
              </div>
            ) : (
              (() => {
                const visibleFilteredLinks = filteredLinks.filter(l => l.isVisibleOnMap);
                const notVisibleFilteredLinks = filteredLinks.filter(l => !l.isVisibleOnMap);
                
                const renderStandardLinkCard = (link) => {
                  const isLinkUp = link.normalizedStatus === "up";
                  const isLinkIssue = link.normalizedStatus === "issue";
                  const isLinkDown =
                    link.normalizedStatus === "down" ||
                    link.status === "down" ||
                    link.category === "down";
                  const isNotShownOnMap = !link.isVisibleOnMap;
                  const isLinkMarked = markedLinkIds && markedLinkIds.has(link.id);

                  return (
                    <div
                      key={link.id || `${link.sourceName}-${link.targetName}`}
                      onMouseEnter={() => onHoverLink?.(link.id)}
                      onMouseLeave={() => onHoverLink?.(null)}
                      onClick={() => {
                        if (onLinkClick) {
                          const payload = createLinkPopupPayload(link) || {
                            ...link,
                            sourceNode: link.sourceName,
                            targetNode: link.targetName,
                          };
                          onLinkClick(payload);
                        }
                      }}
                      className={`group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                        isLinkMarked
                          ? isDark
                            ? "bg-amber-950/20 border-amber-500/70 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/50"
                            : "bg-amber-50/70 border-amber-300 shadow-md shadow-amber-200/50 ring-1 ring-amber-400/50"
                          : isDark
                          ? "bg-gray-800/60 hover:bg-gray-800 border-gray-700/60 hover:border-gray-600"
                          : "bg-white hover:bg-gray-50/80 border-gray-200/80 hover:border-gray-300 shadow-sm"
                      }`}
                    >
                      {/* Card Top: Status & Duration & Mark Button */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {/* Status badge */}
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span
                              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                isLinkUp
                                  ? "bg-emerald-400"
                                  : isLinkIssue
                                  ? "bg-amber-400"
                                  : "bg-rose-400"
                              }`}
                            />
                            <span
                              className={`relative inline-flex rounded-full h-2 w-2 ${
                                isLinkUp
                                  ? "bg-emerald-500"
                                  : isLinkIssue
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                            />
                          </span>
                          <span
                            className={`text-xs font-bold uppercase tracking-wider ${
                              isLinkUp
                                ? "text-emerald-600 dark:text-emerald-400"
                                : isLinkIssue
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isLinkUp ? "UP" : isLinkIssue ? "ISSUE" : "DOWN"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Duration */}
                          <div
                            title={
                              link.exactTimeStr
                                ? `Status change: ${link.exactTimeStr}`
                                : undefined
                            }
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              isLinkUp
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                : isLinkIssue
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                            }`}
                          >
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span>
                              {isLinkUp ? "Up" : isLinkIssue ? "Issue" : "Down"} for{" "}
                              <strong className="font-semibold">{link.durationStr}</strong>
                            </span>
                          </div>

                          {/* Mark on chart button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onToggleMarkLink) onToggleMarkLink(link.id);
                            }}
                            title={isLinkMarked ? "Unmark from chart" : "Mark link on chart"}
                            className={`p-1 rounded-md transition-colors ${
                              isLinkMarked
                                ? "bg-amber-500 text-white shadow-sm"
                                : "text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Middle: Source ⟷ Target */}
                      <div className="flex items-center justify-between text-xs font-semibold py-1">
                        <div className="flex flex-col min-w-0 pr-2">
                          <span
                            className="truncate text-gray-800 dark:text-gray-100 font-mono"
                            title={link.local_device_ip ? `${link.sourceName} (${link.local_device_ip})` : link.sourceName}
                          >
                            {link.sourceName}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 truncate">
                            {link.sourceZone && <span className="truncate">{link.sourceZone}</span>}
                            {link.sourceZone && link.local_device_ip && <span>•</span>}
                            {link.local_device_ip && (
                              <span className="font-mono text-gray-400 dark:text-gray-500" title={`Device IP: ${link.local_device_ip}`}>
                                {link.local_device_ip}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-gray-400 dark:text-gray-500 px-1 font-mono text-[10px]">
                          ⟷
                        </div>

                        <div className="flex flex-col min-w-0 pl-2 text-right">
                          <span
                            className="truncate text-gray-800 dark:text-gray-100 font-mono"
                            title={link.remote_device_ip ? `${link.targetName} (${link.remote_device_ip})` : link.targetName}
                          >
                            {link.targetName}
                          </span>
                          <div className="flex items-center justify-end gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 truncate">
                            {link.remote_device_ip && (
                              <span className="font-mono text-gray-400 dark:text-gray-500" title={`Device IP: ${link.remote_device_ip}`}>
                                {link.remote_device_ip}
                              </span>
                            )}
                            {link.targetZone && link.remote_device_ip && <span>•</span>}
                            {link.targetZone && <span className="truncate">{link.targetZone}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Card Bottom: Ping info & Inspect button */}
                      <div
                        className={`mt-2 pt-2 border-t flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 ${
                          isDark ? "border-gray-700/50" : "border-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {(() => {
                            const pInfo = formatPingRateWithPackets(link);
                            if (!pInfo) return null;
                            const numRate = pInfo.rate;
                            const packetsLost = pInfo.packetsLost ?? (numRate < 100 ? 1 : 0);
                            const hasLoss = packetsLost > 0 || numRate < 100;
                            const isDown = numRate === 0;
                            const lastPing = link.last_ping_at || link.rawLink?.last_ping_at;
                            return (
                              <span
                                className={`inline-flex items-center gap-1 font-semibold ${
                                  isDown
                                    ? "text-rose-600 dark:text-rose-400"
                                    : hasLoss
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                                title={lastPing ? `Last ping: ${lastPing} • ${pInfo.full}${hasLoss ? ` • ${packetsLost} packet(s) lost!` : ""}` : `${pInfo.full}${hasLoss ? ` • ${packetsLost} packet(s) lost!` : ""}`}
                              >
                                {hasLoss && !isDown ? (
                                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                ) : (
                                  <Activity className="w-3 h-3 shrink-0" />
                                )}
                                <span>Ping: {pInfo.short}</span>
                                {hasLoss && !isDown && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                    {packetsLost} lost
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {isLinkDown && isNotShownOnMap && (
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShowInZone(link);
                              }}
                              title={`Show in ${link.targetZone || link.sourceZone || "zone"}`}
                              className="flex items-center gap-1 text-sky-500 dark:text-sky-400 font-medium hover:underline cursor-pointer"
                            >
                              <Compass className="w-3 h-3" />
                              <span>Show in zone</span>
                            </div>
                          )}

                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onLinkClick) {
                                const payload = createLinkPopupPayload(link) || {
                                  ...link,
                                  sourceNode: link.sourceName,
                                  targetNode: link.targetName,
                                };
                                onLinkClick(payload);
                              }
                            }}
                            className="flex items-center gap-1 text-blue-500 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {visibleFilteredLinks.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Visible on Map</h4>
                        {visibleFilteredLinks.map(renderStandardLinkCard)}
                      </div>
                    )}
                    
                    {visibleFilteredLinks.length > 0 && notVisibleFilteredLinks.length > 0 && (
                      <div className="my-4 border-t border-gray-200 dark:border-gray-700"></div>
                    )}
                    
                    {notVisibleFilteredLinks.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Not Shown on Map</h4>
                        {notVisibleFilteredLinks.map(renderStandardLinkCard)}
                      </div>
                    )}
                  </>
                );
              })()
              )
            )}
        </div>
      </aside>

      {/* Ping Summary Modal */}
      <PingSummaryModal
        isOpen={isPingModalOpen}
        onClose={() => setIsPingModalOpen(false)}
        pingSummary={pingSummary}
        chartName={chartName}
        onSelectLink={(link) => {
          setIsPingModalOpen(false);
          onLinkClick?.(link);
        }}
        onOpenDrawerToPing={() => {
          setIsPingModalOpen(false);
          setIsOpen(true);
          setActiveFilter("ping");
          const matching = getMatchingLinks("ping", timeFilter);
          onMarkAll?.(matching.map((l) => l.id));
        }}
        theme={theme}
      />

      {/* Frequent Link Drops (>= 10 link down in 24h) Popup Modal */}
      <FrequentLinkDropsModal
        isOpen={isDropsModalOpen}
        onClose={() => setIsDropsModalOpen(false)}
        frequentDropLinks={frequentDropLinks}
        lastChecked={lastDropsCheckTime}
        theme={theme}
        onInspectLink={(linkData) => {
          setIsDropsModalOpen(false);
          if (onLinkClick) {
            const payload = createLinkPopupPayload(linkData) || linkData;
            onLinkClick(payload);
          }
        }}
        onOpenDrawer={() => {
          setIsOpen(true);
          setActiveFilter("all");
        }}
      />
    </>
  );
}

