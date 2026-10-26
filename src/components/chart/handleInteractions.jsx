// src/chart/handleInteractions.jsx
import { linkPositionFromEdges, normalizeLinkStatus, getLinkStatusAndDate } from "./drawHelpers";
import { formatPingRateWithPackets } from "../shared/pingHelpers";
import * as d3 from "d3";

// --- Helper function to create payload for link popups ---
export function createLinkPopupPayload(linkDataObject) {
  if (!linkDataObject) return null;

  const raw = linkDataObject.rawLink || linkDataObject;

  const sourceId =
    typeof linkDataObject.source === "object" && linkDataObject.source !== null
      ? linkDataObject.source.id || linkDataObject.source.hostname || linkDataObject.source.name
      : (linkDataObject.sourceNode || linkDataObject.sourceName || linkDataObject.source);

  const targetId =
    typeof linkDataObject.target === "object" && linkDataObject.target !== null
      ? linkDataObject.target.id || linkDataObject.target.hostname || linkDataObject.target.name
      : (linkDataObject.targetNode || linkDataObject.targetName || linkDataObject.target);

  const { status, statusDate } = getLinkStatusAndDate(linkDataObject);
  const physicalStatus =
    raw.physical_status ||
    raw.physicalStatus ||
    linkDataObject.physical_status ||
    linkDataObject.physicalStatus ||
    (status === "down" ? "Down" : "Up");

  const protocolStatus =
    raw.protocol_status ||
    raw.protocolStatus ||
    linkDataObject.protocol_status ||
    linkDataObject.protocolStatus ||
    (status === "down" ? "Down" : "Up");

  const mpls = raw.mpls_ldp || raw.MPLS || raw.mpls || linkDataObject.MPLS || linkDataObject.mpls || "Enabled";
  const ospf = raw.ospf || raw.ospf_state || raw.OSPF || linkDataObject.OSPF || linkDataObject.ospf || "Enabled";
  const rawBw = raw.bw ?? raw.bandwidth ?? raw.Bandwidth ?? linkDataObject.bandwidth ?? "10 Gbps";
  const bandwidth =
    typeof rawBw === "number"
      ? rawBw >= 1000
        ? `${rawBw / 1000} Gbps`
        : `${rawBw} Mbps`
      : String(rawBw);

  const description =
    raw.description ||
    raw.Description ||
    linkDataObject.description ||
    "Core backbone fiber link";
  const mediaType =
    raw.media_type ||
    raw.MediaType ||
    raw.mediaType ||
    linkDataObject.mediaType ||
    "Fiber Optic";
  const rawTx = raw.tx ?? raw.TX ?? linkDataObject.tx ?? "N/A";
  const rawRx = raw.rx ?? raw.RX ?? linkDataObject.rx ?? "N/A";
  const rawMtu = raw.mtu ?? raw.MTU ?? linkDataObject.mtu ?? "N/A";
  const tx = typeof rawTx === "number" ? `${rawTx} dBm` : String(rawTx);
  const rx = typeof rawRx === "number" ? `${rawRx} dBm` : String(rawRx);
  const mtu = typeof rawMtu === "number" ? String(rawMtu) : String(rawMtu);
  const ping_success_rate =
    raw.ping_success_rate ??
    linkDataObject.ping_success_rate ??
    raw.pingSuccessRate ??
    linkDataObject.pingSuccessRate;
  const ping_packets_success =
    raw.ping_packets_success ??
    linkDataObject.ping_packets_success ??
    raw.packets_success ??
    linkDataObject.packets_success;
  const ping_packets_total =
    raw.ping_packets_total ??
    linkDataObject.ping_packets_total ??
    raw.packets_total ??
    linkDataObject.packets_total ??
    raw.total_pings ??
    linkDataObject.total_pings ??
    raw.ping_total ??
    linkDataObject.ping_total;
  const ping_ratio =
    raw.ping_ratio ??
    linkDataObject.ping_ratio ??
    raw.packet_ratio ??
    linkDataObject.packet_ratio;
  const total_pings =
    raw.total_pings ??
    linkDataObject.total_pings ??
    raw.ping_total ??
    linkDataObject.ping_total ??
    ping_packets_total;
  const last_ping_at =
    raw.last_ping_at ??
    linkDataObject.last_ping_at ??
    raw.lastPingAt ??
    linkDataObject.lastPingAt;
  const ip = raw.ip || linkDataObject.ip || "N/A";
  const sourceZone = linkDataObject.sourceZone || raw.sourceZone || "N/A";
  const targetZone = linkDataObject.targetZone || raw.targetZone || "N/A";

  const popupId =
    linkDataObject.id ||
    `${sourceId}-${targetId}-${Math.random().toString(16).slice(2)}`;

  const in_bps =
    raw.in_bps ??
    linkDataObject.in_bps ??
    raw.inBps ??
    linkDataObject.inBps ??
    raw.bytes_in_rate ??
    linkDataObject.bytes_in_rate ??
    raw.input_rate ??
    linkDataObject.input_rate ??
    raw.in_rate ??
    linkDataObject.in_rate ??
    raw.bytesIn ??
    linkDataObject.bytesIn ??
    null;

  const out_bps =
    raw.out_bps ??
    linkDataObject.out_bps ??
    raw.outBps ??
    linkDataObject.outBps ??
    raw.bytes_out_rate ??
    linkDataObject.bytes_out_rate ??
    raw.output_rate ??
    linkDataObject.output_rate ??
    raw.out_rate ??
    linkDataObject.out_rate ??
    raw.bytesOut ??
    linkDataObject.bytesOut ??
    null;

  const cleanRaw = { ...raw };
  delete cleanRaw.ospf_uptime_seconds;
  delete cleanRaw.ospf_up_time_seconds;
  delete cleanRaw.ospf_state_duration_seconds;
  delete cleanRaw.ospfUpTimeSeconds;
  delete cleanRaw.ospfStateDurationSeconds;
  delete cleanRaw.is_pim_up;
  delete cleanRaw.mpls_enabled;
  delete cleanRaw.is_mpls_up;
  delete cleanRaw.pim_uptime_seconds;
  delete cleanRaw.mpls_uptime_seconds;

  const payload = {
    ...cleanRaw,
    ...linkDataObject,
    rawLink: cleanRaw,
    in_bps,
    out_bps,
    input_rate: raw.input_rate ?? linkDataObject.input_rate ?? in_bps,
    output_rate: raw.output_rate ?? linkDataObject.output_rate ?? out_bps,
    type: "link",
    id: popupId,
    linkId: linkDataObject.id || popupId,
    source: sourceId,
    target: targetId,
    sourceNode: sourceId,
    targetNode: targetId,
    sourceName: sourceId,
    targetName: targetId,
    sourceZone,
    targetZone,
    name: `Link ${sourceId} ⟷ ${targetId}`,
    status,
    normalizedStatus: status,
    statusDate,
    statusChangedAt: statusDate || linkDataObject.statusChangedAt || linkDataObject.last_state_change_at,
    physicalStatus,
    protocolStatus,
    mpls,
    ospf,
    bandwidth,
    description,
    mediaType,
    tx,
    rx,
    mtu,
    ping_success_rate,
    ping_packets_success,
    ping_packets_total,
    ping_ratio,
    total_pings,
    ping_total: total_pings,
    last_ping_at,
    ospf_uptime: linkDataObject.ospf_uptime ?? raw.ospf_uptime ?? linkDataObject.ospf_up_time ?? raw.ospf_up_time,
    ospf_up_time: linkDataObject.ospf_uptime ?? raw.ospf_uptime ?? linkDataObject.ospf_up_time ?? raw.ospf_up_time,
    ospf_state_duration: linkDataObject.ospf_state_duration ?? raw.ospf_state_duration,
    last_up_at: linkDataObject.last_up_at ?? raw.last_up_at,
    last_down_at: linkDataObject.last_down_at ?? raw.last_down_at,
    last_ospf_down_at: linkDataObject.last_ospf_down_at ?? raw.last_ospf_down_at,
    ip,
  };

  delete payload.ospf_uptime_seconds;
  delete payload.ospf_up_time_seconds;
  delete payload.ospf_state_duration_seconds;
  delete payload.ospfUpTimeSeconds;
  delete payload.ospfStateDurationSeconds;
  delete payload.is_pim_up;
  delete payload.mpls_enabled;
  delete payload.is_mpls_up;
  delete payload.pim_uptime_seconds;
  delete payload.mpls_uptime_seconds;

  return payload;
}

