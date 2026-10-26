import React, { useState, useEffect, useRef } from "react";
import { MdClose, MdArrowForward } from "react-icons/md";
import { AlertTriangle } from "lucide-react";
import { api, getLinkDetails } from "../../services/apiServices";
import { formatPingRateWithPackets } from "./pingHelpers";
// Remove CoreSiteTrafficBadge import if not used elsewhere

const formatDate = (dateStr) => {
  if (!dateStr || dateStr === "null") return "N/A";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
  } catch {
    return dateStr;
  }
};

/**
 * Parse bandwidth value to Mbps number
 */
const parseBandwidthToMbps = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") {
    if (value >= 1000) {
      return value;
    } else {
      return value * 1000;
    }
  }
  if (typeof value === "string") {
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue.includes('g')) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return num * 1000;
      }
    }
    if (lowerValue.includes('m')) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return num;
      }
    }
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return num >= 1000 ? num : num * 1000;
    }
  }
  return null;
};

/**
 * Parse bps value to Mbps number
 */
const parseBpsToMbps = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return null;

  // Large values (>= 10000) are likely in bps, convert to Mbps
  if (num >= 10000) {
    return num / 1e6;
  }

  // Small values (< 10000) are assumed to be in Kbps, convert to Mbps
  // 1 Kbps = 0.001 Mbps
  return num / 1e3;
};

/**
 * Format bps value to display with appropriate unit
 * Automatically selects the best unit based on magnitude
 */
const formatBpsDisplay = (value) => {
  if (value === undefined || value === null || value === "") return "N/A";
  if (typeof value === "string" && /[a-zA-Z]/.test(value)) return value;
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return "N/A";

  if (num === 0) return "0";

  const exp = Math.floor(Math.log10(Math.abs(num)));

  if (exp >= 9) {
    return `${(num / 1e9).toFixed(2)} G`;
  } else if (exp >= 6) {
    return `${(num / 1e6).toFixed(2)} M`;
  } else if (exp >= 3) {
    return `${(num / 1e3).toFixed(2)} k`;
  } else if (exp >= 0) {
    return `${num.toFixed(2)} Bytes`;
  } else {
    return `${(num * 1e3).toFixed(2)}`;
  }
};

const formatBps = formatBpsDisplay;

/** Format bandwidth to GB (from Mbps) */
const formatBandwidthGB = (value) => {
  const mbps = parseBandwidthToMbps(value);
  if (mbps === null) return null;
  const gbps = mbps / 1000;
  return `${gbps.toFixed(1)} G`;
};

/**
 * Get color for merged physical/oper status fields
 * Red if any value is "down" or "admin down", otherwise green
 */
const getMergedPhysicalStatusColor = (value1, value2, isDark = false) => {
  const val1Lower = String(value1 || "").toLowerCase();
  const val2Lower = String(value2 || "").toLowerCase();

  const isDown = (val) => {
    return (
      val === "down" ||
      val.includes("admin down") ||
      val.includes("admin_down") ||
      val === "disabled" ||
      val === "degraded"
    );
  };
  if (isDown(val1Lower) || isDown(val2Lower)) {
    return { textClass: "text-rose-600 dark:text-rose-400" };
  }
  const isUp = (val) => val === "up" || val === "enabled" || val === "ok";
  if (isUp(val1Lower) || isUp(val2Lower)) {
    return { textClass: "text-emerald-600 dark:text-emerald-400" };
  }
  return { textClass: isDark ? "text-gray-400" : "text-gray-600" };
};

/**
 * Get color for status fields
 */
const getStatusColor = (status, isDark = false) => {
  if (!status) return { textClass: isDark ? "text-gray-400" : "text-gray-600" };
  const statusLower = String(status).toLowerCase();
  if (statusLower === "up" || statusLower === "enabled" || statusLower === "ok") {
    return { textClass: "text-emerald-600 dark:text-emerald-400" };
  } else if (
    statusLower === "down" ||
    statusLower === "admin down" ||
    statusLower === "admin_down" ||
    statusLower === "disabled" ||
    statusLower === "degraded"
  ) {
    return { textClass: "text-rose-600 dark:text-rose-400" };
  } else {
    return { textClass: isDark ? "text-gray-400" : "text-gray-600" };
  }
};

/**
 * Get color for OSPF state
 */
const getOspfStateColor = (ospfState, isDark = false) => {
  if (!ospfState) return { textClass: isDark ? "text-gray-400" : "text-gray-600" };

  const stateLower = String(ospfState).toLowerCase();
  if (stateLower === "full" || stateLower === "established") {
    return { textClass: "text-emerald-600 dark:text-emerald-400" };
  } else if (stateLower === "down" || stateLower === "disabled") {
    return { textClass: "text-rose-600 dark:text-rose-400" };
  } else {
    return { textClass: isDark ? "text-gray-400" : "text-gray-600" };
  }
};

