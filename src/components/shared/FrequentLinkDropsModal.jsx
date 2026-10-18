import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  AlertTriangle,
  Clock,
  ArrowRight,
  Search,
  ExternalLink,
  ChevronDown,
  Layers,
  RefreshCw,
} from "lucide-react";

/**
 * Formats elapsed time since a given date into a human readable duration string.
 */
function formatDuration(timestamp) {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "N/A";

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

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

function formatExactTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * FrequentLinkDropsModal
 *
 * Displays a popup alert when any network line has experienced at least 10 link down events
 * in the last 24 hours. The popup lists all such links, their drop counts, endpoints,
 * interfaces, and provides inspect/detail interactions.
 */
export default function FrequentLinkDropsModal({
  isOpen,
  onClose,
  frequentDropLinks = [],
  onInspectLink,
  onOpenDrawer,
  lastChecked,
  theme = "light",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLinkKeys, setExpandedLinkKeys] = useState(new Set());

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const isDark = theme === "dark";

  // Filter links based on search query
  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) return frequentDropLinks;
    const q = searchQuery.toLowerCase().trim();
    return frequentDropLinks.filter((link) => {
      const searchableFields = [
        link.sourceName,
        link.targetName,
        link.localInterface,
        link.remoteInterface,
        link.localDeviceIp,
        link.remoteDeviceIp,
        String(link.dropCount),
        String(link.linkId || ""),
      ];
      return searchableFields.some(
        (field) => field && String(field).toLowerCase().includes(q)
      );
    });
  }, [frequentDropLinks, searchQuery]);

  const toggleExpand = (key) => {
    setExpandedLinkKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Light dismiss Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="frequent-drops-title"
        className={`relative w-full max-w-2xl rounded-2xl shadow-2xl border transition-all duration-200 overflow-hidden flex flex-col max-h-[90vh] select-text z-10 ${
          isDark
            ? "bg-gray-900 border-gray-800 text-gray-100"
            : "bg-white border-gray-200 text-gray-900"
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-5 border-b flex-shrink-0 flex items-start justify-between gap-3 ${
            isDark
              ? "border-gray-800 bg-gray-900/80"
              : "border-gray-100 bg-rose-50/40"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="frequent-drops-title"
                  className="text-base sm:text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100"
                >
                  Frequent Link Down Events Alert
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs">
                  {frequentDropLinks.length}{" "}
                  {frequentDropLinks.length === 1 ? "Line Flagged" : "Lines Flagged"}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                The following network line(s) have experienced at least{" "}
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  10 link down events
                </span>{" "}
                in the last 24 hours.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Close popup (Esc)"
            className={`p-2 rounded-xl transition-colors shrink-0 ${
              isDark
                ? "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar (when multiple links are flagged) */}
        {frequentDropLinks.length > 1 && (
          <div
            className={`p-3 sm:px-5 border-b flex-shrink-0 ${
              isDark ? "border-gray-800 bg-gray-900/50" : "border-gray-100 bg-gray-50/50"
            }`}
          >
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by device, interface, or IP..."
                className={`w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border outline-none transition-all ${
                  isDark
                    ? "bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
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
        )}

        {/* Scrollable Link List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredLinks.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3 bg-gray-100 dark:bg-gray-800 text-gray-400">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                No matching links found
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                No links match your search query "{searchQuery}".
              </p>
            </div>
          ) : (
            filteredLinks.map((link) => {
              const isExpanded = expandedLinkKeys.has(link.key || link.linkId);

              // Deduplicate reciprocal events from both sides of the line (Device 1 and Device 2)
              const events = (() => {
                if (!Array.isArray(link.events) || link.events.length === 0) return [];
                const sorted = [...link.events].sort((a, b) => {
                  const ta = new Date(a.created_at || a.changed_at || a.timestamp || 0).getTime();
                  const tb = new Date(b.created_at || b.changed_at || b.timestamp || 0).getTime();
                  return tb - ta;
                });
                const deduped = [];
                sorted.forEach((ev) => {
                  const evTime = new Date(ev.created_at || ev.changed_at || ev.timestamp || 0).getTime();
                  const isDup = deduped.some((existing) => {
                    if (ev.id != null && existing.id != null && ev.id === existing.id) return true;
                    const exTime = new Date(
                      existing.created_at || existing.changed_at || existing.timestamp || 0
                    ).getTime();
                    return evTime > 0 && exTime > 0 && Math.abs(evTime - exTime) <= 60000;
                  });
                  if (!isDup) deduped.push(ev);
                });
                return deduped;
              })();

              const eventCount = events.length || link.dropCount;
              const lastDownFormatted = link.lastDropTime
                ? formatDuration(link.lastDropTime)
                : (events[0] ? formatDuration(events[0].created_at || events[0].changed_at) : null);
              const lastDownExact = link.lastDropTime
                ? formatExactTime(link.lastDropTime)
                : (events[0] ? formatExactTime(events[0].created_at || events[0].changed_at) : null);

              return (
                <div
                  key={link.key || link.linkId}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                    isDark
                      ? "bg-gray-800/70 border-rose-900/50 hover:border-rose-700/80 shadow-md shadow-black/20"
                      : "bg-white border-rose-200 hover:border-rose-300 shadow-sm"
                  }`}
                >
                  {/* Card Main Row */}
                  <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Endpoints & Drop Badge */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-gray-100">
                          <span
                            className="font-mono truncate"
                            title={
                              link.localDeviceIp
                                ? `${link.sourceName} (${link.localDeviceIp})`
                                : link.sourceName
                            }
                          >
                            {link.sourceName}
                          </span>
                          <span className="text-gray-400 font-mono text-[10px]">
                            ⟷
                          </span>
                          <span
                            className="font-mono truncate"
                            title={
                              link.remoteDeviceIp
                                ? `${link.targetName} (${link.remoteDeviceIp})`
                                : link.targetName
                            }
                          >
                            {link.targetName}
                          </span>
                        </div>

                        {/* Drop count badge */}
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          <span>{eventCount} down events</span>
                        </span>

                        {link.isVisibleOnMap && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                            Visible on Map
                          </span>
                        )}
                      </div>

                      {/* Interfaces & IPs */}
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {link.localInterface &&
                          link.remoteInterface &&
                          link.localInterface !== link.remoteInterface
                            ? `${link.localInterface} ⟷ ${link.remoteInterface}`
                            : link.localInterface ||
                              link.remoteInterface ||
                              "Unknown Interface"}
                        </span>
                        {(link.localDeviceIp || link.remoteDeviceIp) && (
                          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                            ({link.localDeviceIp || "N/A"} ⟷{" "}
                            {link.remoteDeviceIp || "N/A"})
                          </span>
                        )}
                      </div>

                      {/* Last Drop Timestamp */}
                      {lastDownFormatted && (
                        <div
                          className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1"
                          title={lastDownExact}
                        >
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>
                            Most recent down:{" "}
                            <strong className="font-semibold">
                              {lastDownFormatted} ago
                            </strong>{" "}
                            ({lastDownExact})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {/* Inspect Link Details Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (onInspectLink) {
                            onInspectLink(link.canonicalLink || link);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs ${
                          isDark
                            ? "bg-gray-700 hover:bg-gray-600 text-gray-100"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        }`}
                        title="Inspect detailed telemetry and history for this link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>

                      {/* Expand / Collapse Drop Events Toggle */}
                      {events && events.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(link.key || link.linkId)}
                          className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                            isExpanded
                              ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                              : isDark
                              ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                              : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                          }`}
                          title={
                            isExpanded ? "Hide events list" : "Show all down events"
                          }
                          aria-expanded={isExpanded}
                        >
                          <span>{events.length}</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Drop Events List */}
                  {isExpanded && events && events.length > 0 && (
                    <div
                      className={`p-3 border-t text-xs space-y-1.5 ${
                        isDark
                          ? "bg-gray-900/60 border-gray-700/60"
                          : "bg-gray-50/80 border-gray-100"
                      }`}
                    >
                      <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                        Recent Link Down Transitions ({events.length} Total)
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {events.map((ev, idx) => {
                          const evTime = ev.created_at || ev.changed_at;
                          const evDuration = formatDuration(evTime);
                          const evExact = formatExactTime(evTime);
                          const reason =
                            ev.details?.reason ||
                            "Interface link down (carrier lost)";

                          return (
                            <div
                              key={ev.id ?? `${evTime}-${idx}`}
                              className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                                isDark
                                  ? "bg-gray-800/80 border-gray-700/80"
                                  : "bg-white border-gray-200"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                <span className="font-semibold text-rose-600 dark:text-rose-400 text-[11px]">
                                  LINK DOWN
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                  {reason}
                                </span>
                              </div>
                              <div
                                title={evExact}
                                className="flex items-center gap-1 font-mono text-[10px] text-gray-400 dark:text-gray-500 shrink-0"
                              >
                                <span>{evDuration} ago</span>
                                <span>•</span>
                                <span>{evExact}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`p-3.5 sm:px-5 border-t flex-shrink-0 flex items-center justify-between gap-3 ${
            isDark ? "border-gray-800 bg-gray-900/80" : "border-gray-100 bg-gray-50/80"
          }`}
        >
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {filteredLinks.length > 0 && (
              <span>
                Showing {filteredLinks.length} line
                {filteredLinks.length === 1 ? "" : "s"} with ≥10 drops
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenDrawer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDrawer();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                  isDark
                    ? "border-gray-700 hover:bg-gray-800 text-gray-300"
                    : "border-gray-300 hover:bg-gray-100 text-gray-700"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Open in Drawer</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