// ===================================================================
// Helper function to get the correct color by category / status
// ===================================================================
export function getLinkColorByCategory(linkData, palette) {
  if (!linkData) return palette?.link || "#6b7280";
  const status = normalizeLinkStatus(linkData);
  if (status === "down") {
    return palette?.status?.down || "#ef4444";
  }
  if (status === "issue") {
    return palette?.status?.issue || "#f59e0b";
  }
  return palette?.status?.up || "#22c55e";
}

// ===================================================================
// Helper to generate directional tooltip text based on node positions
// ===================================================================
export function getTooltipDirectionalText(d, sourceNode, targetNode) {
  const localIf = d.local_interface || "Unknown";
  const remoteIf = d.remote_interface || "Unknown";

  if (!d.local_interface && !d.remote_interface) return d.id;

  const sX = sourceNode ? sourceNode.x : (d.source.x || 0);
  const tX = targetNode ? targetNode.x : (d.target.x || 0);
  const sY = sourceNode ? sourceNode.y : (d.source.y || 0);
  const tY = targetNode ? targetNode.y : (d.target.y || 0);

  // Consider source to be "left" if its X is strictly less, OR if X is equal and Y is less
  const sourceIsLeft = sX < tX || (sX === tX && sY < tY);

  if (sourceIsLeft) {
    // local is on the left, remote is on the right
    return `${localIf} -> ${remoteIf}`;
  } else {
    // remote is on the left, local is on the right
    // arrow points from local (right) to remote (left)
    return `${remoteIf} <- ${localIf}`;
  }
}

// ===================================================================
// Helper to calculate ping packet loss and color from green to red
// Even one lost packet is a problem!
// ===================================================================
export function getPingColorInfo(linkData, isDark = false) {
  if (!linkData) return null;
  const metrics = formatPingRateWithPackets(linkData);
  if (!metrics) return null;

  let lossRate = 0;
  let dropped = 0;
  if (
    metrics.packetsTotal != null &&
    metrics.packetsTotal > 0 &&
    metrics.packetsSuccess != null
  ) {
    dropped = Math.max(0, metrics.packetsTotal - metrics.packetsSuccess);
    lossRate = (dropped / metrics.packetsTotal) * 100;
  } else if (metrics.rate != null) {
    lossRate = Math.max(0, 100 - metrics.rate);
    dropped = lossRate > 0 ? 1 : 0;
  }
  if (metrics.packetsLost != null) {
    dropped = Math.max(dropped, metrics.packetsLost);
  }
  lossRate = Math.max(0, Math.min(100, lossRate));

  // Even one lost packet is a problem!
  // When zero packets fell: healthy green
  // When ANY packet fell (dropped > 0 or lossRate > 0): immediately show warning amber, scaling to critical red
  let color;
  if (dropped === 0 && lossRate === 0) {
    color = isDark ? "#4ade80" : "#22c55e"; // Healthy green
  } else {
    // Problem range: amber -> orange -> red
    const problemRange = isDark
      ? ["#facc15", "#fb923c", "#f87171"]
      : ["#f59e0b", "#ea580c", "#ef4444"];
    const problemScale = d3
      .scaleLinear()
      .domain([0, 20, 100])
      .range(problemRange)
      .clamp(true);
    color = problemScale(Math.max(1, lossRate));
  }

  return {
    color,
    lossRate,
    dropped,
    metrics,
  };
}

