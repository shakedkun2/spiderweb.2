import { api } from "./apiServices";
import {
  cleanDeviceKey,
  normalizeInterfaceName,
  getMissingPacketsCount,
} from "../components/chart/drawHelpers";
import {
  getLinkNavigationTarget,
  isPChartDevice,
} from "../components/chart/linkNavigationHelpers";

export const PERIOD_DAYS_MAP = {
  "24h": 1,
  "1w": 7,
  "2w": 14,
  "1m": 30,
};

export function parseEventTimestamp(val) {
  if (!val) return 0;
  if (typeof val === "number") {
    return val < 1e11 ? val * 1000 : val;
  }
  const s = String(val).trim();
  if (!s) return 0;

  if (/^\d+$/.test(s)) {
    const num = Number(s);
    return num < 1e11 ? num * 1000 : num;
  }

  let d = new Date(s);
  if (!isNaN(d.getTime())) return d.getTime();

  // Try ISO with space: "2026-10-20 02:41:10"
  d = new Date(s.replace(" ", "T"));
  if (!isNaN(d.getTime())) return d.getTime();

  // "20/10/2026 02:41:10" or "20-10-2026 02:41:10"
  const matchDmy = s.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  );
  if (matchDmy) {
    const day = parseInt(matchDmy[1], 10);
    const month = parseInt(matchDmy[2], 10) - 1;
    const year = parseInt(matchDmy[3], 10);
    const h = matchDmy[4] ? parseInt(matchDmy[4], 10) : 0;
    const m = matchDmy[5] ? parseInt(matchDmy[5], 10) : 0;
    const sec = matchDmy[6] ? parseInt(matchDmy[6], 10) : 0;
    d = new Date(year, month, day, h, m, sec);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // Time-only: "02:41:10" or "2:41:10" (assume today)
  const matchTime = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (matchTime) {
    const now = new Date();
    d = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      parseInt(matchTime[1], 10),
      parseInt(matchTime[2], 10),
      matchTime[3] ? parseInt(matchTime[3], 10) : 0
    );
    if (!isNaN(d.getTime())) return d.getTime();
  }

  return 0;
}

function normalizeEventType(ev) {
  const raw = String(
    ev.event_type ||
      ev["event-type"] ||
      ev.type ||
      ev.eventType ||
      ""
  )
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, "_");

  const newStatus = String(
    ev.new_oper_status || ev.new_status || ev.status || ""
  )
    .toLowerCase()
    .trim();
  const newOspf = String(ev.new_ospf_state || "").toLowerCase().trim();

  // Errors: link_down, ospf_drop
  if (
    raw === "link_down" ||
    raw === "down" ||
    (raw.includes("down") && !raw.includes("ospf")) ||
    (newStatus === "down" && !raw.includes("ospf"))
  ) {
    return {
      type: "error",
      eventType: "link_down",
      title: "Link Down",
      severityScore: 10,
    };
  }

  if (
    raw === "ospf_drop" ||
    raw === "ospf_down" ||
    (raw.includes("ospf") &&
      (raw.includes("drop") ||
        raw.includes("down") ||
        newOspf === "down" ||
        newOspf === "2-way"))
  ) {
    return {
      type: "error",
      eventType: "ospf_drop",
      title: "OSPF Drop",
      severityScore: 8,
    };
  }

  // Info: link_up, ospf_full
  if (
    raw === "link_up" ||
    raw === "up" ||
    raw === "link_recovery" ||
    raw === "recovery" ||
    raw === "restored" ||
    (newStatus === "up" && !raw.includes("ospf"))
  ) {
    return {
      type: "info",
      eventType: "link_up",
      title: "Link Up",
      severityScore: 3,
    };
  }

  if (
    raw === "ospf_full" ||
    raw === "ospf_up" ||
    raw === "ospf_recovery" ||
    (raw.includes("ospf") &&
      (raw.includes("full") || raw.includes("recovery") || newOspf === "full"))
  ) {
    return {
      type: "info",
      eventType: "ospf_full",
      title: "OSPF Full",
      severityScore: 3,
    };
  }

  return null;
}

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
 * Fetches and aggregates alerts from api/core-topology-events and api/core-topology.
 * Unifies bidirectional links and deduplicates mirror events reported by both endpoints.
 *
 * @param {string} period - '24h' | '1w' | '2w' | '1m'
 * @returns {Promise<Array>} Processed, deduplicated alerts array (one alert per physical line)
 */
