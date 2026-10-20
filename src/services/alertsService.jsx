import { api } from "./apiServices";
import {
  cleanDeviceKey,
  normalizeInterfaceName,
  getMissingPacketsCount,
} from "../components/chart/drawHelpers";
import { getLinkNavigationTarget } from "../components/chart/linkNavigationHelpers";

export const PERIOD_DAYS_MAP = {
  "24h": 1,
  "1w": 7,
  "2w": 14,
  "1m": 30,
};

function selectTopTwoDevices(devices) {
  if (!Array.isArray(devices) || devices.length <= 2) return devices || [];
  const priorityOrder = [4, 5, 1, 2, 7, 8];

  const getEnding = (name) => {
    if (!name) return NaN;
    const match = String(name).match(/(\d+)(?!.*\d)/);
    return match ? parseInt(match[1], 10) : NaN;
  };

  const sortedDevices = [...devices].sort((a, b) => {
    const a_ending = getEnding(a.name || a.hostname);
    const b_ending = getEnding(b.name || b.hostname);

    const a_priority = priorityOrder.indexOf(a_ending);
    const b_priority = priorityOrder.indexOf(b_ending);

    const final_a_priority = a_priority === -1 ? 99 : a_priority;
    const final_b_priority = b_priority === -1 ? 99 : b_priority;

    return final_a_priority - final_b_priority;
  });

  return sortedDevices.slice(0, 2);
}

/**
 * Builds a canonical key for a pair of devices and interfaces to deduplicate bidirectional events.
 */
function getEventDeduplicationKey(ev, canonicalLinkId) {
  const d1 = cleanDeviceKey(ev.local_device_name || `dev-${ev.local_device_id || ""}`);
  const d2 = cleanDeviceKey(ev.remote_device_name || `dev-${ev.remote_device_id || ""}`);
  const devKey = [d1, d2].sort().join("<->");

  const if1 = normalizeInterfaceName(ev.local_interface || "");
  const if2 = normalizeInterfaceName(ev.remote_interface || "");
  const ifKey = [if1, if2].sort().join("<->");

  const eventType = String(ev.event_type || "").toLowerCase().trim().replace(/\s+/g, "_");
  const timeMs = new Date(ev.created_at || ev.changed_at || 0).getTime();
  // Group timestamps within a 15-second window so reports from both endpoints align
  const timeBucket = Math.floor(timeMs / 15000);

  const linkId = canonicalLinkId || ev.link_id;
  return linkId ? `${linkId}::${eventType}::${timeBucket}` : `${devKey}::${ifKey}::${eventType}::${timeBucket}`;
}

/**
 * Fetches and aggregates alerts from api/core-topology-events and api/core-topology.
 *
 * @param {string} period - '24h' | '1w' | '2w' | '1m'
 * @returns {Promise<Array>} Processed, deduplicated alerts array
 */