// ===================================================================
// Fast Apply / Restore Marked Links & Nodes State (Hardware CSS Accelerated)
// ===================================================================
export function applyMarkedState({
  svg,
  markedLinkIds,
  hoveredLinkId,
  hoveredFilter,
  activeFilter,
  pingSubFilter = "all",
  palette,
  theme,
}) {
  if (!svg || !svg.node()) return;

  const isDark = theme === "dark";
  const defaultLinkColor = palette?.link || (isDark ? "#94a3b8" : "#6b7280");
  const defaultNodeColor = palette?.node || "#29c6e0";
  const defaultNodeStroke = palette?.stroke || (isDark ? "#60a5fa" : "#1d4ed8");

  // Hovered filter previews take priority over active drawer filter
  const effectiveFilter = hoveredFilter || activeFilter;
  const hasFilter = Boolean(effectiveFilter);
  const hasMarked =
    (markedLinkIds && markedLinkIds.size > 0) ||
    Boolean(hoveredLinkId) ||
    hasFilter;

  if (!hasMarked) {
    svg
      .selectAll("line.visible-link")
      .attr("stroke", (d) => {
        const s = normalizeLinkStatus(d);
        if (s === "down") return palette?.status?.down || "#ef4444";
        if (s === "issue") return palette?.status?.issue || "#f59e0b";
        return defaultLinkColor;
      })
      .attr("stroke-opacity", (d) => {
        const s = normalizeLinkStatus(d);
        return s === "down" || s === "issue" ? 1.0 : 0.6;
      })
      .attr("stroke-width", (d) => {
        const s = normalizeLinkStatus(d);
        return s === "down" ? 3 : s === "issue" ? 2.5 : 2;
      })
      .style("opacity", 1);

    svg
      .selectAll("circle.node")
      .style("opacity", 0.9)
      .attr("fill", defaultNodeColor)
      .attr("stroke", defaultNodeStroke)
      .attr("stroke-width", 2)
      .style("pointer-events", "auto")
      .style("cursor", "pointer")
      .style("filter", null);

    svg
      .selectAll("path.duplicate-link")
      .attr("stroke", (d) => {
        const s = normalizeLinkStatus(d);
        if (s === "down") return palette?.status?.down || "#ef4444";
        if (s === "issue") return palette?.status?.issue || "#f59e0b";
        return defaultLinkColor;
      })
      .attr("stroke-opacity", (d) => {
        const s = normalizeLinkStatus(d);
        return s === "down" || s === "issue" ? 1.0 : 0.6;
      })
      .attr("stroke-width", (d) => {
        const s = normalizeLinkStatus(d);
        return s === "down" ? 3 : s === "issue" ? 2.5 : 2;
      });

    svg
      .selectAll("line.link-hover, path.duplicate-link-hover")
      .style("pointer-events", "auto")
      .style("cursor", "pointer");

    svg
      .selectAll("text.label")
      .style("opacity", 1)
      .attr("font-weight", "normal")
      .attr("fill", palette.label);

    svg.selectAll("line.visible-link > title, path.duplicate-link > title").remove();

    return;
  }

  // =================================================================
  // 1. SPECIAL PING MODE (hovering Ping Total or active Ping filter)
  // Shows a color on every link relative to packets that fell (green -> red)
  // =================================================================
  if (effectiveFilter === "ping") {
    const activeEndpoints = new Set();
    const effectivePingSubFilter = hoveredFilter === "ping" ? "all" : (pingSubFilter || "all");

    const applyPingStyle = (selection) => {
      selection.each(function (d) {
        if (!d) return;
        const pingInfo = getPingColorInfo(d, isDark);
        const sourceId = typeof d.source === "object" ? d.source.id : d.source;
        const targetId = typeof d.target === "object" ? d.target.id : d.target;
        const el = d3.select(this);

        if (pingInfo) {
          const dropped = pingInfo.dropped ?? (pingInfo.metrics?.packetsLost ?? 0);
          const hasLoss = dropped > 0 || pingInfo.lossRate > 0;

          let matchesSubFilter = true;
          if (effectivePingSubFilter === "issues") {
            matchesSubFilter = hasLoss;
          } else if (effectivePingSubFilter === "healthy") {
            matchesSubFilter = !hasLoss;
          }

          if (matchesSubFilter) {
            activeEndpoints.add(sourceId);
            activeEndpoints.add(targetId);

            const isHovered = hoveredLinkId && (
              d.id === hoveredLinkId ||
              Boolean(d.allIds && d.allIds.includes(hoveredLinkId))
            );

            el.raise()
              .attr("stroke", pingInfo.color)
              .attr("stroke-opacity", 1)
              .attr("stroke-width", isHovered ? (hasLoss ? 7.0 : 5.5) : (hasLoss ? 5.5 : 4.0));

            let titleEl = el.select("title");
            if (titleEl.empty()) {
              titleEl = el.append("title");
            }
            const sName = typeof d.source === "object" ? d.source.name || d.source.id : d.source;
            const tName = typeof d.target === "object" ? d.target.name || d.target.id : d.target;
            let lossText;
            if (!hasLoss) {
              lossText = "0% packet loss (Healthy)";
            } else {
              const lossPctText = pingInfo.lossRate < 0.1 ? "<0.1%" : `${pingInfo.lossRate.toFixed(1)}%`;
              lossText = `⚠️ ${dropped} packet${dropped > 1 ? "s" : ""} lost (${lossPctText} loss)`;
            }
            const packetText = pingInfo.metrics?.shortRatio ? ` (${pingInfo.metrics.shortRatio} received)` : "";
            titleEl.text(`${sName} ⟷ ${tName}: ${lossText}${packetText}`);
          } else {
            el.attr("stroke", defaultLinkColor)
              .attr("stroke-opacity", 0.12)
              .attr("stroke-width", 1.5);
            el.select("title").remove();
          }
        } else {
          el.attr("stroke", defaultLinkColor)
            .attr("stroke-opacity", 0.12)
            .attr("stroke-width", 1.5);
          el.select("title").remove();
        }
      });
    };

    applyPingStyle(svg.selectAll("line.visible-link"));
    applyPingStyle(svg.selectAll("path.duplicate-link"));

    svg.selectAll("line.link-hover, path.duplicate-link-hover").each(function (d) {
      const hasPing = Boolean(getPingColorInfo(d, isDark));
      d3.select(this)
        .style("pointer-events", hasPing ? "auto" : "none")
        .style("cursor", hasPing ? "pointer" : "default");
    });

    // In ping mode, keep nodes active and clean cyan
    svg.selectAll("circle.node").each(function (d) {
      if (!d) return;
      const isEndpoint = activeEndpoints.has(d.id);
      if (isEndpoint) {
        d3.select(this)
          .raise()
          .style("opacity", 1)
          .attr("fill", defaultNodeColor)
          .attr("stroke", defaultNodeStroke)
          .attr("stroke-width", 2.5)
          .attr("r", 60)
          .style("pointer-events", "auto")
          .style("cursor", "pointer")
          .style("filter", "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.25))");
      } else {
        d3.select(this)
          .style("opacity", 0.25)
          .attr("fill", defaultNodeColor)
          .attr("stroke", defaultNodeStroke)
          .attr("stroke-width", 2)
          .attr("r", 60)
          .style("pointer-events", "auto")
          .style("cursor", "pointer")
          .style("filter", null);
      }
    });

    svg.selectAll("text.label").each(function (d) {
      if (!d) return;
      const isEndpoint = activeEndpoints.has(d.id);
      d3.select(this)
        .style("opacity", isEndpoint ? 1 : 0.3)
        .attr("font-weight", isEndpoint ? "600" : "normal")
        .attr("fill", palette.label);
    });

    return;
  }

  // =================================================================
  // 2. STATUS FILTER (Up / Down / Issue) OR MARKED LINKS MODE
  // =================================================================
  const activeEndpoints = new Set();
  const markedIdsSet = new Set(markedLinkIds || []);
  if (hoveredLinkId) markedIdsSet.add(hoveredLinkId);

  const isLinkActive = (d) => {
    if (!d) return false;
    if (hoveredFilter) {
      const status = normalizeLinkStatus(d);
      return status === hoveredFilter;
    }
    if (markedIdsSet.size > 0 || hoveredLinkId) {
      return (
        markedIdsSet.has(d.id) ||
        Boolean(d.allIds && d.allIds.some((id) => markedIdsSet.has(id)))
      );
    }
    if (activeFilter && activeFilter !== "all") {
      const status = normalizeLinkStatus(d);
      return status === activeFilter;
    }
    return false;
  };

  const applyStatusStyle = (selection) => {
    selection.each(function (d) {
      if (!d) return;
      const isMarked = isLinkActive(d);
      const highlightColor = getLinkColorByCategory(d, palette);
      const sourceId = typeof d.source === "object" ? d.source.id : d.source;
      const targetId = typeof d.target === "object" ? d.target.id : d.target;
      const el = d3.select(this);

      if (isMarked) {
        activeEndpoints.add(sourceId);
        activeEndpoints.add(targetId);

        el.raise()
          .attr("stroke", highlightColor)
          .attr("stroke-opacity", 1)
          .attr("stroke-width", 4.5);

        let titleEl = el.select("title");
        if (titleEl.empty()) {
          titleEl = el.append("title");
        }
        const sName = typeof d.source === "object" ? d.source.name || d.source.id : d.source;
        const tName = typeof d.target === "object" ? d.target.name || d.target.id : d.target;
        const statusLabel = d.status || d.normalizedStatus || "link";
        titleEl.text(`${sName} ⟷ ${tName} (${statusLabel.toUpperCase()})`);
      } else {
        el.attr("stroke", defaultLinkColor)
          .attr("stroke-opacity", 0.12)
          .attr("stroke-width", 1.5);
        el.select("title").remove();
      }
    });
  };

  applyStatusStyle(svg.selectAll("line.visible-link"));
  applyStatusStyle(svg.selectAll("path.duplicate-link"));

  // 3. Hover Hitboxes
  svg.selectAll("line.link-hover").each(function (d) {
    const isMarked = isLinkActive(d);
    d3.select(this)
      .style("pointer-events", isMarked ? "auto" : "none")
      .style("cursor", isMarked ? "pointer" : "default");
  });

  svg.selectAll("path.duplicate-link-hover").each(function (d) {
    const isMarked = isLinkActive(d);
    d3.select(this)
      .style("pointer-events", isMarked ? "auto" : "none")
      .style("cursor", isMarked ? "pointer" : "default");
  });

  // 4. Nodes
  svg.selectAll("circle.node").each(function (d) {
    if (!d) return;
    const isEndpoint = activeEndpoints.has(d.id);
    if (isEndpoint) {
      d3.select(this)
        .raise()
        .style("opacity", 1)
        .attr("fill", palette.nodeHoverLink || "#fde047")
        .attr("stroke", palette.nodeHoverLinkStroke || "rgba(250, 204, 21, 0.2)")
        .attr("stroke-width", 4.5)
        .attr("r", 60)
        .style("pointer-events", "auto")
        .style("cursor", "pointer")
        .style("filter", "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))");
    } else {
      d3.select(this)
        .style("opacity", 0.25)
        .attr("fill", defaultNodeColor)
        .attr("stroke", defaultNodeStroke)
        .attr("stroke-width", 2)
        .attr("r", 60)
        .style("pointer-events", "auto")
        .style("cursor", "pointer")
        .style("filter", null);
    }
  });

  // 5. Labels
  svg.selectAll("text.label").each(function (d) {
    if (!d) return;
    const isEndpoint = activeEndpoints.has(d.id);
    d3.select(this)
      .style("opacity", isEndpoint ? 1 : 0.3)
      .attr("font-weight", isEndpoint ? "bold" : "normal")
      .attr("fill", isEndpoint ? (palette.nodeHoverLinkLabel || palette.label) : palette.label);
  });
}