/**
 * Get color for ping success rate
 */
const getPingSuccessColor = (rate, isDark = false) => {
  if (rate === null || rate === undefined) {
    return { textClass: "text-rose-600 dark:text-rose-400" };
  }

  const rateNum = typeof rate === "number" ? rate : parseFloat(rate);
  if (isNaN(rateNum)) return { textClass: isDark ? "text-gray-400" : "text-gray-600" };

  if (rateNum === 100) {
    return { textClass: "text-emerald-600 dark:text-emerald-400" };
  } else if (rateNum >= 95) {
    return { textClass: "text-yellow-600 dark:text-yellow-400" };
  } else {
    return { textClass: "text-rose-600 dark:text-rose-400" };
  }
};

/**
 * Get color classes for bandwidth usage
 */
const getBandwidthUsageColors = (bpsValue, bandwidthValue, isDark = false) => {
  const bpsMbps = parseBpsToMbps(bpsValue);
  const bandwidthMbps = parseBandwidthToMbps(bandwidthValue);

  if (bpsMbps === null || bandwidthMbps === null || bandwidthMbps === 0) {
    return {
      textClass: isDark ? "text-gray-400" : "text-gray-600",
      bgClass: isDark ? "bg-gray-700" : "bg-gray-100",
      borderClass: isDark ? "border-gray-600" : "border-gray-300",
      usagePercent: null,
    };
  }

  const usagePercent = (bpsMbps / bandwidthMbps) * 100;

  if (usagePercent >= 80 || usagePercent === 100) {
    return {
      textClass: "text-rose-500 dark:text-rose-400",
      bgClass: "bg-rose-500/10 dark:bg-rose-500/20",
      borderClass: "border-rose-500/30",
      usagePercent,
    };
  } else if (usagePercent >= 60) {
    return {
      textClass: "text-orange-500 dark:text-orange-400",
      bgClass: "bg-orange-500/10 dark:bg-orange-500/20",
      borderClass: "border-orange-500/30",
      usagePercent,
    };
  } else if (usagePercent >= 50) {
    return {
      textClass: "text-yellow-500 dark:text-yellow-400",
      bgClass: "bg-yellow-500/10 dark:bg-yellow-500/20",
      borderClass: "border-yellow-500/30",
      usagePercent,
    };
  } else {
    return {
      textClass: "text-emerald-500 dark:text-emerald-400",
      bgClass: "bg-emerald-500/10 dark:bg-emerald-500/20",
      borderClass: "border-emerald-500/30",
      usagePercent,
    };
  }
};

/**
 * A reusable status indicator bulb.
 */
const StatusBulb = ({ status }) => {
  let bgColor = "bg-gray-400 dark:bg-gray-500";
  if (status === "up") bgColor = "bg-green-500 dark:green-400";
  else if (status === "down") bgColor = "bg-red-500 dark:bg-red-400";
  else if (status === "issue") bgColor = "bg-yellow-500 dark:bg-yellow-400";

  return (
    <div className={`w-3.5 h-3.5 rounded-full ${bgColor} flex-shrink-0`}></div>
  );
};

/**
 * A detail row used inside the popup.
 */
const DetailRow = ({ label, value, isDark, valueColorClass }) => (
  <div className="flex items-center justify-between py-2 px-1">
    <span
      className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}
    >
      {label}
    </span>
    <span className={`text-sm font-semibold ${valueColorClass || "text-white"}`}>
      {value !== undefined && value !== null && value !== "" ? value : "N/A"}
    </span>
  </div>
);

/**
 * Ping Config Modal / Popup
 */
