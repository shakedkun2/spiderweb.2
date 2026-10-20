import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import LinkDetailPopup from "../shared/LinkDetailPopup";
import { createLinkPopupPayload } from "../chart/handleInteractions";
import {
  ArrowLeft,
  Server,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Link2,
  Cpu,
  ChevronDown,
  ChevronRight,
  Wifi,
  WifiOff,
  Network,
  X,
  ExternalLink,
} from "lucide-react";
import CoreSiteTrafficBadge from "../CoreSite/CoreSiteTrafficBadge";

// ─── Status Badge Component ───
const StatusBadge = ({ status, size = "sm" }) => {
  const config = {
    Up: {
      bg: "bg-emerald-500/15 dark:bg-emerald-400/15",
      text: "text-emerald-700 dark:text-emerald-400",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      label: "Up",
    },
    Down: {
      bg: "bg-red-500/15 dark:bg-red-400/15",
      text: "text-red-700 dark:text-red-400",
      dot: "bg-red-500 dark:bg-red-400",
      label: "Down",
    },
    up: {
      bg: "bg-emerald-500/15 dark:bg-emerald-400/15",
      text: "text-emerald-700 dark:text-emerald-400",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      label: "Up",
    },
    down: {
      bg: "bg-red-500/15 dark:bg-red-400/15",
      text: "text-red-700 dark:text-red-400",
      dot: "bg-red-500 dark:bg-red-400",
      label: "Down",
    },
    issue: {
      bg: "bg-amber-500/15 dark:bg-amber-400/15",
      text: "text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500 dark:bg-amber-400",
      label: "Issue",
    },
    "N/A": {
      bg: "bg-gray-500/10 dark:bg-gray-400/10",
      text: "text-gray-500 dark:text-gray-400",
      dot: "bg-gray-400 dark:bg-gray-500",
      label: "N/A",
    },
  };

  const c = config[status] || config["N/A"];
  const sizeClasses =
    size === "sm" ? "px-2.5 py-1 text-xs font-semibold gap-1.5" : "px-3 py-1.5 text-sm font-semibold gap-2";

  return (
    <span
      className={`inline-flex items-center rounded-full ${c.bg} ${c.text} ${sizeClasses}`}
    >
      <span className={`w-2 h-2 rounded-full ${c.dot}`}></span>
      {c.label}
    </span>
  );
};