// ===================================================================
// Function to remove all dynamically drawn parallel links
// ===================================================================
export function removeAllParallelLinks(zoomLayer) {
  if (zoomLayer) {
    zoomLayer
      .selectAll("path.duplicate-link, path.duplicate-link-hover")
      .remove();
  }
}

// ===================================================================
// ===================================================================
// Helper: Compute parallel link path (straight lines with parallel offsets)
// ===================================================================
export function computeParallelLinkPath({
  sourceNode,
  targetNode,
  offset = 0,
  nodeRadius = 60,
}) {
  const { x1, y1, x2, y2 } = linkPositionFromEdges(
    { source: sourceNode, target: targetNode },
    nodeRadius
  );

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) {
    return {
      d: "",
      startX: x1,
      startY: y1,
      endX: x2,
      endY: y2,
      ux: 0,
      uy: 0,
      perpX: 0,
      perpY: 0,
    };
  }

  const ux = dx / length;
  const uy = dy / length;
  const perpX = -uy;
  const perpY = ux;

  const startX = x1 + perpX * offset;
  const startY = y1 + perpY * offset;
  const endX = x2 + perpX * offset;
  const endY = y2 + perpY * offset;

  return {
    d: `M${startX},${startY} L${endX},${endY}`,
    startX,
    startY,
    endX,
    endY,
    ux,
    uy,
    perpX,
    perpY,
  };
}