export async function fetchAggregatedAlerts(period = "1w") {
  const days = PERIOD_DAYS_MAP[period] || 7;

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
    const siteName =
      device.coresite_name || device.zoneName || device.core_site_name || "Unknown";
    if (!acc[siteName]) {
      acc[siteName] = [];
    }
    acc[siteName].push(device);
    return acc;
  }, {});

  const topDevicesPerSite = Object.values(devicesBySite).flatMap((deviceGroup) =>
    selectTopTwoDevices(deviceGroup)
  );

  const visibleDeviceNames = new Set(
    topDevicesPerSite.map((d) => cleanDeviceKey(d.hostname || d.name))
  );

  // Maps to unify bidirectional links into single physical line representations
  const canonicalLinksMap = new Map(); // signature -> canonicalLink
  const linkIdToCanonicalMap = new Map(); // link_id -> canonicalLink
  const endpointToCanonicalMap = new Map(); // "device::interface" -> canonicalLink
  const warningsList = [];

  const deviceMapById = new Map();
  devices.forEach((d) => {
    if (d.id != null) {
      deviceMapById.set(d.id, d);
      deviceMapById.set(String(d.id), d);
    }
    const clean = cleanDeviceKey(d.hostname || d.name || "");
    if (clean) {
      deviceMapById.set(clean, d);
    }
  });

  devices.forEach((dev) => {
    const devLinks = dev.links || dev.interfaces || [];
    devLinks.forEach((rawLink) => {
      const srcName =
        dev.hostname || dev.name || rawLink.sourceName || rawLink.local_device_name;
      const tgtName =
        rawLink.targetName ||
        rawLink.remote_device_name ||
        rawLink.neighbor_coredevice_name ||
        rawLink.target;

      if (!srcName || !tgtName) return;

      const d1 = cleanDeviceKey(srcName);
      const d2 = cleanDeviceKey(tgtName);
      const devKey = [d1, d2].sort().join("<->");

      const if1 = normalizeInterfaceName(
        rawLink.local_interface || rawLink.interface || ""
      );
      const if2 = normalizeInterfaceName(rawLink.remote_interface || "");
      const ifKey = [if1, if2].sort().join("<->");

      const ep1 = if1 ? `${d1}::${if1}` : null;
      const ep2 = if2 ? `${d2}::${if2}` : null;
      const sig = `${devKey}::${ifKey}`;

      // Check if this link matches an existing reciprocal canonical link
      let canonicalLink = null;
      if (rawLink.id != null && linkIdToCanonicalMap.has(rawLink.id)) {
        canonicalLink = linkIdToCanonicalMap.get(rawLink.id);
      } else if (rawLink.id != null && linkIdToCanonicalMap.has(String(rawLink.id))) {
        canonicalLink = linkIdToCanonicalMap.get(String(rawLink.id));
      } else if (canonicalLinksMap.has(sig)) {
        canonicalLink = canonicalLinksMap.get(sig);
      } else if (ep1 && endpointToCanonicalMap.has(ep1)) {
        canonicalLink = endpointToCanonicalMap.get(ep1);
      } else if (ep2 && endpointToCanonicalMap.has(ep2)) {
        canonicalLink = endpointToCanonicalMap.get(ep2);
      }

      if (canonicalLink) {
        // Link already exists (reciprocal direction from neighbor device)
        if (rawLink.id != null) {
          if (!canonicalLink.allIds.includes(rawLink.id)) {
            canonicalLink.allIds.push(rawLink.id);
          }
          linkIdToCanonicalMap.set(rawLink.id, canonicalLink);
          linkIdToCanonicalMap.set(String(rawLink.id), canonicalLink);
        }
        if (if1 && !canonicalLink.allInterfaces.includes(if1)) {
          canonicalLink.allInterfaces.push(if1);
        }
        if (if2 && !canonicalLink.allInterfaces.includes(if2)) {
          canonicalLink.allInterfaces.push(if2);
        }
      } else {
        // New canonical link representation for this physical line
        const isBothDevicesVisible = Boolean(
          visibleDeviceNames.has(d1) && visibleDeviceNames.has(d2)
        );

        // Canonically sort endpoint names so display is always consistent
        const isSorted = srcName.localeCompare(tgtName) <= 0;
        const canSrc = isSorted ? srcName : tgtName;
        const canTgt = isSorted ? tgtName : srcName;
        const canIf1 = isSorted ? if1 : if2;
        const canIf2 = isSorted ? if2 : if1;

        const remoteDevice =
          (rawLink.remote_device_id != null ? deviceMapById.get(rawLink.remote_device_id) : null) ||
          (rawLink.remote_device_id != null ? deviceMapById.get(String(rawLink.remote_device_id)) : null) ||
          deviceMapById.get(d2) ||
          null;

        const isP = Boolean(
          rawLink.network_type_id === 2 ||
          rawLink.remote_network_type_id === 2 ||
          dev.network_type_id === 2 ||
          isPChartDevice(dev) ||
          (remoteDevice && (remoteDevice.network_type_id === 2 || isPChartDevice(remoteDevice)))
        );

        canonicalLink = {
          ...rawLink,
          id: rawLink.id ?? rawLink.link_id,
          allIds: rawLink.id != null ? [rawLink.id] : [],
          sourceName: canSrc,
          targetName: canTgt,
          local_interface: canIf1,
          remote_interface: canIf2,
          allInterfaces: [if1, if2].filter(Boolean),
          sourceZone: rawLink.sourceZone || dev.coresite_name || dev.zoneName,
          targetZone: rawLink.targetZone,
          network_type_id: isP ? 2 : (rawLink.network_type_id || dev.network_type_id || 1),
          remote_network_type_id: remoteDevice?.network_type_id,
          isVisibleOnMap:
            rawLink.isVisibleOnMap !== undefined
              ? Boolean(rawLink.isVisibleOnMap)
              : isBothDevicesVisible,
          rawLink,
        };

        canonicalLinksMap.set(sig, canonicalLink);
        if (rawLink.id != null) {
          linkIdToCanonicalMap.set(rawLink.id, canonicalLink);
          linkIdToCanonicalMap.set(String(rawLink.id), canonicalLink);
        }
        if (ep1) endpointToCanonicalMap.set(ep1, canonicalLink);
        if (ep2) endpointToCanonicalMap.set(ep2, canonicalLink);
      }
    });
  });

  // Check warnings for packet loss once per canonical link
  canonicalLinksMap.forEach((canonicalLink) => {
    const missingPackets = getMissingPacketsCount(canonicalLink);
    if (missingPackets >= 10) {
      const rawTime =
        canonicalLink.last_ping_at ||
        canonicalLink.rawLink?.last_ping_at ||
        canonicalLink.statusDate ||
        new Date().toISOString();

      const timestampMs = parseEventTimestamp(rawTime) || Date.now();
      const timestampIso = new Date(timestampMs).toISOString();

      const navTarget = getLinkNavigationTarget(canonicalLink, devices, devices);
      const linkKey = `canonical-link-${canonicalLink.id}`;

      warningsList.push({
        id: `warning-loss-${canonicalLink.id}`,
        canonicalKey: linkKey,
        type: "warning",
        eventType: "packet_loss",
        message: `High Packet Loss (${missingPackets} lost): ${canonicalLink.sourceName} ⟷ ${canonicalLink.targetName}`,
        networkLine: `${canonicalLink.sourceName} ⟷ ${canonicalLink.targetName}`,
        source: canonicalLink.sourceName,
        timestamp: timestampIso,
        timestampMs,
        severityScore: Math.min(10, Math.max(5, Math.floor(missingPackets / 10))),
        details: `Ping test on ${canonicalLink.sourceName} (${
          canonicalLink.local_interface || "N/A"
        }) ⟷ ${canonicalLink.targetName} (${
          canonicalLink.remote_interface || "N/A"
        }) detected ${missingPackets} lost packets.`,
        link: canonicalLink,
        navigationTarget: navTarget,
      });
    }
  });

  // 3. Process events from api/core-topology-events
  const rawEvents = Array.isArray(eventsRes)
    ? eventsRes
    : Array.isArray(eventsRes?.events)
    ? eventsRes.events
    : Array.isArray(eventsRes?.data?.events)
    ? eventsRes.data.events
    : Array.isArray(eventsRes?.data)
    ? eventsRes.data
    : [];

  // Group events by canonical physical line
  const eventsByLine = new Map();

  rawEvents.forEach((ev) => {
    const norm = normalizeEventType(ev);
    if (!norm) return;

    const d1 = ev.local_device_name || `Device-${ev.local_device_id || "A"}`;
    const d2 = ev.remote_device_name || `Device-${ev.remote_device_id || "B"}`;
    const if1 = ev.local_interface || "";
    const if2 = ev.remote_interface || "";

    const cleanD1 = cleanDeviceKey(d1);
    const cleanD2 = cleanDeviceKey(d2);
    const devKey = [cleanD1, cleanD2].sort().join("<->");

    const normIf1 = normalizeInterfaceName(if1);
    const normIf2 = normalizeInterfaceName(if2);
    const ifKey = [normIf1, normIf2].sort().join("<->");

    const ep1 = normIf1 ? `${cleanD1}::${normIf1}` : null;
    const ep2 = normIf2 ? `${cleanD2}::${normIf2}` : null;

    // Match unified canonical link
    let matchedLink = null;
    if (ev.link_id != null && linkIdToCanonicalMap.has(ev.link_id)) {
      matchedLink = linkIdToCanonicalMap.get(ev.link_id);
    } else if (ev.link_id != null && linkIdToCanonicalMap.has(String(ev.link_id))) {
      matchedLink = linkIdToCanonicalMap.get(String(ev.link_id));
    } else if (canonicalLinksMap.has(`${devKey}::${ifKey}`)) {
      matchedLink = canonicalLinksMap.get(`${devKey}::${ifKey}`);
    } else if (ep1 && endpointToCanonicalMap.has(ep1)) {
      matchedLink = endpointToCanonicalMap.get(ep1);
    } else if (ep2 && endpointToCanonicalMap.has(ep2)) {
      matchedLink = endpointToCanonicalMap.get(ep2);
    } else {
      matchedLink =
        Array.from(canonicalLinksMap.values()).find((l) => {
          const lD1 = cleanDeviceKey(l.sourceName);
          const lD2 = cleanDeviceKey(l.targetName);
          return (
            (lD1 === cleanD1 && lD2 === cleanD2) ||
            (lD1 === cleanD2 && lD2 === cleanD1)
          );
        }) || null;
    }

    // Canonical key representing the physical line between both devices
    const canonicalKey = matchedLink
      ? `canonical-link-${matchedLink.id}`
      : `${devKey}::${ifKey && ifKey !== "<->" ? ifKey : "line"}`;

    const rawTime =
      ev.created_at ||
      ev.changed_at ||
      ev.timestamp ||
      ev.event_time ||
      ev.time ||
      ev.date ||
      ev.status_changed_at;

    const timestampMs = parseEventTimestamp(rawTime) || Date.now();
    const timestampIso = new Date(timestampMs).toISOString();

    const isSorted = d1.localeCompare(d2) <= 0;
    const canSrc = matchedLink ? matchedLink.sourceName : (isSorted ? d1 : d2);
    const canTgt = matchedLink ? matchedLink.targetName : (isSorted ? d2 : d1);
    const canIf1 = matchedLink ? matchedLink.local_interface : (isSorted ? if1 : if2);
    const canIf2 = matchedLink ? matchedLink.remote_interface : (isSorted ? if2 : if1);

    const localDevObj =
      (ev.local_device_id != null ? deviceMapById.get(ev.local_device_id) : null) ||
      (ev.local_device_id != null ? deviceMapById.get(String(ev.local_device_id)) : null) ||
      deviceMapById.get(cleanD1) ||
      null;

    const remoteDevObj =
      (ev.remote_device_id != null ? deviceMapById.get(ev.remote_device_id) : null) ||
      (ev.remote_device_id != null ? deviceMapById.get(String(ev.remote_device_id)) : null) ||
      deviceMapById.get(cleanD2) ||
      null;

    const isEvP = Boolean(
      ev.network_type_id === 2 ||
      (matchedLink && matchedLink.network_type_id === 2) ||
      isPChartDevice(remoteDevObj) ||
      isPChartDevice(localDevObj)
    );

    const linkPayload = matchedLink || {
      id: ev.link_id,
      link_id: ev.link_id,
      sourceName: canSrc,
      targetName: canTgt,
      local_interface: canIf1,
      remote_interface: canIf2,
      network_type_id: isEvP ? 2 : 1,
      remote_network_type_id: remoteDevObj?.network_type_id,
      local_device_id: ev.local_device_id,
      remote_device_id: ev.remote_device_id,
      isVisibleOnMap: Boolean(
        visibleDeviceNames.has(cleanD1) && visibleDeviceNames.has(cleanD2)
      ),
    };

    const parsedEvent = {
      ev,
      canonicalKey,
      eventType: norm.eventType,
      type: norm.type,
      title: norm.title,
      severityScore: norm.severityScore,
      srcName: canSrc,
      tgtName: canTgt,
      reportingDevice: d1,
      if1,
      if2,
      timestamp: timestampIso,
      timestampMs,
      link: linkPayload,
    };

    if (!eventsByLine.has(canonicalKey)) {
      eventsByLine.set(canonicalKey, []);
    }

    const lineList = eventsByLine.get(canonicalKey);

    // Deduplicate mirror reports between Device 1 and Device 2 within 60s
    const isMirror = lineList.some(
      (existing) =>
        existing.eventType === norm.eventType &&
        Math.abs(existing.timestampMs - timestampMs) <= 60000
    );

    if (!isMirror) {
      lineList.push(parsedEvent);
    }
  });

  // 4. For each canonical line, produce EXACTLY ONE alert representing its LATEST status
  const lineAlerts = [];

  eventsByLine.forEach((events, canonicalKey) => {
    // Sort all events for this line newest first
    events.sort((a, b) => b.timestampMs - a.timestampMs);

    const latest = events[0];
    const previous = events[1];

    let historyDetails = `Reported: ${latest.srcName} ⟷ ${latest.tgtName}.`;

    if (previous) {
      historyDetails += ` Previous state: ${previous.title} at ${new Date(
        previous.timestampMs
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.`;
    }

    const navTarget = getLinkNavigationTarget(latest.link, devices, devices);
    const eventId = `alert-${canonicalKey}-${latest.eventType}-${latest.timestampMs}`;

    lineAlerts.push({
      id: eventId,
      canonicalKey,
      type: latest.type,
      eventType: latest.eventType,
      message: `${latest.title}: ${latest.srcName} ⟷ ${latest.tgtName}`,
      networkLine: `${latest.srcName} ⟷ ${latest.tgtName}`,
      source: latest.srcName,
      timestamp: latest.timestamp,
      timestampMs: latest.timestampMs,
      severityScore: latest.severityScore,
      details: historyDetails,
      link: latest.link,
      navigationTarget: navTarget,
      history: events.map((e) => ({
        title: e.title,
        eventType: e.eventType,
        timestamp: e.timestamp,
        timestampMs: e.timestampMs,
      })),
    });
  });

  // 5. Combine line event alerts and warning alerts
  // If a line already has an event alert (e.g. down or up), event alert takes precedence over ping packet loss
  const seenKeys = new Set(lineAlerts.map((a) => a.canonicalKey));
  const activeWarnings = warningsList.filter((w) => !seenKeys.has(w.canonicalKey));

  const allAlerts = [...lineAlerts, ...activeWarnings].sort(
    (a, b) => (b.timestampMs || 0) - (a.timestampMs || 0)
  );

  return allAlerts;
}
