import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CoreSiteCanvas from "./CoreSiteCanvas";
import SitesBar from "./SitesBar";
import LinkDetailPopup from "../shared/LinkDetailPopup";
import CoreSiteControls from "./CoreSiteControls";

export default function CoreSiteView({
  chartType = "L",
  theme,
  zoneId,
  coreSiteId,
  containerRef,
  dimensions,
  nodes,
  links,
  centerX,
  centerY,
  selectedNodeId,
  showExtendedNodes,
  onToggleExtendedNodes,
  sites,
  onSiteClick,
  onLinkClick,
  onNodeClick,
  devicesInZoneCount,
  popupDetail,
  onClosePopup,
  onNavigateToSite,
}) {
  const navigate = useNavigate();
  const isDark = theme === "dark";
  const backPath = chartType === "P" ? "/Pikudim" : "/Libot";
  const backLabel = chartType === "P" ? "Back to Pikudim Map" : "Back to Libot Map";
  const svgRef = useRef(null);
  const siteRefs = useRef([]);
  const focusedNodeDataRef = useRef(null);

  // --- Style constants for theme-awareness ---
  const pageBgColor = theme === "dark" ? "bg-gray-800" : "bg-white";
  const loadingBgColor = theme === "dark" ? "bg-slate-800" : "bg-gray-100";
  const loadingTextColor = theme === "dark" ? "text-white" : "text-gray-700";

  // --- Loading State ---
  if (dimensions.width === 0 || dimensions.height === 0) {
    return (
      <div
        ref={containerRef}
        className={`w-full h-full ${loadingBgColor} ${loadingTextColor} flex items-center justify-center`}
      >
        Loading dimensions...
      </div>
    );
  }

  // --- Dynamic positioning for Back button ---
  const displayZoneId = zoneId
    ? zoneId.startsWith("Zone ")
      ? zoneId
      : `Zone ${zoneId}`
    : "Central Zone";

  return (
    // UPDATED LAYOUT: Use flexbox column to stack the tab bar and the main content area.
    <div
      ref={containerRef}
      className={`w-full h-full ${pageBgColor} flex flex-col overflow-hidden`}
    >
      {/* 1. RENDER POPUP if detail data exists */}
      <LinkDetailPopup
        linkData={popupDetail?.data || null}
        linkType={popupDetail?.type || "link"}
        linkTitle={popupDetail?.title || ""}
        onClose={onClosePopup}
        onNavigateToSite={onNavigateToSite}
        theme={theme}
      />

      {/* 2. Main content area that grows to fill the remaining space */}
      <div className="flex-grow relative">
        {/* Back to Network Map button */}
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className={`absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-lg border backdrop-blur-md transition-all duration-150 active:scale-95 ${
            isDark
              ? "bg-gray-900/90 hover:bg-gray-800 text-sky-400 border-gray-700/80 shadow-black/30"
              : "bg-white/95 hover:bg-gray-50 text-sky-700 border-gray-200 shadow-gray-200/50"
          }`}
          title={backLabel}
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">{backLabel}</span>
          <span className="sm:hidden">Back</span>
        </button>

        {/* CoreSiteControls */}
        <CoreSiteControls
          theme={theme}
          displayZoneId={displayZoneId}
          zoneId={zoneId}
          coreSiteId={coreSiteId}
          showExtendedNodes={showExtendedNodes}
          onToggleExtendedNodes={onToggleExtendedNodes}
          devicesInZoneCount={devicesInZoneCount}
        />

        {/* The canvas and sites bar also live in this container and are sized relative to it */}
        <svg ref={svgRef} className="absolute top-0 left-0 w-full h-full z-0" />
        <CoreSiteCanvas
          svgRef={svgRef}
          focusedNodeDataRef={focusedNodeDataRef}
          focusedNodeId={selectedNodeId}
          nodes={nodes}
          links={links}
          centerX={centerX}
          centerY={centerY}
          width={dimensions.width}
          height={dimensions.height}
          theme={theme}
          onLinkClick={onLinkClick}
          onNodeClick={onNodeClick}
        />
        <SitesBar
          svgRef={svgRef}
          focusedNodeDataRef={focusedNodeDataRef}
          focusedNodeId={selectedNodeId}
          siteRefs={siteRefs}
          theme={theme}
          sites={sites}
          onSiteClick={onSiteClick}
        />
      </div>
    </div>
  );
}