// Function to draw all parallel links across the entire graph
// ===================================================================
export function drawAllParallelLinks({
  zoomLayer,
  allNodes,
  filteredLinks,
  tooltip,
  palette,
  onLinkClick,
  getMarkedLinkIds,
  getActiveFilter,
  getPingSubFilter,
  getTheme,
}) {
  if (!zoomLayer) return;

  const nodeMap = new Map();
  allNodes.forEach((n) => nodeMap.set(n.id, n));

  const linkGroups = new Map();
  filteredLinks.forEach((link) => {
    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;
    const key = [sourceId, targetId].sort().join("--");

    if (!linkGroups.has(key)) {
      linkGroups.set(key, []);
    }
    linkGroups.get(key).push(link);
  });

  const svgNode = zoomLayer.node().ownerSVGElement;
  const svg = d3.select(svgNode);

  // Sort link groups so inter-zone links are rendered first, and intra-zone links last (on top in SVG DOM)
  const sortedLinkGroups = Array.from(linkGroups.values()).sort((a, b) => {
    const aFirst = a[0];
    const bFirst = b[0];
    const aSId = typeof aFirst.source === "object" ? aFirst.source.id : aFirst.source;
    const aTId = typeof aFirst.target === "object" ? aFirst.target.id : aFirst.target;
    const bSId = typeof bFirst.source === "object" ? bFirst.source.id : bFirst.source;
    const bTId = typeof bFirst.target === "object" ? bFirst.target.id : bFirst.target;

    const aS = nodeMap.get(aSId);
    const aT = nodeMap.get(aTId);
    const bS = nodeMap.get(bSId);
    const bT = nodeMap.get(bTId);

    const aIsIntra = aS && aT && aS.zone && aS.zone === aT.zone;
    const bIsIntra = bS && bT && bS.zone && bS.zone === bT.zone;

    if (aIsIntra && !bIsIntra) return 1;
    if (!aIsIntra && bIsIntra) return -1;

    const distA = aS && aT ? Math.hypot(aT.x - aS.x, aT.y - aS.y) : 0;
    const distB = bS && bT ? Math.hypot(bT.x - bS.x, bT.y - bS.y) : 0;
    return distB - distA;
  });

  sortedLinkGroups.forEach((duplicates) => {
    if (duplicates.length === 0) return;

    const firstLink = duplicates[0];
    const sourceId =
      typeof firstLink.source === "object"
        ? firstLink.source.id
        : firstLink.source;
    const targetId =
      typeof firstLink.target === "object"
        ? firstLink.target.id
        : firstLink.target;

    const sourceNode = nodeMap.get(sourceId);
    const targetNode = nodeMap.get(targetId);

    if (!sourceNode || !targetNode) return;

    const isIntra = sourceNode.zone && targetNode.zone && sourceNode.zone === targetNode.zone;
    const hoverStrokeWidth = isIntra ? 16 : 12;

    duplicates.forEach((linkData, index) => {
      const offset = 10 * (index - (duplicates.length - 1) / 2);
      const pathInfo = computeParallelLinkPath({
        sourceNode,
        targetNode,
        offset,
        nodeRadius: 60,
      });

      if (!pathInfo.d) return;

      const { d: pathD, startX, startY, endX, endY, ux, uy, perpX, perpY } = pathInfo;

      const linkStatus = normalizeLinkStatus(linkData);
      const isDown = linkStatus === "down";
      const isIssue = linkStatus === "issue";
      const initialStroke = isDown
        ? (palette?.status?.down || "#ef4444")
        : isIssue
        ? (palette?.status?.issue || "#f59e0b")
        : palette.link;
      const initialStrokeWidth = isDown ? 3 : isIssue ? 2.5 : 2;
      const initialOpacity = isDown || isIssue ? 1.0 : 0.6;

      zoomLayer
        .append("path")
        .datum(linkData)
        .attr("class", "duplicate-link")
        .attr("d", pathD)
        .attr("fill", "none")
        .attr("stroke", initialStroke)
        .attr("stroke-opacity", initialOpacity)
        .attr("stroke-width", initialStrokeWidth)
        .attr("vector-effect", "non-scaling-stroke")
        .style("pointer-events", "none");

      zoomLayer
        .append("path")
        .datum(linkData)
        .attr("class", "duplicate-link-hover")
        .attr("d", pathD)
        .attr("fill", "none")
        .attr("stroke", "transparent")
        .attr("stroke-width", hoverStrokeWidth)
        .style("cursor", "pointer")
        .on("mouseenter", function (event, d_hover) {
          const markedIds = getMarkedLinkIds ? getMarkedLinkIds() : null;
          if (markedIds && markedIds.size > 0 && !markedIds.has(d_hover.id)) {
            return;
          }

          const s_id = typeof d_hover.source === "object" ? d_hover.source.id : d_hover.source;
          const t_id = typeof d_hover.target === "object" ? d_hover.target.id : d_hover.target;

          svg.selectAll("circle.node").each(function (n) {
            if (!n) return;
            if (n.id === s_id || n.id === t_id) {
              d3.select(this)
                .attr("fill", palette.nodeHoverLink)
                .attr("stroke", palette.nodeHoverLinkStroke || "#facc15")
                .attr("stroke-width", 4)
                .style("opacity", 1)
                .style("filter", "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))");
            } else {
              d3.select(this).style("opacity", 0.3).style("filter", null);
            }
          });

          // Highlight only this duplicate link, dim others
          svg.selectAll("path.duplicate-link").each(function (l) {
            if (!l) return;
            if (l.id === d_hover.id) {
              d3.select(this)
                .raise()
                .attr("stroke", getLinkColorByCategory(l, palette))
                .attr("stroke-opacity", 1.0)
                .attr("stroke-width", 5);
            } else {
              d3.select(this)
                .attr("stroke-opacity", 0.15)
                .attr("stroke-width", 2);
            }
          });

          // Remove the mouse-tracking tooltip logic
          // tooltip.attr("opacity", 0);

          // Calculate inner points near the nodes
          const edgeMargin = 25; // Pixels inward from the node edge
          const lift = 8; // Pixels perpendicular to the line to lift the text

          const localX = startX + ux * edgeMargin - perpX * lift;
          const localY = startY + uy * edgeMargin - perpY * lift;
          const remoteX = endX - ux * edgeMargin - perpX * lift;
          const remoteY = endY - uy * edgeMargin - perpY * lift;

          // Cleanup any existing temporary labels
          zoomLayer.selectAll(".edge-label-temp").remove();

          if (d_hover.local_interface) {
            zoomLayer
              .append("text")
              .attr("class", "edge-label-temp")
              .attr("x", localX)
              .attr("y", localY)
              .attr("text-anchor", "middle")
              .attr("dominant-baseline", "central")
              .attr("font-size", "12px")
              .attr("font-weight", "bold")
              .attr("fill", palette.label || "#fff")
              .attr("stroke", palette.bg || "#000")
              .attr("stroke-width", 3)
              .style("paint-order", "stroke")
              .style("pointer-events", "none")
              .text(d_hover.local_interface);
          }

          if (d_hover.remote_interface) {
            zoomLayer
              .append("text")
              .attr("class", "edge-label-temp")
              .attr("x", remoteX)
              .attr("y", remoteY)
              .attr("text-anchor", "middle")
              .attr("dominant-baseline", "central")
              .attr("font-size", "12px")
              .attr("font-weight", "bold")
              .attr("fill", palette.label || "#fff")
              .attr("stroke", palette.bg || "#000")
              .attr("stroke-width", 3)
              .style("paint-order", "stroke")
              .style("pointer-events", "none")
              .text(d_hover.remote_interface);
          }
        })
        .on("mousemove", function () {
          // Intentionally do nothing on mousemove now since the labels are fixed to the edges
        })
        .on("mouseleave", function () {
          tooltip.attr("opacity", 0);
          zoomLayer.selectAll(".edge-label-temp").remove();
          const markedIds = getMarkedLinkIds ? getMarkedLinkIds() : null;
          const activeFilter = getActiveFilter ? getActiveFilter() : null;
          const pingSubFilter = getPingSubFilter ? getPingSubFilter() : "all";
          const currentTheme = getTheme ? getTheme() : (palette?.isDark ? "dark" : "light");
          if ((markedIds && markedIds.size > 0) || activeFilter) {
            applyMarkedState({
              svg,
              markedLinkIds: markedIds,
              activeFilter,
              pingSubFilter,
              palette,
              theme: currentTheme,
            });
            return;
          }

          svg
            .selectAll("circle.node")
            .attr("fill", palette.node)
            .attr("stroke", palette.stroke)
            .attr("stroke-width", 2)
            .style("opacity", 0.9);

          svg
            .selectAll("path.duplicate-link")
            .attr("stroke", (d) => {
              const s = normalizeLinkStatus(d);
              if (s === "down") return palette?.status?.down || "#ef4444";
              if (s === "issue") return palette?.status?.issue || "#f59e0b";
              return palette.link;
            })
            .attr("stroke-opacity", (d) => {
              const s = normalizeLinkStatus(d);
              return s === "down" || s === "issue" ? 1.0 : 0.6;
            })
            .attr("stroke-width", (d) => {
              const s = normalizeLinkStatus(d);
              return s === "down" ? 3 : s === "issue" ? 2.5 : 2;
            });
        })
        .on("click", function (event, d_clicked) {
          if (onLinkClick) {
            const payload = createLinkPopupPayload(d_clicked);
            if (payload) onLinkClick(payload);
          }
          event.stopPropagation();
        });
    });
  });
}

