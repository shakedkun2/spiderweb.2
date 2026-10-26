import React, { useState, useEffect } from "react";
import { MdClose, MdArrowForward } from "react-icons/md";
import { AlertTriangle } from "lucide-react";
import { api, getLinkDetails } from "../../services/apiServices";
import { formatPingRateWithPackets } from "./pingHelpers";

/**
 * A reusable status indicator bulb.
 * @param {{ status: 'up' | 'down' | 'issue' | string }} props
 */
const StatusBulb = ({ status }) => {
  let bgColor = "bg-gray-400 dark:bg-gray-500";
  if (status === "up") bgColor = "bg-green-500 dark:bg-green-400";
  else if (status === "down") bgColor = "bg-red-500 dark:bg-red-400";
  else if (status === "issue") bgColor = "bg-yellow-500 dark:bg-yellow-400";

  return (
    <div className={`w-3.5 h-3.5 rounded-full ${bgColor} flex-shrink-0`}></div>
  );
};

// This helper component is kept for potential future use.
const DetailItem = ({ label, value, isDark }) => (
  <div>
    <p
      className={`text-xs uppercase tracking-wider ${
        isDark ? "text-gray-400" : "text-gray-500"
      }`}
    >
      {label}
    </p>
    <p className={`text-base ${isDark ? "text-gray-100" : "text-gray-800"}`}>
      {value || "N/A"}
    </p>
  </div>
);

/**
 * A tabbed interface with a bigger, bolder, modern style.
 * All functionality remains the same.
 */