// ─── Summary Stat Card ───
const StatCard = ({ icon: Icon, label, value, color, subValue }) => {
  const colorMap = {
    blue: {
      bg: "bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10",
      border: "border-blue-200/50 dark:border-blue-500/20",
      icon: "text-blue-600 dark:text-blue-400",
      value: "text-blue-700 dark:text-blue-300",
    },
    green: {
      bg: "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/20 dark:to-emerald-600/10",
      border: "border-emerald-200/50 dark:border-emerald-500/20",
      icon: "text-emerald-600 dark:text-emerald-400",
      value: "text-emerald-700 dark:text-emerald-300",
    },
    red: {
      bg: "bg-gradient-to-br from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10",
      border: "border-red-200/50 dark:border-red-500/20",
      icon: "text-red-600 dark:text-red-400",
      value: "text-red-700 dark:text-red-300",
    },
    purple: {
      bg: "bg-gradient-to-br from-purple-500/10 to-purple-600/5 dark:from-purple-500/20 dark:to-purple-600/10",
      border: "border-purple-200/50 dark:border-purple-500/20",
      icon: "text-purple-600 dark:text-purple-400",
      value: "text-purple-700 dark:text-purple-300",
    },
    amber: {
      bg: "bg-gradient-to-br from-amber-500/10 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10",
      border: "border-amber-200/50 dark:border-amber-500/20",
      icon: "text-amber-600 dark:text-amber-400",
      value: "text-amber-700 dark:text-amber-300",
    },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div
      className={`rounded-xl border ${c.border} ${c.bg} p-2.5 transition-all duration-200 hover:scale-[1.02] hover:shadow-md`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`p-1.5 rounded-lg bg-white/60 dark:bg-white/5 ${c.icon}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {label}
          </p>
          <p className={`text-lg font-bold ${c.value} leading-tight`}>
            {value}
          </p>
          {subValue && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {subValue}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Filter Pill Button ───
const FilterPill = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200 border leading-none ${active
        ? "bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500 shadow-sm"
        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
      }`}
  >
    {children}
  </button>
);

// ─── Detail Row Helper for Modal ───
const DetailItemRow = ({ label, value, highlight = false, isDark = true }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
      {label}
    </span>
    <span
      className={`text-xs font-semibold ${highlight
          ? "text-red-600 dark:text-red-400 font-bold"
          : "text-gray-800 dark:text-gray-200"
        }`}
    >
      {value !== undefined && value !== null && value !== "" ? String(value) : "N/A"}
    </span>
  </div>
);

const LinkTable = ({
  coreDeviceName,
  coreSiteName = "Unknown Site",
  linksData = [],
  otherDevicesInZone = [],
  theme = "dark",
  chartType = "L",
  interfaces = [],
  currentDevice = null,
}) => {
  const navigate = useNavigate();

  // Modal popup state
  const [popupItem, setPopupItem] = useState(null);

  // Links state
  const [linkTypeFilter, setLinkTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filteredLinks, setFilteredLinks] = useState(linksData);

  // Interfaces state
  const [interfaceStatusFilter, setInterfaceStatusFilter] = useState("all");


  useEffect(() => {
    let currentLinks = [...linksData];
    if (linkTypeFilter !== "all") {
      currentLinks = currentLinks.filter(
        (link) => link && link.type === linkTypeFilter
      );
    }
    if (statusFilter === "issue") {
      const problemLinks = currentLinks.filter(
        (link) => link && (link.status === "down" || link.status === "issue")
      );
      problemLinks.sort((a, b) => {
        if (a.status === "down" && b.status !== "down") return -1;
        if (a.status !== "down" && b.status === "down") return 1;
        return 0;
      });
      currentLinks = problemLinks;
    } else if (statusFilter !== "all") {
      currentLinks = currentLinks.filter(
        (link) => link && link.status === statusFilter
      );
    }
    setFilteredLinks(currentLinks);
  }, [linksData, linkTypeFilter, statusFilter]);

  // Filter interfaces
  const filteredInterfaces = useMemo(() => {
    if (!interfaces || interfaces.length === 0) return [];
    if (interfaceStatusFilter === "all") return interfaces;
    return interfaces.filter((iface) => {
      const status = (iface.physical_status || "").toLowerCase();
      return status === interfaceStatusFilter;
    });
  }, [interfaces, interfaceStatusFilter]);

  // Compute stats
  const stats = useMemo(() => {
    const totalIfaces = interfaces.length;
    const ifacesUp = interfaces.filter(
      (i) => (i.physical_status || "").toLowerCase() === "up"
    ).length;
    const ifacesDown = totalIfaces - ifacesUp;
    const totalLinks = linksData.length;
    const linksUp = linksData.filter((l) => l.status === "up").length;
    const linksDown = linksData.filter((l) => l.status === "down").length;
    const linksIssue = linksData.filter((l) => l.status === "issue").length;
    return {
      totalIfaces,
      ifacesUp,
      ifacesDown,
      totalLinks,
      linksUp,
      linksDown,
      linksIssue,
    };
  }, [interfaces, linksData]);

  const isDark = theme === "dark";

  const handleDeviceButtonClick = (device) => {
    const basePath = chartType === "P" ? "/Pikudim" : "/Libot";
    navigate(`${basePath}/zone/${device.zoneName || coreSiteName}/node/${device.hostname}`);
  };

  const handleBackClick = () => {
    const basePath = chartType === "P" ? "/Pikudim" : "/Libot";
    navigate(`${basePath}/zone/${coreSiteName}`);
  };

  const handleLinkSelect = (link) => {
    if (window.getSelection && window.getSelection().toString().trim().length > 0) return;

    const isCoreLink = link.isCoreLink ?? (link.type !== "core-to-site");

    if (isCoreLink) {
      // Connection to a core device: use the same popup as in the chart pages
      const rawLinkData = link.rawLink || link;
      const payload = createLinkPopupPayload(rawLinkData) || rawLinkData;
      const src =
        typeof payload.source === "object"
          ? payload.source?.id || payload.source?.hostname || payload.source?.name
          : payload.sourceNode || payload.sourceName || payload.source || coreDeviceName;
      const tgt =
        typeof payload.target === "object"
          ? payload.target?.id || payload.target?.hostname || payload.target?.name
          : payload.targetNode || payload.targetName || payload.target || link.name;

      setPopupItem({
        data: {
          ...payload,
          rawLink: payload.rawLink || rawLinkData,
          skipFetch: true,
          isCoreTopology: true,
        },
        type: "link",
        title: `${src || "Device A"} ⟷ ${tgt || "Device B"}`,
      });
    } else {
      // Connection to an end site: use current popup
      setPopupItem({
        data: {
          ...link,
          skipFetch: false,
          isCoreTopology: false,
        },
        type: "link",
        title: link.name || "Link Details",
      });
    }
  };



  return (
    <div className="h-full w-full flex flex-col min-h-0 overflow-hidden space-y-3">
      {/* ─── Header ─── */}
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackClick}
            className="p-3 rounded-xl text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all duration-200"
            title="Back to site view"
          >
            <ArrowLeft className="w-8 h-8" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Network className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{coreSiteName}</span>
              <ChevronRight className="w-3 h-3 flex-shrink-0" />
              <span className="text-gray-800 dark:text-gray-200 font-medium truncate">
                {coreDeviceName || "N/A"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-50">
              Device Details
            </h1>
          </div>
        </div>

        {/* Live Site Traffic Badge */}
        <div className="flex items-center gap-2">
          <CoreSiteTrafficBadge
            coreSiteId={currentDevice?.coresite_id || currentDevice?.core_pikudim_site_id}
            siteName={coreSiteName}
            theme={theme}
            showActivity={true}
            size="md"
          />
        </div>
      </div>

      {/* ─── Summary Stats ─── */}
      <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          icon={Link2}
          label="Total Links"
          value={stats.totalLinks}
          color="purple"
        />
        <StatCard
          icon={ArrowUpCircle}
          label="Links Up"
          value={stats.linksUp}
          color="green"
        />
        <StatCard
          icon={ArrowDownCircle}
          label="Links Down"
          value={stats.linksDown}
          color="red"
        />
        <StatCard
          icon={AlertTriangle}
          label="Links Issues"
          value={stats.linksIssue}
          color="amber"
        />
      </div>

      {/* --- Sections Container --- */}
      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
        {/* ─── Links Section ─── */}
        <div
          className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden flex flex-col min-h-0 flex-1"
        >
          <div className="w-full flex items-center justify-between px-5 py-4  flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-purple-500/10 dark:bg-purple-400/10">
                <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                Network Links
              </h3>
              <span className="text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                {filteredLinks.length}
                {(linkTypeFilter !== "all" || statusFilter !== "all") &&
                  ` / ${linksData.length}`}
              </span>
            </div>

          </div>


          <div className="px-4 pb-3 flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Link Filters */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mb-1 pb-1 border-b border-gray-100 dark:border-gray-700/50 flex-shrink-0">
              <div className="flex items-center gap-0.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-1">
                  Type:
                </span>
                <FilterPill
                  active={linkTypeFilter === "all"}
                  onClick={() => setLinkTypeFilter("all")}
                >
                  All
                </FilterPill>
                <FilterPill
                  active={linkTypeFilter === "core-to-site"}
                  onClick={() => setLinkTypeFilter("core-to-site")}
                >
                  Core → Site
                </FilterPill>
                <FilterPill
                  active={linkTypeFilter === "inter-core-different-site"}
                  onClick={() =>
                    setLinkTypeFilter("inter-core-different-site")
                  }
                >
                  Inter-Core (Diff)
                </FilterPill>
                <FilterPill
                  active={linkTypeFilter === "inter-core-same-site"}
                  onClick={() => setLinkTypeFilter("inter-core-same-site")}
                >
                  Inter-Core (Same)
                </FilterPill>
              </div>
              <div className="h-2.5 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
              <div className="flex items-center gap-0.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-1">
                  Status:
                </span>
                <FilterPill
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </FilterPill>
                <FilterPill
                  active={statusFilter === "up"}
                  onClick={() => setStatusFilter("up")}
                >
                  Up
                </FilterPill>
                <FilterPill
                  active={statusFilter === "down"}
                  onClick={() => setStatusFilter("down")}
                >
                  Down
                </FilterPill>
                <FilterPill
                  active={statusFilter === "issue"}
                  onClick={() => setStatusFilter("issue")}
                >
                  Issues
                </FilterPill>
              </div>
            </div>

            {/* Links Table */}
            {filteredLinks && filteredLinks.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-100 dark:border-gray-700/50 shadow-inner">
                <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700/50">
                  <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-700 shadow-sm">
                    <tr>
                      <th className="px-5 py-3 text-left text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 text-left text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-5 py-3 text-left text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Destination IP
                      </th>
                      <th className="px-5 py-3 text-left text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                    {filteredLinks.map((link) => {
                      if (!link || typeof link.id === "undefined") {
                        return null;
                      }
                      return (
                        <tr
                          key={link.id}
                          onClick={() => handleLinkSelect(link)}
                          className="hover:bg-purple-50/60 dark:hover:bg-purple-500/10 cursor-pointer transition-colors duration-150"
                          title="Click for full details popup"
                        >
                          <td className="px-5 py-3 whitespace-nowrap">
                            <StatusBadge status={link.status} />
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className="text-sm font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                              {link.name}
                              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">
                              {link.destinationIp || link.remote_link_ip || link.remote_device_ip || link.remote_ip || "N/A"}
                            </span>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {link.local_interface_description || link.description || "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                <Link2 className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {linksData.length === 0
                    ? "No link data available for this device."
                    : "No links match the current filters."}
                </p>
                {linksData.length > 0 && (
                  <button
                    onClick={() => {
                      setLinkTypeFilter("all");
                      setStatusFilter("all");
                    }}
                    className="mt-3 px-5 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Detail Modal Popup ─── */}
      <LinkDetailPopup
        linkData={popupItem?.data || null}
        linkType={popupItem?.type || "link"}
        linkTitle={popupItem?.title || ""}
        onClose={() => setPopupItem(null)}
        theme={theme}
      />
    </div>
  );
};

export default LinkTable;