// ===================================================================
// Node Mouse Over Handler (Adjacency Index Fast Lookup)
// ===================================================================
export function handleNodeMouseOver(
  d_node,
  linkSelection,
  palette,
  getMarkedLinkIds,
  graphIndex
) {
  if (!d_node || !d_node.id) return;
  const nodeId = d_node.id;
  const markedIds = getMarkedLinkIds ? getMarkedLinkIds() : null;
  const hasMarked = markedIds && markedIds.size > 0;

  const svgNode = linkSelection?.node()?.ownerSVGElement;
  const svg = svgNode ? d3.select(svgNode) : d3.select("svg");

  // Check if this node is an endpoint of any marked link
  let hasActiveMarked = false;
  if (hasMarked) {
    const nodeLinks = graphIndex?.linksByNode?.get(nodeId) || [];
    hasActiveMarked = nodeLinks.some((l) => markedIds.has(l.id));
  }

  // If marked links are active and this node is NOT an endpoint of any marked link,
  // still highlight the hovered node,
  // without changing the marked links display.
  if (hasMarked && !hasActiveMarked) {
    svg.selectAll("circle.node").each(function (n) {
      if (!n) return;
      if (n.id === nodeId) {
        d3.select(this)
          .attr("fill", palette.nodeHoverDirect || "#fde047")
          .attr("stroke", palette.nodeHoverLinkStroke || "#facc15")
          .attr("stroke-width", 4.5)
          .style("opacity", 1)
          .style("filter", "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))");
      }
    });
    return;
  }

  const connectedLinkIds = new Set(
    (graphIndex?.linksByNode?.get(nodeId) || [])
      .filter((l) => !hasMarked || markedIds.has(l.id))
      .map((l) => l.id)
  );

  const neighborNodeIds = new Set();
  (graphIndex?.linksByNode?.get(nodeId) || []).forEach((l) => {
    if (hasMarked && !markedIds.has(l.id)) return;
    const sId = typeof l.source === "object" ? l.source.id : l.source;
    const tId = typeof l.target === "object" ? l.target.id : l.target;
    if (sId === nodeId && tId) neighborNodeIds.add(tId);
    if (tId === nodeId && sId) neighborNodeIds.add(sId);
  });

  // 1. Highlight connected straight links
  svg.selectAll("line.visible-link").each(function (l) {
    if (!l) return;
    const isConnected = connectedLinkIds.has(l.id);
    const isMarked = !hasMarked || markedIds.has(l.id);

    if (isConnected) {
      d3.select(this)
        .attr("stroke", getLinkColorByCategory(l, palette))
        .attr("stroke-opacity", 1.0)
        .attr("stroke-width", 5);
    } else {
      d3.select(this)
        .attr(
          "stroke",
          hasMarked && isMarked
            ? getLinkColorByCategory(l, palette)
            : palette.link
        )
        .attr("stroke-opacity", hasMarked && isMarked ? 0.35 : 0.1)
        .attr("stroke-width", hasMarked && isMarked ? 3 : 1.5);
    }
  });

  // 2. Duplicate / parallel links
  svg.selectAll("path.duplicate-link").each(function (l) {
    if (!l) return;
    const isConnected = connectedLinkIds.has(l.id);
    const isMarked = !hasMarked || markedIds.has(l.id);

    if (isConnected) {
      d3.select(this)
        .attr("stroke", getLinkColorByCategory(l, palette))
        .attr("stroke-opacity", 1.0)
        .attr("stroke-width", 5);
    } else {
      d3.select(this)
        .attr(
          "stroke",
          hasMarked && isMarked
            ? getLinkColorByCategory(l, palette)
            : palette.link
        )
        .attr("stroke-opacity", hasMarked && isMarked ? 0.35 : 0.1)
        .attr("stroke-width", hasMarked && isMarked ? 3 : 1.5);
    }
  });

  // 3. Highlight hovered node & neighbors
  svg.selectAll("circle.node").each(function (n) {
    if (!n) return;
    if (n.id === nodeId) {
      d3.select(this)
        .attr("fill", palette.nodeHoverDirect || "#fde047")
        .attr("stroke", palette.nodeHoverLinkStroke || "#facc15")
        .attr("stroke-width", 4.5)
        .style("opacity", 1)
        .style("filter", "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))");
    } else if (neighborNodeIds.has(n.id)) {
      d3.select(this)
        .attr("fill", palette.nodeHoverLink || "#fde047")
        .attr("stroke", palette.nodeHoverLinkStroke || "#facc15")
        .attr("stroke-width", 3.5)
        .style("opacity", 1)
        .style("filter", "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))");
    } else {
      d3.select(this)
        .attr("fill", palette.node)
        .attr("stroke", palette.stroke)
        .attr("stroke-width", 2)
        .style("opacity", hasMarked ? 0.15 : 0.25)
        .style("filter", null);
    }
  });

  // 4. Labels
  svg.selectAll("text.label").each(function (n) {
    if (!n) return;
    const isRelevant = n.id === nodeId || neighborNodeIds.has(n.id);
    d3.select(this)
      .style("opacity", isRelevant ? 1 : 0.25)
      .attr("font-weight", isRelevant ? "bold" : "normal")
      .attr("fill", isRelevant ? (palette.nodeHoverLinkLabel || palette.label) : palette.label);
  });
}

// ===================================================================
// Node Mouse Out Handler
// ===================================================================
export function handleNodeMouseOut(
  d_node,
  linkSelection,
  palette,
  getMarkedLinkIds,
  getActiveFilter,
  getPingSubFilter,
  getTheme
) {
  const markedIds = getMarkedLinkIds ? getMarkedLinkIds() : null;
  const activeFilter = getActiveFilter ? getActiveFilter() : null;
  const pingSubFilter = getPingSubFilter ? getPingSubFilter() : "all";
  const currentTheme = getTheme ? getTheme() : (palette?.isDark ? "dark" : "light");
  const svgNode = linkSelection?.node()?.ownerSVGElement;
  const svg = svgNode ? d3.select(svgNode) : d3.select("svg");

  if ((markedIds && markedIds.size > 0) || activeFilter) {
    applyMarkedState({
      svg,
      markedLinkIds: markedIds,
      activeFilter,
      pingSubFilter,
      palette,
      theme: currentTheme,
    });
    return;
  }

  // Restore everything instantly
  svg
    .selectAll("line.visible-link")
    .attr("stroke", (d) => {
      const s = normalizeLinkStatus(d);
      if (s === "down") return palette?.status?.down || "#ef4444";
      if (s === "issue") return palette?.status?.issue || "#f59e0b";
      return palette.link;
    })
    .attr("stroke-opacity", (d) => {
      const s = normalizeLinkStatus(d);
      return s === "down" || s === "issue" ? 1.0 : 0.6;
    })
    .attr("stroke-width", (d) => {
      const s = normalizeLinkStatus(d);
      return s === "down" ? 3 : s === "issue" ? 2.5 : 2;
    })
    .style("opacity", 1);

  svg
    .selectAll("path.duplicate-link")
    .attr("stroke", (d) => {
      const s = normalizeLinkStatus(d);
      if (s === "down") return palette?.status?.down || "#ef4444";
      if (s === "issue") return palette?.status?.issue || "#f59e0b";
      return palette.link;
    })
    .attr("stroke-opacity", (d) => {
      const s = normalizeLinkStatus(d);
      return s === "down" || s === "issue" ? 1.0 : 0.6;
    })
    .attr("stroke-width", (d) => {
      const s = normalizeLinkStatus(d);
      return s === "down" ? 3 : s === "issue" ? 2.5 : 2;
    });

  svg
    .selectAll("circle.node")
    .attr("fill", palette.node)
    .attr("stroke", palette.stroke)
    .attr("stroke-width", 2)
    .style("opacity", 0.9)
    .style("filter", null);

  svg
    .selectAll("text.label")
    .style("opacity", 1)
    .attr("font-weight", "normal")
    .attr("fill", palette.label);
}