export async function fetchAggregatedAlerts(period = "24h") {
  const days = PERIOD_DAYS_MAP[period] || 1;

  // 1. Fetch both endpoints in parallel
  const [eventsRes, topologyRes] = await Promise.all([
    api.getCoreTopologyEvents({ days }).catch((err) => {
      console.error("Failed to fetch core topology events for alerts:", err);
      return [];
    }),
    api.getCoreTopology().catch((err) => {
      console.error("Failed to fetch core topology for alerts:", err);
      return { devices: [] };
    }),
  ]);

  // 2. Parse devices and extract canonical links from topology
  const devices = Array.isArray(topologyRes?.devices)
    ? topologyRes.devices
    : Array.isArray(topologyRes?.data?.devices)
    ? topologyRes.data.devices
    : Array.isArray(topologyRes)
    ? topologyRes
    : [];

  // Group devices by site to find top devices visible on the top-level map
  const devicesBySite = devices.reduce((acc, device) => {
    const siteName = device.coresite_name || device.zoneName || device.core_site_name || "Unknown";
    if (!acc[siteName]) {
      acc[siteName] = [];
    }
    acc[siteName].push(device);
    return acc;
  }, {});

  const topDevicesPerSite = Object.values(devicesBySite).flatMap(
    (deviceGroup) => selectTopTwoDevices(deviceGroup)
  );

  const visibleDeviceNames = new Set(
    topDevicesPerSite.map((d) => cleanDeviceKey(d.hostname || d.name))
  );

  const canonicalLinksMap = new Map();
  const warningsList = [];

  devices.forEach((dev) => {
    const devLinks = dev.links || dev.interfaces || [];
    devLinks.forEach((rawLink) => {
      const srcName = dev.hostname || dev.name || rawLink.sourceName || rawLink.local_device_name;
      const tgtName =
        rawLink.targetName ||
        rawLink.remote_device_name ||
        rawLink.neighbor_coredevice_name ||
        rawLink.target;

      if (!srcName || !tgtName) return;

      const d1 = cleanDeviceKey(srcName);
      const d2 = cleanDeviceKey(tgtName);
      const devKey = [d1, d2].sort().join("<->");

      const if1 = normalizeInterfaceName(rawLink.local_interface || rawLink.interface || "");
      const if2 = normalizeInterfaceName(rawLink.remote_interface || "");
      const ifKey = [if1, if2].sort().join("<->");

      const linkKey = rawLink.id != null ? `link-${rawLink.id}` : `${devKey}::${ifKey}`;

      if (!canonicalLinksMap.has(linkKey)) {
        const isBothDevicesVisible = Boolean(
          visibleDeviceNames.has(d1) && visibleDeviceNames.has(d2)
        );

        const enrichedLink = {
          ...rawLink,
          id: rawLink.id ?? rawLink.link_id,
          sourceName: srcName,
          targetName: tgtName,
          local_interface: rawLink.local_interface || rawLink.interface,
          remote_interface: rawLink.remote_interface,
          sourceZone: rawLink.sourceZone || dev.coresite_name || dev.zoneName,
          targetZone: rawLink.targetZone,
          network_type_id: rawLink.network_type_id || dev.network_type_id || 1,
          isVisibleOnMap: rawLink.isVisibleOnMap !== undefined ? Boolean(rawLink.isVisibleOnMap) : isBothDevicesVisible,
          rawLink,
        };
        canonicalLinksMap.set(linkKey, enrichedLink);

        // Check for Warning: 10 ping packets lost (same condition as 'issue' in side drawer)
        const missingPackets = getMissingPacketsCount(enrichedLink);
        if (missingPackets >= 10) {
          const timestamp =
            enrichedLink.last_ping_at ||
            enrichedLink.rawLink?.last_ping_at ||
            enrichedLink.statusDate ||
            new Date().toISOString();

          const navTarget = getLinkNavigationTarget(enrichedLink, devices, devices);

          warningsList.push({
            id: `warning-loss-${enrichedLink.id || linkKey}`,
            type: "warning",
            eventType: "packet_loss",
            message: `High Packet Loss (${missingPackets} lost): ${srcName} ⟷ ${tgtName}`,
            networkLine: `${srcName} ⟷ ${tgtName}`,
            source: srcName,
            timestamp,
            severityScore: Math.min(10, Math.max(5, Math.floor(missingPackets / 10))),
            details: `Ping test on ${srcName} (${enrichedLink.local_interface || "N/A"}) ⟷ ${tgtName} (${enrichedLink.remote_interface || "N/A"}) detected ${missingPackets} lost packets.`,
            link: enrichedLink,
            navigationTarget: navTarget,
          });
        }
      }
    });
  });

  // 3. Process and deduplicate events from api/core-topology-events
  const rawEvents = Array.isArray(eventsRes)
    ? eventsRes
    : Array.isArray(eventsRes?.events)
    ? eventsRes.events
    : Array.isArray(eventsRes?.data?.events)
    ? eventsRes.data.events
    : Array.isArray(eventsRes?.data)
    ? eventsRes.data
    : [];

  const seenEventKeys = new Set();
  const eventAlerts = [];

  rawEvents.forEach((ev) => {
    const evType = String(ev.event_type || "").toLowerCase().trim().replace(/\s+/g, "_");

    let alertType = null;
    let title = "";
    let severityScore = 5;

    // Errors: link down, ospf drop
    if (evType === "link_down") {
      alertType = "error";
      title = "Link Down";
      severityScore = 10;
    } else if (evType === "ospf_drop") {
      alertType = "error";
      title = "OSPF Drop";
      severityScore = 8;
    }
    // Info: link up, ospf full
    else if (evType === "link_up") {
      alertType = "info";
      title = "Link Up";
      severityScore = 3;
    } else if (evType === "ospf_full" || evType === "ospf_up") {
      alertType = "info";
      title = "OSPF Full";
      severityScore = 3;
    } else {
      // Skip unrecognized event types
      return;
    }

    const d1 = ev.local_device_name || `Device-${ev.local_device_id || "A"}`;
    const d2 = ev.remote_device_name || `Device-${ev.remote_device_id || "B"}`;
    const if1 = ev.local_interface || "";
    const if2 = ev.remote_interface || "";

    // Deduplicate between Device 1 and Device 2
    const dedupKey = getEventDeduplicationKey(ev, ev.link_id);
    if (seenEventKeys.has(dedupKey)) {
      return;
    }
    seenEventKeys.add(dedupKey);

    // Find matching link from topology if available
    let matchedLink = null;
    if (ev.link_id != null && canonicalLinksMap.has(`link-${ev.link_id}`)) {
      matchedLink = canonicalLinksMap.get(`link-${ev.link_id}`);
    } else {
      const devKey = [cleanDeviceKey(d1), cleanDeviceKey(d2)].sort().join("<->");
      const ifKey = [normalizeInterfaceName(if1), normalizeInterfaceName(if2)].sort().join("<->");
      matchedLink =
        canonicalLinksMap.get(`${devKey}::${ifKey}`) ||
        Array.from(canonicalLinksMap.values()).find((l) => {
          const lD1 = cleanDeviceKey(l.sourceName);
          const lD2 = cleanDeviceKey(l.targetName);
          return (lD1 === cleanDeviceKey(d1) && lD2 === cleanDeviceKey(d2)) ||
                 (lD1 === cleanDeviceKey(d2) && lD2 === cleanDeviceKey(d1));
        }) || null;
    }

    const timestamp = ev.created_at || ev.changed_at || new Date().toISOString();
    const eventId = `event-${ev.id || `${cleanDeviceKey(d1)}-${cleanDeviceKey(d2)}-${evType}-${new Date(timestamp).getTime()}`}`;

    const linkPayload = matchedLink || {
      id: ev.link_id,
      link_id: ev.link_id,
      sourceName: d1,
      targetName: d2,
      local_interface: if1,
      remote_interface: if2,
      network_type_id: 1,
      isVisibleOnMap: Boolean(
        visibleDeviceNames.has(cleanDeviceKey(d1)) && visibleDeviceNames.has(cleanDeviceKey(d2))
      ),
    };

    const navTarget = getLinkNavigationTarget(linkPayload, devices, devices);

    eventAlerts.push({
      id: eventId,
      type: alertType,
      eventType: evType,
      message: `${title}: ${d1} ⟷ ${d2}`,
      networkLine: `${d1} ⟷ ${d2}`,
      source: d1,
      timestamp,
      severityScore,
      details: `Event type: ${evType}. Local interface: ${if1 || "N/A"}, Remote interface: ${if2 || "N/A"}. Reported by ${d1}.`,
      link: linkPayload,
      navigationTarget: navTarget,
    });
  });

  // 4. Combine all alerts and sort newest first
  const allAlerts = [...eventAlerts, ...warningsList].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return allAlerts;
}
