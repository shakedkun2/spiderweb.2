import { cleanDeviceKey } from "./drawHelpers";

/**
 * Returns a list of devices in a zone from topology devices and all devices.
 */
export function getZoneDeviceList(zoneName, topologyDevices = [], allDevices = []) {
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
}

/**
 * Analyzes a link and determines which zone it belongs to, whether it's a 6-device zone,
 * and if extended nodes (devices 4, 5, 7, 8) should be shown.
 */
export function getLinkZoneInfo(link, topologyDevices = [], allDevices = []) {
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

  const srcDevList = srcZone ? getZoneDeviceList(srcZone, topologyDevices, allDevices) : [];
  const tgtDevList = tgtZone ? getZoneDeviceList(tgtZone, topologyDevices, allDevices) : [];

  let chosenZone = null;
  let chosenDevList = [];

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
}

/**
 * Calculates navigation target URL and state for a link.
 * If visible on the main map: targets the base chart with highlight state.
 * If not visible on the main map: targets the specific zone with 4-device extended state.
 */
export function getLinkNavigationTarget(link, topologyDevices = [], allDevices = []) {
  if (!link) return null;

  const isP =
    link.network_type_id === 2 ||
    (link.rawLink && link.rawLink.network_type_id === 2);
  const basePath = isP ? "/p-chart" : "/l-chart";

  const linkId = link.id || link.link_id;

  if (link.isVisibleOnMap) {
    return {
      path: basePath,
      state: {
        focusedLinkId: linkId,
        downedLinkId: linkId,
      },
    };
  }

  const zoneInfo = getLinkZoneInfo(link, topologyDevices, allDevices);
  if (zoneInfo && zoneInfo.zone) {
    return {
      path: `${basePath}/zone/${encodeURIComponent(zoneInfo.zone)}?showExtended=${zoneInfo.shouldShowExtended}`,
      state: {
        showExtendedNodes: zoneInfo.shouldShowExtended,
        targetNodeId: zoneInfo.relevantDevice,
        focusedNode: zoneInfo.relevantDevice,
        downedLinkId: linkId,
      },
    };
  }

  return {
    path: basePath,
    state: {
      downedLinkId: linkId,
    },
  };
}