// ===================================================================
// Draw temporary parallel links for a specific source/target pair
// ===================================================================
export function drawTempParallelLinks({
  zoomLayer,
  sourceId,
  targetId,
  allLinks,
  allNodes,
  palette,
  tooltip,
  onLinkClick,
}) {
  if (!zoomLayer) return;

  const duplicates = allLinks.filter(l => {
    const ls = typeof l.source === "object" ? l.source.id : l.source;
    const lt = typeof l.target === "object" ? l.target.id : l.target;
    return (ls === sourceId && lt === targetId) || (ls === targetId && lt === sourceId);
  });

  if (duplicates.length <= 1) return;

  const nodeMap = new Map();
  allNodes.forEach((n) => nodeMap.set(n.id, n));

  const sourceNode = nodeMap.get(sourceId);
  const targetNode = nodeMap.get(targetId);
  if (!sourceNode || !targetNode) return;

  const nodeRadius = 60;
  const { x1, y1, x2, y2 } = linkPositionFromEdges(
    { source: sourceNode, target: targetNode },
    nodeRadius
  );

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return;

  const ux = dx / length;
  const uy = dy / length;
  const perpX = -uy;
  const perpY = ux;

  // Hide the straight visible link for this pair
  zoomLayer.selectAll("line.visible-link").filter(l => {
    if (!l) return false;
    const ls = typeof l.source === "object" ? l.source.id : l.source;
    const lt = typeof l.target === "object" ? l.target.id : l.target;
    return (ls === sourceId && lt === targetId) || (ls === targetId && lt === sourceId);
  }).style("opacity", 0);

  // Dynamically increase the hitbox of the straight line so the mouse doesn't fall into the gaps
  const maxOffset = 10 * ((duplicates.length - 1) / 2);
  const hoverWidth = maxOffset * 2 + 30; // 30 is base padding
  zoomLayer.selectAll("line.link-hover").filter(l => {
    if (!l) return false;
    const ls = typeof l.source === "object" ? l.source.id : l.source;
    const lt = typeof l.target === "object" ? l.target.id : l.target;
    return (ls === sourceId && lt === targetId) || (ls === targetId && lt === sourceId);
  }).attr("stroke-width", Math.max(20, hoverWidth));

  const svgNode = zoomLayer.node().ownerSVGElement;
  const svg = d3.select(svgNode);

  duplicates.forEach((linkData, index) => {
    const offset = 10 * (index - (duplicates.length - 1) / 2);
    const pathInfo = computeParallelLinkPath({
      sourceNode,
      targetNode,
      offset,
      nodeRadius: 60,
    });

    if (!pathInfo.d) return;

    const { d: pathD, startX, startY, endX, endY, ux, uy, perpX, perpY } = pathInfo;

    zoomLayer
      .append("path")
      .datum(linkData)
      .attr("class", "temp-duplicate-link")
      .attr("d", pathD)
      .attr("fill", "none")
      .attr("stroke", getLinkColorByCategory(linkData, palette))
      .attr("stroke-width", 3)
      .attr("vector-effect", "non-scaling-stroke")
      .style("pointer-events", "stroke")
      .style("cursor", "pointer")
      .on("mouseover", function (event, d_temp) {
        d3.select(this).attr("stroke", getLinkColorByCategory(d_temp, palette)).attr("stroke-width", 5);

        // Calculate inner points near the nodes
        const edgeMargin = 25; // Pixels inward from the node edge
        const lift = 8; // Pixels perpendicular to the line to lift the text

        const localX = startX + ux * edgeMargin - perpX * lift;
        const localY = startY + uy * edgeMargin - perpY * lift;
        const remoteX = endX - ux * edgeMargin - perpX * lift;
        const remoteY = endY - uy * edgeMargin - perpY * lift;

        // Cleanup any existing temporary labels
        zoomLayer.selectAll(".edge-label-temp").remove();

        if (d_temp.local_interface) {
          zoomLayer
            .append("text")
            .attr("class", "edge-label-temp")
            .attr("x", localX)
            .attr("y", localY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", palette.label || "#fff")
            .attr("stroke", palette.bg || "#000")
            .attr("stroke-width", 3)
            .style("paint-order", "stroke")
            .style("pointer-events", "none")
            .text(d_temp.local_interface);
        }

        if (d_temp.remote_interface) {
          zoomLayer
            .append("text")
            .attr("class", "edge-label-temp")
            .attr("x", remoteX)
            .attr("y", remoteY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", palette.label || "#fff")
            .attr("stroke", palette.bg || "#000")
            .attr("stroke-width", 3)
            .style("paint-order", "stroke")
            .style("pointer-events", "none")
            .text(d_temp.remote_interface);
        }
      })
      .on("mousemove", function () {
        // Intentionally left blank as labels are static
      })
      .on("mouseout", function (event) {
        d3.select(this).attr("stroke-width", 3);
        zoomLayer.selectAll(".edge-label-temp").remove();

        if (event && event.relatedTarget && event.relatedTarget.classList &&
          (event.relatedTarget.classList.contains("temp-duplicate-link") ||
            event.relatedTarget.classList.contains("link-hover"))) {
          return;
        }

        svg.selectAll(".temp-duplicate-link").remove();
        svg.selectAll("line.visible-link").style("opacity", 1);
        if (tooltip) tooltip.attr("opacity", 0);
      })
      .on("click", function (event, d_temp) {
        if (onLinkClick) {
          onLinkClick(createLinkPopupPayload(d_temp));
        }
        event.stopPropagation();
      });
  });
}

// ===================================================================
// Straight Link Mouse Over Handler
// ===================================================================
function handleMouseOver(
  d_link,
  linkSelection,
  tooltip,
  palette,
  getMarkedLinkIds,
  event,
  zoomLayer,
  filteredLinks,
  allNodes,
  onLinkClick
) {
  if (!d_link) return;
  const markedIds = getMarkedLinkIds ? getMarkedLinkIds() : null;
  if (markedIds && markedIds.size > 0 && !markedIds.has(d_link.id)) {
    return;
  }

  const svgNode = linkSelection?.node()?.ownerSVGElement;
  const svg = svgNode ? d3.select(svgNode) : d3.select("svg");

  const sId = typeof d_link.source === "object" ? d_link.source.id : d_link.source;
  const tId = typeof d_link.target === "object" ? d_link.target.id : d_link.target;

  // Temporarily show parallel links for this hovered pair
  if (zoomLayer && filteredLinks && allNodes) {
    drawTempParallelLinks({
      zoomLayer,
      sourceId: sId,
      targetId: tId,
      allLinks: filteredLinks,
      allNodes,
      palette,
      tooltip,
      onLinkClick,
    });
  }

  // Highlight hovered link, dim others
  svg.selectAll("line.visible-link").each(function (l) {
    if (!l) return;
    if (l.id === d_link.id) {
      d3.select(this)
        .attr("stroke", getLinkColorByCategory(l, palette))
        .attr("stroke-opacity", 1.0)
        .attr("stroke-width", 5);
    } else {
      d3.select(this)
        .attr("stroke-opacity", 0.12)
        .attr("stroke-width", 1.5);
    }
  });

  // Highlight endpoint nodes
  svg.selectAll("circle.node").each(function (n) {
    if (!n) return;
    if (n.id === sId || n.id === tId) {
      d3.select(this)
        .attr("fill", palette.nodeHoverLink || "#fde047")
        .attr("stroke", palette.nodeHoverLinkStroke || "#facc15")
        .attr("stroke-width", 4)
        .style("opacity", 1);
    } else {
      d3.select(this).style("opacity", 0.25);
    }
  });

  // Tooltip tracking removed in favor of edge labels
}

// ===================================================================
// Straight Link Mouse Out Handler
// ===================================================================
function handleMouseOut(
  linkSelection,
  tooltip,
  palette,
  getMarkedLinkIds,
  event,
  getActiveFilter,
  getPingSubFilter,
  getTheme
) {
  // If moving to a temporary duplicate link, do NOT tear down!
  if (
    event &&
    event.relatedTarget &&
    event.relatedTarget.classList &&
    event.relatedTarget.classList.contains("temp-duplicate-link")
  ) {
    return;
  }

  tooltip.attr("opacity", 0);
  const markedIds = getMarkedLinkIds ? getMarkedLinkIds() : null;
  const activeFilter = getActiveFilter ? getActiveFilter() : null;
  const pingSubFilter = getPingSubFilter ? getPingSubFilter() : "all";
  const currentTheme = getTheme ? getTheme() : (palette?.isDark ? "dark" : "light");
  const svgNode = linkSelection?.node()?.ownerSVGElement;
  const svg = svgNode ? d3.select(svgNode) : d3.select("svg");

  // Remove temporary parallel links
  svg.selectAll(".temp-duplicate-link").remove();

  // Restore the straight link hover area
  svg.selectAll("line.link-hover").attr("stroke-width", 20);

  if ((markedIds && markedIds.size > 0) || activeFilter) {
    applyMarkedState({
      svg,
      markedLinkIds: markedIds,
      activeFilter,
      pingSubFilter,
      palette,
      theme: currentTheme,
    });
    return;
  }

  svg
    .selectAll("line.visible-link")
    .attr("stroke", (d) => {
      const s = normalizeLinkStatus(d);
      if (s === "down") return palette?.status?.down || "#ef4444";
      if (s === "issue") return palette?.status?.issue || "#f59e0b";
      return palette.link;
    })
    .attr("stroke-opacity", (d) => {
      const s = normalizeLinkStatus(d);
      return s === "down" || s === "issue" ? 1.0 : 0.6;
    })
    .attr("stroke-width", (d) => {
      const s = normalizeLinkStatus(d);
      return s === "down" ? 3 : s === "issue" ? 2.5 : 2;
    })
    .style("opacity", 1);

  svg
    .selectAll("circle.node")
    .attr("fill", palette.node)
    .attr("stroke", palette.stroke)
    .attr("stroke-width", 2)
    .style("opacity", 0.9)
    .style("filter", null);

  svg
    .selectAll("text.label")
    .style("opacity", 1)
    .attr("font-weight", "normal")
    .attr("fill", palette.label);
}

// ===================================================================
// Main Setup Interactions function
// ===================================================================
export function setupInteractions({
  link,
  linkHover,
  filteredLinks,
  node,
  tooltip,
  tooltipLayer,
  palette,
  zoomLayer,
  onLinkClick,
  getMarkedLinkIds,
  getActiveFilter,
  getPingSubFilter,
  getTheme,
}) {
  if (!zoomLayer || !zoomLayer.node() || !linkHover || !linkHover.size()) {
    return;
  }

  const svgNode = zoomLayer.node().ownerSVGElement;
  const svg = d3.select(svgNode);
  const isDark = Boolean(palette?.isDark || palette?.bg === "#1f2937");

  // Ensure node tooltip card exists in tooltipLayer or svg
  const tLayer = tooltipLayer || svg.select(".tooltip-layer-group");
  let nodeTooltip = null;
  if (tLayer && !tLayer.empty()) {
    tLayer.selectAll(".node-tooltip-card").remove();
    nodeTooltip = tLayer
      .append("g")
      .attr("class", "node-tooltip-card")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("transition", "opacity 0.15s ease-out");

    nodeTooltip
      .append("rect")
      .attr("class", "node-tooltip-bg")
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("filter", "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.3))");

    nodeTooltip
      .append("text")
      .attr("class", "node-tooltip-title")
      .attr("x", 12)
      .attr("y", 20)
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("font-family", "system-ui, -apple-system, sans-serif");

    nodeTooltip
      .append("text")
      .attr("class", "node-tooltip-action")
      .attr("x", 12)
      .attr("y", 37)
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("font-family", "system-ui, -apple-system, sans-serif");
  }

  function showNodeTooltip(event, d_node) {
    if (!nodeTooltip || !d_node) return;
    const name = d_node.shortName || d_node.id || d_node.name || "Device";
    const zone = d_node.zone || d_node.coresite_name || "";
    const titleText = zone ? `🖥️  ${name} (${zone})` : `🖥️  ${name}`;
    const actionText = "Click to view device links & interfaces ↗";

    const titleEl = nodeTooltip.select(".node-tooltip-title");
    const actionEl = nodeTooltip.select(".node-tooltip-action");
    const bgEl = nodeTooltip.select(".node-tooltip-bg");

    titleEl
      .text(titleText)
      .attr("fill", isDark ? "#f1f5f9" : "#0f172a");

    actionEl
      .text(actionText)
      .attr("fill", isDark ? "#38bdf8" : "#2563eb");

    const titleWidth = titleEl.node() ? titleEl.node().getComputedTextLength() : 120;
    const actionWidth = actionEl.node() ? actionEl.node().getComputedTextLength() : 220;
    const cardWidth = Math.max(titleWidth, actionWidth) + 24;
    const cardHeight = 48;

    bgEl
      .attr("width", cardWidth)
      .attr("height", cardHeight)
      .attr("fill", isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.98)")
      .attr("stroke", isDark ? "rgba(56, 189, 248, 0.4)" : "rgba(37, 99, 235, 0.35)")
      .attr("stroke-width", 1);

    updateNodeTooltipPos(event, cardWidth, cardHeight);
    nodeTooltip.style("opacity", 1);
  }

  function updateNodeTooltipPos(event, cardWidth = 240, cardHeight = 48) {
    if (!nodeTooltip || !svgNode) return;
    const [px, py] = d3.pointer(event, svgNode);
    const svgRect = svgNode.getBoundingClientRect();
    let tx = px + 14;
    let ty = py - cardHeight - 12;

    if (tx + cardWidth > (svgRect.width || 800) - 12) {
      tx = px - cardWidth - 14;
    }
    if (tx < 12) {
      tx = 12;
    }
    if (ty < 12) {
      ty = py + 22;
    }
    nodeTooltip.attr("transform", `translate(${tx}, ${ty})`);
  }

  function hideNodeTooltip() {
    if (nodeTooltip) {
      nodeTooltip.style("opacity", 0);
    }
  }

  // Build Adjacency Graph Index
  const linksByNode = new Map();
  (filteredLinks || []).forEach((l) => {
    const sId = typeof l.source === "object" ? l.source.id : l.source;
    const tId = typeof l.target === "object" ? l.target.id : l.target;
    if (sId) {
      if (!linksByNode.has(sId)) linksByNode.set(sId, []);
      linksByNode.get(sId).push(l);
    }
    if (tId) {
      if (!linksByNode.has(tId)) linksByNode.set(tId, []);
      linksByNode.get(tId).push(l);
    }
  });

  const graphIndex = { linksByNode };

  const handleNodeEnter = function (event, d_node) {
    handleNodeMouseOver(
      d_node,
      link,
      palette,
      getMarkedLinkIds,
      graphIndex
    );
    showNodeTooltip(event, d_node);
  };

  const handleNodeMove = function (event) {
    updateNodeTooltipPos(event);
  };

  const handleNodeLeave = function (_event, d_node) {
    hideNodeTooltip();
    handleNodeMouseOut(
      d_node,
      link,
      palette,
      getMarkedLinkIds,
      getActiveFilter,
      getPingSubFilter,
      getTheme
    );
  };

  // Node hover interactions
  if (node && node.size()) {
    node
      .on("mouseover", handleNodeEnter)
      .on("mousemove", handleNodeMove)
      .on("mouseout", handleNodeLeave);
  }

  // Link hover interactions
  linkHover
    .on("mouseover", function (event, d_hovered) {
      handleMouseOver(
        d_hovered,
        link,
        tooltip,
        palette,
        getMarkedLinkIds,
        event,
        zoomLayer,
        filteredLinks,
        node ? node.data() : [],
        onLinkClick
      );
    })
    .on("mousemove", function (event, d_hovered) {
      const markedIds = getMarkedLinkIds ? getMarkedLinkIds() : null;
      if (markedIds && markedIds.size > 0 && !markedIds.has(d_hovered.id)) {
        return;
      }
      const [px, py] = d3.pointer(event, svgNode);
      tooltip.attr("x", px + 12).attr("y", py - 12);
    })
    .on("mouseout", function (event) {
      handleMouseOut(
        link,
        tooltip,
        palette,
        getMarkedLinkIds,
        event,
        getActiveFilter,
        getPingSubFilter,
        getTheme
      );
    })
    .on("click", function (event, d_clicked) {
      if (onLinkClick) {
        const payload = createLinkPopupPayload(d_clicked);
        if (payload) onLinkClick(payload);
      }
      event.stopPropagation();
    });

  // Global SVG pointerleave safety check to prevent any stuck hover state
  svg.on("pointerleave.clearHover", function () {
    handleNodeMouseOut(
      null,
      link,
      palette,
      getMarkedLinkIds,
      getActiveFilter,
      getPingSubFilter,
      getTheme
    );
    hideNodeTooltip();
  });
}