export const PingConfigPopup = ({
  isOpen,
  onClose,
  itemData,
  onRunPing,
  theme,
}) => {
  const [repeat, setRepeat] = useState(10000);
  const [size, setSize] = useState(9000);
  const [dfBit, setDfBit] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [pingResults, setPingResults] = useState(null);
  const [pingError, setPingError] = useState(null);

  const isDark = theme === "dark";

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsRunning(true);
    setPingResults(null);
    setPingError(null);

    const config = {
      repeat: parseInt(repeat, 10),
      size: parseInt(size, 10),
      dfBit,
    };

    // Extract linkId from itemData
    const linkId = itemData?.id || itemData?.link_id || itemData?.rawLink?.id;

    console.log("🔍 linkId:", linkId);
    console.log("🔍 itemData:", itemData);
    console.log("🔍 api.executeManualPing exists:", typeof api?.executeManualPing);

    // Call the original onRunPing callback first
    if (onRunPing) {
      onRunPing(config, itemData);
    }

    // Try to run ping directly via API
    try {
      let results = null;

      if (linkId && api && typeof api.executeManualPing === "function") {
        const response = await api.executeManualPing(linkId, config);

        console.log("📥 Raw API Response:", response);

        // Extract results from response - handle different response formats
        if (response) {
          // Handle axios-style response with data property
          results = response.data || response.result || response;
        }

        console.log("📊 Processed Results:", results);
        setPingResults(results);
      } else {
        // Fallback: try other available methods
        if (api && typeof api.runPing === "function") {
          const results = await api.runPing({
            target: itemData?.ip || itemData?.remote_ip || itemData?.remote_device_ip,
            ...config,
          });
          setPingResults(results);
        } else if (api && typeof api.ping === "function") {
          const results = await api.ping({
            target: itemData?.ip || itemData?.remote_ip || itemData?.remote_device_ip,
            ...config,
          });
          setPingResults(results);
        } else {
          setPingError("Ping API method not available. Link ID: " + (linkId || "Not found"));
          setIsRunning(false);
          return;
        }
      }
    } catch (err) {
      console.error("❌ Ping execution error:", err);
      setPingError(err.message || "Failed to execute ping");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className={`relative w-full max-w-md p-6 rounded-2xl shadow-2xl border ${
          isDark
            ? "bg-gray-800 border-gray-700 text-gray-100"
            : "bg-white border-gray-200 text-gray-800"
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b mb-4">
          <h3 className="text-lg font-bold">Configure Ping</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* Ping Results Display */}
        {(pingResults || pingError) && !isRunning && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              pingError
                ? "bg-red-500/10 border border-red-500/30"
                : "bg-emerald-500/10 border border-emerald-500/30"
            }`}
          >
            {pingError ? (
              <div className="flex items-center gap-2">
                <AlertTriangle
                  size={16}
                  className={isDark ? "text-red-400" : "text-red-600"}
                />
                <span
                  className={`text-sm ${
                    isDark ? "text-red-300" : "text-red-600"
                  }`}
                >
                  {pingError}
                </span>
              </div>
            ) : pingResults ? (
              <div className="space-y-2">
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-semibold ${
                      isDark ? "text-emerald-400" : "text-emerald-600"
                    }`}
                  >
                    Success Rate
                  </span>
                  <span
                    className={`text-2xl font-bold ${
                      pingResults.ping_success_rate === 100
                        ? "text-emerald-500"
                        : "text-orange-500"
                    }`}
                  >
                    {pingResults.ping_success_rate}%
                  </span>
                </div>

                {/* Stats Row */}
                <div
                  className={`flex items-center justify-between text-xs ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  <span>
                    {pingResults.packets_received?.toLocaleString() || 0} /{" "}
                    {pingResults.packets_sent?.toLocaleString() || 0} packets
                  </span>
                  <span>{pingResults.packet_loss_rate || 0}% loss</span>
                </div>

                {/* RTT Row */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs ${
                      isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    RTT (min/avg/max)
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      isDark ? "text-gray-200" : "text-gray-800"
                    }`}
                  >
                    {pingResults.min_rtt_ms ?? "-"} /{" "}
                    {pingResults.avg_rtt_ms ?? "-"} /{" "}
                    {pingResults.max_rtt_ms ?? "-"} ms
                  </span>
                </div>

                {/* Duration Row */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs ${
                      isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Duration
                  </span>
                  <span
                    className={`text-xs ${
                      isDark ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {pingResults.duration_seconds
                      ? `${pingResults.duration_seconds.toFixed(1)} seconds`
                      : "-"}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase mb-1">
              Repeat (Count)
            </label>
            <input
              type="number"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${
                isDark
                  ? "bg-gray-700 border-gray-600"
                  : "bg-gray-50 border-gray-300"
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase mb-1">
              Packet Size (Bytes)
            </label>
            <input
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${
                isDark
                  ? "bg-gray-700 border-gray-600"
                  : "bg-gray-50 border-gray-300"
              }`}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dfBit"
              checked={dfBit}
              onChange={(e) => setDfBit(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="dfBit" className="text-sm">
              DF Bit (Don't Fragment)
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-sm rounded-lg ${
                isDark
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isRunning}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isRunning ? "Running..." : "Run Ping"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * A modal popup that displays link/site details.
 * Replaces the old tab-based LinkDetailTabs component.
 *
 * Props:
 * - linkData: The data object for the clicked link/site (or null to hide).
 * - linkType: "link" or "site"
 * - linkTitle: Display title for the popup header.
 * - onClose: Callback to close the popup.
 * - onNavigateToSite: Optional callback for site-type items.
 * - theme: "dark" or "light"
 */
const formatLastPing = (timestamp) => {
  if (!timestamp) return "N/A";
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return String(timestamp);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(timestamp);
  }
};

const LinkDetailPopup = ({
  linkData,
  linkType,
  linkTitle,
  onClose,
  onNavigateToSite,
  theme,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const popupRef = useRef(null);

  // Animate in on mount / data change
  useEffect(() => {
    if (linkData) {
      setIsClosing(false);
      requestAnimationFrame(() => setIsVisible(true));
    }
  }, [linkData]);

  // Close with animation
  const handleClose = () => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    if (linkData) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [linkData]);

  const [fetchedDetails, setFetchedDetails] = useState(null);
  const isDark = theme === "dark";
  const itemType = linkType || "link";

  useEffect(() => {
    setFetchedDetails(null);
    if (itemType === "link" && linkData && !linkData.skipFetch) {
      const { coredevice_id, neighbor_coredevice_id, local_interface } = linkData;

      const cid = coredevice_id || (linkData.rawLink && linkData.rawLink.coredevice_id);
      const ncid = neighbor_coredevice_id || (linkData.rawLink && linkData.rawLink.neighbor_coredevice_id);
      const name = local_interface || (linkData.rawLink && linkData.rawLink.local_interface);

      if (cid && ncid && name) {
        getLinkDetails(cid, ncid, name)
          .then(data => {
            if (data && data.length > 0) {
              setFetchedDetails(data[0]);
            }
          })
          .catch(err => console.error("Failed to fetch link details:", err));
      }
    }
  }, [linkData, itemType]);

  if (!linkData) return null;

  // Helper to get value from multiple sources
  const getValue = (...sources) => {
    for (const source of sources) {
      if (source !== undefined && source !== null && source !== "") {
        return source;
      }
    }
    return null;
  };

  const bandwidthMbps = parseBandwidthToMbps(
    getValue(
      fetchedDetails?.bw,
      fetchedDetails?.bandwidth,
      fetchedDetails?.bandwidth_mbps,
      fetchedDetails?.bandwidthMbps,
      linkData?.bandwidth,
      linkData?.bandwidth_mbps,
      linkData?.Bandwidth,
      linkData?.bandwidthMbps,
      linkData?.rawLink?.bandwidth,
      linkData?.rawLink?.bandwidth_mbps,
      linkData?.rawLink?.bw
    )
  );

  const inBps = getValue(
    fetchedDetails?.in_bps,
    fetchedDetails?.inBps,
    fetchedDetails?.bytes_in_rate,
    fetchedDetails?.input_rate,
    fetchedDetails?.in_rate,
    linkData?.in_bps,
    linkData?.inBps,
    linkData?.bytes_in_rate,
    linkData?.bytesIn,
    linkData?.input_rate,
    linkData?.in_rate,
    linkData?.rawLink?.in_bps,
    linkData?.rawLink?.inBps,
    linkData?.rawLink?.bytes_in_rate,
    linkData?.rawLink?.bytesIn,
    linkData?.rawLink?.input_rate,
    linkData?.rawLink?.in_rate
  );

  const outBps = getValue(
    fetchedDetails?.out_bps,
    fetchedDetails?.outBps,
    fetchedDetails?.bytes_out_rate,
    fetchedDetails?.output_rate,
    fetchedDetails?.out_rate,
    linkData?.out_bps,
    linkData?.outBps,
    linkData?.bytes_out_rate,
    linkData?.bytesOut,
    linkData?.output_rate,
    linkData?.out_rate,
    linkData?.rawLink?.out_bps,
    linkData?.rawLink?.outBps,
    linkData?.rawLink?.bytes_out_rate,
    linkData?.rawLink?.bytesOut,
    linkData?.rawLink?.output_rate,
    linkData?.rawLink?.out_rate
  );

  const bandwidthGB = formatBandwidthGB(
    getValue(
      fetchedDetails?.bw,
      fetchedDetails?.bandwidth,
      fetchedDetails?.bandwidth_mbps,
      fetchedDetails?.bandwidthMbps,
      linkData?.bandwidth,
      linkData?.bandwidth_mbps,
      linkData?.Bandwidth,
      linkData?.bandwidthMbps,
      linkData?.rawLink?.bandwidth,
      linkData?.rawLink?.bandwidth_mbps,
      linkData?.rawLink?.bw
    )
  );

  const inBpsColors = getBandwidthUsageColors(inBps, bandwidthMbps, isDark);
  const outBpsColors = getBandwidthUsageColors(outBps, bandwidthMbps, isDark);

  // Extract status values for merging
  const physicalStatusValue = getValue(
    linkData?.physicalStatus,
    linkData?.physical_status,
    fetchedDetails?.physical_status,
    linkData?.local_physical_status,
    linkData?.rawLink?.physical_status,
    linkData?.rawLink?.local_physical_status
  );

  const operStatusValue = getValue(
    linkData?.operStatus,
    linkData?.oper_status,
    fetchedDetails?.oper_status,
    linkData?.local_oper_status,
    linkData?.rawLink?.oper_status,
    linkData?.rawLink?.local_oper_status
  );

  const remotePhysicalStatusValue = getValue(
    linkData?.remotePhysicalStatus,
    linkData?.remote_physical_status,
    fetchedDetails?.remote_physical_status,
    linkData?.remote_physical_status,
    linkData?.rawLink?.remote_physical_status
  );

  const remoteOperStatusValue = getValue(
    linkData?.remoteOperStatus,
    linkData?.remote_oper_status,
    fetchedDetails?.remote_oper_status,
    linkData?.remote_oper_status,
    linkData?.rawLink?.remote_oper_status
  );

  // Merge Physical Status + Oper Status for Local
  const mergedLocalPhysicalStatus = [physicalStatusValue, operStatusValue]
    .filter((v) => v !== null && v !== undefined && v !== "")
    .join(" / ") || null;

  // Merge Physical Status + Oper Status for Remote
  const mergedRemotePhysicalStatus = [remotePhysicalStatusValue, remoteOperStatusValue]
    .filter((v) => v !== null && v !== undefined && v !== "")
    .join(" / ") || null;

  // Get colors for merged fields
  const mergedLocalPhysicalStatusColor = mergedLocalPhysicalStatus
    ? getMergedPhysicalStatusColor(physicalStatusValue, operStatusValue, isDark)
    : { textClass: isDark ? "text-gray-400" : "text-gray-600" };

  const mergedRemotePhysicalStatusColor = mergedRemotePhysicalStatus
    ? getMergedPhysicalStatusColor(remotePhysicalStatusValue, remoteOperStatusValue, isDark)
    : { textClass: isDark ? "text-gray-400" : "text-gray-600" };

  const protocolStatusValue = getValue(
    linkData?.protocolStatus,
    linkData?.protocol_status,
    fetchedDetails?.protocol_status
  ) || "N/A";

  const ospfValue = getValue(
    linkData?.ospf,
    linkData?.OSPF,
    fetchedDetails?.ospf,
    fetchedDetails?.ospf_state
  ) || "Enabled";

  const rawPingRate = getValue(
    linkData?.ping_success_rate,
    linkData?.rawLink?.ping_success_rate,
    linkData?.pingSuccessRate,
    fetchedDetails?.ping_success_rate
  );

  const itemData = {
    ...linkData,
    ...(fetchedDetails ? {
      description: fetchedDetails?.description || linkData?.description,
      mediaType: fetchedDetails?.media_type || fetchedDetails?.mediaType || linkData?.mediaType,
      tx: fetchedDetails?.tx !== undefined ? (typeof fetchedDetails.tx === "number" ? `${fetchedDetails.tx} dBm` : fetchedDetails.tx) : linkData?.tx,
      rx: fetchedDetails?.rx !== undefined ? (typeof fetchedDetails.rx === "number" ? `${fetchedDetails.rx} dBm` : fetchedDetails.rx) : linkData?.rx,
      mtu: fetchedDetails?.mtu !== undefined ? String(fetchedDetails.mtu) : (linkData?.mtu !== undefined ? String(linkData.mtu) : undefined),
      ospf_up_time: fetchedDetails?.ospf_up_time ?? linkData?.ospf_up_time,
      ospf_state_duration: fetchedDetails?.ospf_state_duration ?? linkData?.ospf_state_duration,
      last_up_at: fetchedDetails?.last_up_at || linkData?.last_up_at,
      last_down_at: fetchedDetails?.last_down_at || linkData?.last_down_at,
      last_ospf_down_at: fetchedDetails?.last_ospf_down_at || linkData?.last_ospf_down_at,
      statusDate: fetchedDetails?.statusDate || linkData?.statusDate,
    } : {}),
  };

  if (itemData.rawLink) {
    itemData.rawLink = { ...itemData.rawLink };
    delete itemData.rawLink.ospf_uptime_seconds;
    delete itemData.rawLink.ospf_up_time_seconds;
    delete itemData.rawLink.ospf_state_duration_seconds;
    delete itemData.rawLink.ospfUpTimeSeconds;
    delete itemData.rawLink.ospfStateDurationSeconds;
    delete itemData.rawLink.is_pim_up;
    delete itemData.rawLink.mpls_enabled;
    delete itemData.rawLink.is_mpls_up;
    delete itemData.rawLink.pim_uptime_seconds;
    delete itemData.rawLink.mpls_uptime_seconds;
  }
  delete itemData.ospf_uptime_seconds;
  delete itemData.ospf_up_time_seconds;
  delete itemData.ospf_state_duration_seconds;
  delete itemData.ospfUpTimeSeconds;
  delete itemData.ospfStateDurationSeconds;
  delete itemData.is_pim_up;
  delete itemData.mpls_enabled;
  delete itemData.is_mpls_up;
  delete itemData.pim_uptime_seconds;
  delete itemData.mpls_uptime_seconds;

  const rawLastPing = getValue(
    itemData?.last_ping_at,
    itemData?.rawLink?.last_ping_at,
    itemData?.lastPingAt
  );

  const mtuValue = getValue(
    itemData?.mtu,
    itemData?.rawLink?.mtu
  ) || "N/A";

  const handleNavigate = (e) => {
    e.stopPropagation();
    if (onNavigateToSite && itemType === "site") {
      onNavigateToSite(itemData);
    }
  };

  return (
    // Backdrop
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${isVisible && !isClosing ? "bg-black/40 backdrop-blur-sm" : "bg-transparent"}`}
      onClick={handleBackdropClick}
      style={{ pointerEvents: linkData ? "auto" : "none" }}
    >
      {/* Popup Container */}
      <div
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl border transition-all duration-200 select-text ${isVisible && !isClosing ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"} ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}
        >
          <div className="flex items-center space-x-3">
            <StatusBulb
              status={
                itemType === "site"
                  ? protocolStatusValue === "up" || protocolStatusValue === "Up"
                    ? "up"
                    : "down"
                  : itemData.status || "up"
              }
            />
            <h3
              className={`text-lg font-bold ${isDark ? "text-gray-100" : "text-gray-800"}`}
            >
              {linkTitle || itemData.name || "Link Details"}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className={`p-2 rounded-full transition-colors ${isDark ? "text-gray-400 hover:bg-gray-700 hover:text-gray-200" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* In/Out bps section - WITH PERCENTAGES */}
        {(inBps !== null || outBps !== null) && (
          <div className={`px-6 py-3 border-b ${isDark ? "border-gray-700 bg-slate-800/40" : "border-gray-100 bg-sky-50/50"}`}>
            <div className="flex items-center justify-around gap-4">
              {/* In bps */}
              <div className={`flex flex-col items-center px-4 py-2 rounded-lg ${inBpsColors.bgClass} border ${inBpsColors.borderClass}`}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"} mb-1`}>
                  ↓ In bps
                </span>
                <div className="flex items-center gap-1">
                  <span className={`text-lg font-bold ${inBpsColors.textClass}`}>
                    {formatBpsDisplay(inBps)}
                  </span>
                  {bandwidthGB && (
                    <span className={`text-xs font-medium ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      / {bandwidthGB}
                    </span>
                  )}
                  {inBpsColors.usagePercent !== null && (
                    <span className={`text-xs font-medium ml-1 ${inBpsColors.textClass}`}>
                      ({inBpsColors.usagePercent < 0.1 ? "<0.1%" : `${inBpsColors.usagePercent.toFixed(2)}%`})
                    </span>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className={`w-px h-12 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />

              {/* Out bps */}
              <div className={`flex flex-col items-center px-4 py-2 rounded-lg ${outBpsColors.bgClass} border ${outBpsColors.borderClass}`}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"} mb-1`}>
                  ↑ Out bps
                </span>
                <div className="flex items-center gap-1">
                  <span className={`text-lg font-bold ${outBpsColors.textClass}`}>
                    {formatBpsDisplay(outBps)}
                  </span>
                  {bandwidthGB && (
                    <span className={`text-xs font-medium ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      / {bandwidthGB}
                    </span>
                  )}
                  {outBpsColors.usagePercent !== null && (
                    <span className={`text-xs font-medium ml-1 ${outBpsColors.textClass}`}>
                      ({outBpsColors.usagePercent < 0.1 ? "<0.1%" : `${outBpsColors.usagePercent.toFixed(2)}%`})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* --- LINK TYPE CONTENT --- */}
          {itemType === "link" && itemData && !itemData.isCoreTopology && (
            <div className="space-y-1">
              <div
                className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"}`}
              >
                {/* Merged Physical Status (Physical Status + Oper Status) */}
                {mergedLocalPhysicalStatus && (
                  <DetailRow
                    label="Physical Status"
                    value={mergedLocalPhysicalStatus}
                    isDark={isDark}
                    valueColorClass={mergedLocalPhysicalStatusColor.textClass}
                  />
                )}

                {/* Merged Remote Physical Status (Remote Physical Status + Remote Oper Status) */}
                {mergedRemotePhysicalStatus && (
                  <DetailRow
                    label="Remote Physical Status"
                    value={mergedRemotePhysicalStatus}
                    isDark={isDark}
                    valueColorClass={mergedRemotePhysicalStatusColor.textClass}
                  />
                )}

                <DetailRow
                  label="MPLS"
                  value={itemData.mpls || itemData.MPLS || "Enabled"}
                  isDark={isDark}
                />
                <DetailRow
                  label="OSPF"
                  value={ospfValue}
                  isDark={isDark}
                  valueColorClass={getOspfStateColor(ospfValue, isDark).textClass}
                />
                <DetailRow
                  label="Bandwidth"
                  value={
                    bandwidthMbps
                      ? `${bandwidthMbps} Mbps`
                      : (itemData.bandwidth || itemData.Bandwidth || "N/A")
                  }
                  isDark={isDark}
                />
                <DetailRow
                  label="Ping Success Rate"
                  value={typeof rawPingRate === "number" ? `${rawPingRate.toFixed(1)}%` : (rawPingRate || "N/A")}
                  isDark={isDark}
                  valueColorClass={getPingSuccessColor(rawPingRate, isDark).textClass}
                />
                {itemData.sourceZone && itemData.sourceZone !== "N/A" && (
                  <DetailRow
                    label="Source Zone"
                    value={itemData.sourceZone}
                    isDark={isDark}
                  />
                )}
                {itemData.targetZone && itemData.targetZone !== "N/A" && (
                  <DetailRow
                    label="Target Zone"
                    value={itemData.targetZone}
                    isDark={isDark}
                  />
                )}
              </div>

              {/* Expanded details section */}
              <div
                className={`mt-4 pt-4 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`}
                >
                  Extended Details
                </p>
                <div
                  className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"}`}
                >
                  <DetailRow
                    label="Description"
                    value={itemData?.description || itemData?.Description || "Core backbone fiber link"}
                    isDark={isDark}
                  />
                  <DetailRow
                    label="Media Type"
                    value={itemData?.mediaType || itemData?.MediaType || itemData?.media_type || "Fiber Optic"}
                    isDark={isDark}
                  />
                  <DetailRow
                    label="TX"
                    value={itemData.tx || "N/A"}
                    isDark={isDark}
                  />
                  <DetailRow
                    label="RX"
                    value={itemData.rx || "N/A"}
                    isDark={isDark}
                  />
                  <DetailRow
                    label="MTU"
                    value={mtuValue}
                    isDark={isDark}
                  />
                  {rawLastPing && (
                    <DetailRow
                      label="Last Ping"
                      value={formatLastPing(rawLastPing)}
                      isDark={isDark}
                    />
                  )}
                  {itemData.ip && itemData.ip !== "N/A" && (
                    <DetailRow
                      label="IP Address"
                      value={itemData.ip}
                      isDark={isDark}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --- CORE TOPOLOGY LINK CONTENT --- */}
          {itemType === "link" && itemData && itemData.isCoreTopology && itemData.rawLink && (() => {
            const localDeviceKeys = [];
            const remoteDeviceKeys = [];
            const linkDetailsKeys = [];

            Object.entries(itemData.rawLink).forEach(([key, value]) => {
              if (typeof value === "object" && value !== null) return;

              if (key === "id" || key.endsWith("_id")) return;
              if (key === "remote_device_ip") return;
              if (key.endsWith("_at")) return;
              if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}T/)) return;

              if (
                key === "is_ospf_full" ||
                key === "is_pim_up" ||
                key === "mpls_enabled" ||
                key === "is_mpls_up" ||
                key === "link_drops_last_24h" ||
                key === "ospf_drops_last_24h" ||
                key === "ospf_up_time_seconds" ||
                key === "ospf_state_duration_seconds" ||
                key.endsWith("_seconds") ||
                /seconds/i.test(key)
              ) return;

              if (
                key === "in_bps" ||
                key === "out_bps" ||
                key === "inBps" ||
                key === "outBps" ||
                key === "bytes_in_rate" ||
                key === "bytes_out_rate" ||
                key === "input_rate" ||
                key === "output_rate" ||
                key === "in_rate" ||
                key === "out_rate"
              ) return;

              if (key.startsWith("local_")) {
                localDeviceKeys.push([key, value]);
              } else if (key.startsWith("remote_")) {
                remoteDeviceKeys.push([key, value]);
              } else {
                linkDetailsKeys.push([key, value]);
              }
            });

            const renderGroup = (title, entries, hideBorderTop = false) => {
              if (entries.length === 0) return null;
              return (
                <div className={hideBorderTop ? "" : `mt-4 pt-4 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    {title}
                  </p>
                  <div className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"}`}>
                    {entries.map(([key, value]) => {
                      const formattedKey = key
                        .split("_")
                        .map((word) => {
                          const upper = word.toUpperCase();
                          if (["PIM", "MPLS", "LDP", "OSPF", "IP", "MTU", "BW", "TX", "RX", "CRC", "ID"].includes(upper)) {
                            return upper;
                          }
                          return word.charAt(0).toUpperCase() + word.slice(1);
                        })
                        .join(" ");

                      let displayValue = value;
                      let valueColorClass = null; // Changed from defaulting to a color

                      if (typeof value === "boolean") {
                        displayValue = value ? "Yes" : "No";
                      } else if (key === "ping_success_rate") {
                        const pInfo = formatPingRateWithPackets(itemData?.rawLink || itemData);
                        if (pInfo) {
                          const lostCount = pInfo.packetsLost ?? (pInfo.rate < 100 ? 1 : 0);
                          displayValue = lostCount > 0 ? `${pInfo.full} (⚠️ ${lostCount} lost)` : pInfo.full;
                        } else {
                          displayValue = `${value}%`;
                        }
                      } else if (key === "bandwidth_mbps") {
                        displayValue = typeof value === "number"
                          ? (value >= 1000 ? `${value / 1000} Gbps (${value} Mbps)` : `${value} Mbps`)
                          : value;
                      } else if (key === "physical_status" || key === "physicalStatus") {
                        // Merge with oper_status
                        const pairedOperStatus = itemData?.rawLink?.oper_status ?? itemData?.rawLink?.operStatus;
                        if (pairedOperStatus !== undefined && pairedOperStatus !== null) {
                          displayValue = `${value} / ${pairedOperStatus}`;
                          valueColorClass = getMergedPhysicalStatusColor(value, pairedOperStatus, isDark).textClass;
                        } else {
                          displayValue = value;
                          valueColorClass = getStatusColor(value, isDark).textClass;
                        }
                      } else if (key === "oper_status" || key === "operStatus") {
                        // Skip - merged with physical_status
                        return null;
                      } else if (key === "remote_physical_status" || key === "remotePhysicalStatus") {
                        // Merge with remote_oper_status
                        const pairedOperStatus = itemData?.rawLink?.remote_oper_status ?? itemData?.rawLink?.remoteOperStatus;
                        if (pairedOperStatus !== undefined && pairedOperStatus !== null) {
                          displayValue = `${value} / ${pairedOperStatus}`;
                          valueColorClass = getMergedPhysicalStatusColor(value, pairedOperStatus, isDark).textClass;
                        } else {
                          displayValue = value;
                          valueColorClass = getStatusColor(value, isDark).textClass;
                        }
                      } else if (key === "remote_oper_status" || key === "remoteOperStatus" || key === "remote_operstatus") {
                        // Skip - merged with remote_physical_status
                        return null;
                      } else if (key === "ospf" || key === "ospf_state") {
                        valueColorClass = getOspfStateColor(value, isDark).textClass;
                      } else if (key === "pim_state" || key === "pim") {
                        valueColorClass = getStatusColor(value, isDark).textClass;
                      } else if (key === "mpls_ldp_state" || key === "mpls_state" || key === "mpls") {
                        const vLower = String(value).toLowerCase();
                        valueColorClass = (vLower === "oper" || vLower === "up" || vLower === "established")
                          ? "text-emerald-600 dark:text-emerald-400"
                          : getStatusColor(value, isDark).textClass;
                      }
                      // REMOVED: else { valueColorClass = getStatusColor(value, isDark).textClass; }

                      return (
                        <DetailRow
                          key={key}
                          label={formattedKey}
                          value={displayValue}
                          isDark={isDark}
                          valueColorClass={valueColorClass}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            };

            return (
              <div className="space-y-1">
                {renderGroup("Local Device", localDeviceKeys, true)}
                {renderGroup("Remote Device", remoteDeviceKeys)}
                {renderGroup("Link Details", linkDetailsKeys)}
              </div>
            );
          })()}

          {/* --- SITE TYPE CONTENT --- */}
          {itemType === "site" && itemData && (
            <div className="space-y-1">
              <div
                className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"}`}
              >
                <DetailRow label="Physical" value="Up" isDark={isDark} />
                <DetailRow
                  label="Protocol"
                  value={itemData.protocolStatus}
                  isDark={isDark}
                />
                <DetailRow
                  label="MPLS"
                  value={itemData.mplsStatus}
                  isDark={isDark}
                />
                <DetailRow
                  label="OSPF"
                  value={itemData.ospfStatus}
                  isDark={isDark}
                />
                <DetailRow
                  label="Bandwidth"
                  value="100 Gbps"
                  isDark={isDark}
                />
              </div>

              {/* Expanded details section */}
              <div
                className={`mt-4 pt-4 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`}
                >
                  Extended Details
                </p>
                <div
                  className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"}`}
                >
                  <DetailRow
                    label="Description"
                    value={itemData?.description || "N/A"}
                    isDark={isDark}
                  />
                  <DetailRow
                    label="Media Type"
                    value={itemData?.mediaType || "N/A"}
                    isDark={isDark}
                  />
                  <DetailRow
                    label="CDP Neighbors"
                    value={itemData?.cdpNeighbors || "N/A"}
                    isDark={isDark}
                  />
                  <DetailRow label="TX" value="98.5 Gbps" isDark={isDark} />
                  <DetailRow label="RX" value="95.1 Gbps" isDark={isDark} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}
        >
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Updated: {new Date().toLocaleTimeString()}
          </span>
          <div className="flex items-center gap-3">
            {itemType === "site" && onNavigateToSite && (
              <button
                onClick={handleNavigate}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors"
              >
                Go to Site Details
                <MdArrowForward />
              </button>
            )}
            <button
              onClick={handleClose}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDark ? "text-gray-300 bg-gray-700 hover:bg-gray-600" : "text-gray-700 bg-gray-100 hover:bg-gray-200"}`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkDetailPopup;