const LinkDetailTabs = ({
  tabs,
  activeTabId,
  onSetActiveTab,
  onCloseTab,
  onNavigateToSite,
  theme,
}) => {
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [fetchedDetailsCache, setFetchedDetailsCache] = useState({});

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  useEffect(() => {
    setIsDetailExpanded(false);
  }, [activeTabId]);

  useEffect(() => {
    if (activeTab && activeTab.type === "link" && activeTab.data) {
      const linkData = activeTab.data;
      if (linkData.skipFetch || fetchedDetailsCache[linkData.id]) return;

      const { coredevice_id, neighbor_coredevice_id, local_interface } = linkData;
      const cid = coredevice_id || (linkData.rawLink && linkData.rawLink.coredevice_id);
      const ncid = neighbor_coredevice_id || (linkData.rawLink && linkData.rawLink.neighbor_coredevice_id);
      const name = local_interface || (linkData.rawLink && linkData.rawLink.local_interface);

      if (cid && ncid && name) {
        getLinkDetails(cid, ncid, name)
          .then(data => {
            if (data && data.length > 0) {
              setFetchedDetailsCache(prev => ({ ...prev, [linkData.id]: data[0] }));
            }
          })
          .catch(err => console.error("Failed to fetch link details in tabs:", err));
      }
    }
  }, [activeTab, fetchedDetailsCache]);

  let itemData = activeTab ? activeTab.data : null;
  if (itemData && activeTab.type === "link") {
    const fetchedDetails = fetchedDetailsCache[itemData.id];
    itemData = {
      ...itemData,
      ...(fetchedDetails ? {
        description: fetchedDetails.description || itemData.description,
        mediaType: fetchedDetails.media_type || fetchedDetails.mediaType || itemData.mediaType,
        tx: fetchedDetails.tx !== undefined ? (typeof fetchedDetails.tx === "number" ? `${fetchedDetails.tx} dBm` : fetchedDetails.tx) : itemData.tx,
        rx: fetchedDetails.rx !== undefined ? (typeof fetchedDetails.rx === "number" ? `${fetchedDetails.rx} dBm` : fetchedDetails.rx) : itemData.rx,
        mtu: fetchedDetails.mtu !== undefined ? String(fetchedDetails.mtu) : itemData.mtu,
        physicalStatus: fetchedDetails.physical_status || itemData.physicalStatus,
        protocolStatus: fetchedDetails.protocol_status || itemData.protocolStatus,
        mpls: fetchedDetails.mpls_ldp || itemData.mpls,
        ospf: fetchedDetails.ospf || fetchedDetails.ospf_state || itemData.ospf,
        bandwidth: fetchedDetails.bw || fetchedDetails.bandwidth || itemData.bandwidth,
        ping_success_rate: fetchedDetails.ping_success_rate !== undefined ? fetchedDetails.ping_success_rate : itemData.ping_success_rate,
        ping_packets_success: fetchedDetails.ping_packets_success !== undefined ? fetchedDetails.ping_packets_success : itemData.ping_packets_success,
        ping_packets_total: fetchedDetails.ping_packets_total !== undefined ? fetchedDetails.ping_packets_total : itemData.ping_packets_total,
        ping_ratio: fetchedDetails.ping_ratio ?? itemData.ping_ratio,
        total_pings: fetchedDetails.total_pings ?? itemData.total_pings,
        ping_total: fetchedDetails.ping_total ?? itemData.ping_total,
        last_ping_at: fetchedDetails.last_ping_at || itemData.last_ping_at,
        ospf_uptime: fetchedDetails.ospf_uptime ?? itemData.ospf_uptime ?? fetchedDetails.ospf_up_time ?? itemData.ospf_up_time,
        ospf_up_time: fetchedDetails.ospf_uptime ?? itemData.ospf_uptime ?? fetchedDetails.ospf_up_time ?? itemData.ospf_up_time,
        ospf_state_duration: fetchedDetails.ospf_state_duration ?? itemData.ospf_state_duration,
        last_up_at: fetchedDetails.last_up_at || itemData.last_up_at,
        last_down_at: fetchedDetails.last_down_at || itemData.last_down_at,
        last_ospf_down_at: fetchedDetails.last_ospf_down_at || itemData.last_ospf_down_at,
        statusDate: fetchedDetails.statusDate || itemData.statusDate,
      } : {})
    };

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
  }

  const isDark = theme === "dark";

  if (!activeTab) {
    return null;
  }

  const handleClose = (e, tabId) => {
    e.stopPropagation();
    onCloseTab(tabId);
  };

  const handleNavigate = (e) => {
    e.stopPropagation();
    if (onNavigateToSite && activeTab.type === "site") {
      onNavigateToSite(activeTab.data);
    }
  };

  const itemType = activeTab.type;

  return (
    <div className="relative bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm z-20">
      {/* 1. Tab Bar - Updated with new styling */}
      <div className="flex items-end space-x-1 px-2 pt-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSetActiveTab(tab.id)}
            // START: STYLE CHANGE
            className={`flex items-center py-3 px-4 text-base font-bold border-b-4 rounded-t-lg transition-all duration-200
              ${
                activeTabId === tab.id
                  ? "bg-blue-100 dark:bg-gray-700 border-blue-500 text-blue-700 dark:text-blue-300"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            // END: STYLE CHANGE
          >
            <span>{tab.title}</span>
            <span
              onClick={(e) => handleClose(e, tab.id)}
              className="ml-4 p-1 rounded-full text-gray-400 hover:bg-gray-300/80 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-200"
            >
              <MdClose size={18} />
            </span>
          </button>
        ))}
      </div>

      {/* 2. Content for the Active Tab (All internal logic and layout remains the same) */}
      <div className="p-4">
        {/* --- A. LINK TYPE CONTENT --- */}
        {itemType === "link" && itemData && (
          <>
            <div
              className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${
                isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
              } ${
                isDetailExpanded ? (isDark ? "bg-gray-700" : "bg-gray-100") : ""
              }`}
              onClick={() => setIsDetailExpanded(!isDetailExpanded)}
            >
              <div className="flex items-center space-x-4">
                <StatusBulb status={itemData.status} />
                <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {itemData.name || "Unnamed Link"}
                </p>
              </div>
              <p className="text-base text-gray-600 dark:text-gray-400">
                Physical:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Up
                </span>
              </p>
              <p className="text-base text-gray-600 dark:text-gray-400">
                Protocol:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Up
                </span>
              </p>
              <p className="text-base text-gray-600 dark:text-gray-400">
                MPLS:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Enabled
                </span>
              </p>
              <p className="text-base text-gray-600 dark:text-gray-400">
                OSPF:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Full
                </span>
              </p>
              <p className="text-base text-gray-600 dark:text-gray-400">
                Bandwidth:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  10 Gbps
                </span>
              </p>
            </div>
            {isDetailExpanded && (
              <div className="flex flex-row flex-wrap justify-between items-center gap-y-2 p-4 mt-2 border-t border-gray-200 dark:border-gray-600">
                <div>
                  <span className="text-base text-gray-500 dark:text-gray-400 mr-2">
                    Description:
                  </span>
                  <span className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    {itemData.description || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-base text-gray-500 dark:text-gray-400 mr-2">
                    Media Type:
                  </span>
                  <span className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    {itemData.mediaType || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-base text-gray-500 dark:text-gray-400 mr-2">
                    TX:
                  </span>
                  <span className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    {itemData.tx || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-base text-gray-500 dark:text-gray-400 mr-2">
                    RX:
                  </span>
                  <span className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    {itemData.rx || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-base text-gray-500 dark:text-gray-400 mr-2">
                    MTU:
                  </span>
                  <span className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    {itemData.mtu || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-base text-gray-500 dark:text-gray-400 mr-2">
                    Ping Rate:
                  </span>
                  {(() => {
                    const pInfo = formatPingRateWithPackets(itemData);
                    if (!pInfo) {
                      return (
                        <span className="text-lg font-medium text-gray-800 dark:text-gray-100">
                          {itemData.ping_success_rate !== undefined && itemData.ping_success_rate !== null ? `${itemData.ping_success_rate}%` : "N/A"}
                        </span>
                      );
                    }
                    const numRate = pInfo.rate;
                    const packetsLost = pInfo.packetsLost ?? (numRate < 100 ? 1 : 0);
                    const hasLoss = packetsLost > 0 || numRate < 100;
                    const isDown = numRate === 0;
                    return (
                      <span
                        className={`text-lg font-bold inline-flex items-center gap-1.5 ${
                          isDown
                            ? "text-rose-600 dark:text-rose-400"
                            : hasLoss
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {hasLoss && !isDown && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                        <span>{pInfo.full}</span>
                        {hasLoss && !isDown && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                            {packetsLost} lost
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}
          </>
        )}

        {/* --- B. SITE TYPE CONTENT --- */}
        {itemType === "site" && itemData && (
          <>
            <div
              className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${
                isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
              } ${
                isDetailExpanded ? (isDark ? "bg-gray-700" : "bg-gray-100") : ""
              }`}
              onClick={() => setIsDetailExpanded(!isDetailExpanded)}
            >
              <div className="flex items-center space-x-4">
                <StatusBulb
                  status={itemData.protocolStatus === "Up" ? "up" : "down"}
                />
                <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {itemData.name || "Unnamed Site"}
                </p>
              </div>
              <p className="text-base text-gray-600 dark:text-gray-400">
                Physical:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Up
                </span>
              </p>
              <p className="text-base text-gray-600 dark:text-gray-400">
                Protocol:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {itemData.protocolStatus}
                </span>
              </p>
              <p className="text-base text-gray-600 dark:text-gray-400">
                MPLS:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {itemData.mplsStatus}
                </span>
              </p>
              <p className="text-base text-gray-600 dark:text-gray-400">
                OSPF:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {itemData.ospfStatus}
                </span>
              </p>
              <p className="text-base text-gray-600 dark:text-gray-400">
                Bandwidth:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  100 Gbps
                </span>
              </p>
              <button
                onClick={handleNavigate}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
              >
                Go to Site Details
                <MdArrowForward />
              </button>
            </div>
            {isDetailExpanded && (
              <div className="flex flex-row flex-wrap justify-between items-center gap-y-2 p-4 mt-2 border-t border-gray-200 dark:border-gray-600">
                <div>
                  <span className="text-base text-gray-500 dark:text-gray-400 mr-2">
                    Description:
                  </span>
                  <span className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    {itemData.description || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-base text-gray-500 dark:text-gray-400 mr-2">
                    Media Type:
                  </span>
                  <span className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    {itemData.mediaType || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-base text-gray-500 dark:text-gray-400 mr-2">
                    CDP Neighbors:
                  </span>
                  <span className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    {itemData.cdpNeighbors || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-base text-gray-500 dark:text-gray-400 mr-2">
                    TX:
                  </span>
                  <span className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    98.5 Gbps
                  </span>
                </div>
                <div>
                  <span className="text-base text-gray-500 dark:text-gray-400 mr-2">
                    RX:
                  </span>
                  <span className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    95.1 Gbps
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LinkDetailTabs;
