import React, { useCallback, useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import NetworkVisualizer5 from "../../components/chart/NetworkVisualizer5";
import LinkDetailPopup from "../../components/shared/LinkDetailPopup";
import NetworkLinksSideDrawer from "../../components/chart/NetworkLinksSideDrawer";
import ToggleDetailButton from "../../components/chart/ToggleDetailButton";
import { getLinkStatusAndDate, normalizeInterfaceName, cleanDeviceKey } from "../../components/chart/drawHelpers";
import { createLinkPopupPayload } from "../../components/chart/handleInteractions";
import { fetchInitialData } from "../../redux/slices/authSlice";
import { toggleFavoriteLink } from "../../redux/slices/favoritesSlice";
import {
  selectTopologyDevices,
  selectTopologyStatus,
  fetchCoreTopology,
} from "../../redux/slices/coreTopologySlice";
import { selectAllTrafficById } from "../../redux/slices/coreSiteTrafficSlice";
import { selectAllPikudim } from "../../redux/slices/corePikudimSlice";

// Import reusable feedback components
import { LoadingSpinner } from "../../components/ui/feedback/LoadingSpinner";
import { ErrorMessage } from "../../components/ui/feedback/ErrorMessage";

// Helper function to select top devices
function selectTopTwoDevices(devices) {
  if (devices.length <= 2) return devices;
  const priorityOrder = [4, 5, 1, 2, 7, 8];

  const getEnding = (name) => {
    if (!name) return NaN;
    // Extract the last sequence of digits in the string
    const match = name.match(/(\d+)(?!.*\d)/);
    return match ? parseInt(match[1], 10) : NaN;
  };

  const sortedDevices = [...devices].sort((a, b) => {
    const a_ending = getEnding(a.name);
    const b_ending = getEnding(b.name);

    const a_priority = priorityOrder.indexOf(a_ending);
    const b_priority = priorityOrder.indexOf(b_ending);

    const final_a_priority = a_priority === -1 ? 99 : a_priority;
    const final_b_priority = b_priority === -1 ? 99 : b_priority;

    return final_a_priority - final_b_priority;
  });
  return sortedDevices.slice(0, 2);
}

const NetworkVisualizer5Wrapper = ({ theme }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  // Poll core topology immediately on mount and then every 5 seconds
  React.useEffect(() => {
    dispatch(fetchCoreTopology());
    const interval = setInterval(() => {
      dispatch(fetchCoreTopology());
    }, 5000);
    return () => clearInterval(interval);
  }, [dispatch]);

  // Get topology data from the unified coreTopology slice
  const allTopologyDevices = useSelector(selectTopologyDevices);
  const topologyStatus = useSelector(selectTopologyStatus);
  const allTrafficById = useSelector(selectAllTrafficById);
  const allPikudim = useSelector(selectAllPikudim);

  const trafficByZone = useMemo(() => {
    const map = {};
    if (!allPikudim || !allTrafficById) return map;
    allPikudim.forEach((p) => {
      const traffic = allTrafficById[p.id] || allTrafficById[String(p.id)];
      if (traffic) {
        if (p.name) map[p.name] = traffic;
        if (p.core_site_name) map[p.core_site_name] = traffic;
      }
    });
    return map;
  }, [allPikudim, allTrafficById]);

  // Local UI state
  const [popupLink, setPopupLink] = useState(null);
  const [showDetailedLinks, setShowDetailedLinks] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [markedLinkIds, setMarkedLinkIds] = useState(new Set());
  const [hoveredLinkId, setHoveredLinkId] = useState(null);
  const [hoveredFilter, setHoveredFilter] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [pingSubFilter, setPingSubFilter] = useState("all");

  const handleOpenChange = useCallback((open) => {
    setIsDrawerOpen(open);
    if (!open) {
      setActiveFilter(null);
      setMarkedLinkIds(new Set());
    }
  }, []);

  const handleToggleMarkLink = (linkId) => {
    setMarkedLinkIds((prev) => {
      const next = new Set(prev);
      if (next.has(linkId)) {
        next.delete(linkId);
      } else {
        next.add(linkId);
      }
      return next;
    });
    // Sync the manually marked link with global favorites
    dispatch(toggleFavoriteLink(linkId));
  };

  const handleMarkAll = (linkIds) => {
    setMarkedLinkIds(new Set(linkIds));
  };

  const handleClearMarks = () => {
    setMarkedLinkIds(new Set());
  };

  // Build graph data from the core-topology endpoint
  const graphData = useMemo(() => {
    // Filter devices for this chart's network
    // P Chart: show devices with "anan_lekaman"/"anan-lekaman"/"p-network" network name,
    // plus the shared H-prefix devices (which have "ns" network name)
    const devicesForChart = allTopologyDevices.filter((d) => {
      if (!d.name) return false;
      const netName = (d.network_name || "").toLowerCase();
      const isPNetwork = netName.includes("anan-lekaman") || netName.includes("anan_lekaman") || netName.includes("p-network");
      const isSharedDevice = ["H1", "H2", "H4", "H5", "H7", "H8"].some((str) => d.name.includes(str));
      return isPNetwork || isSharedDevice;
    });

    if (devicesForChart.length === 0) {
      return { nodes: [], links: [] };
    }

    // Group devices by coresite_name (replaces pikudim lookup)
    const devicesBySite = devicesForChart.reduce((acc, device) => {
      const siteName = device.coresite_name || "Unknown";
      if (!acc[siteName]) {
        acc[siteName] = [];
      }
      acc[siteName].push(device);
      return acc;
    }, {});

    // Apply selectTopTwoDevices per zone group
    const topDevicesPerSite = Object.values(devicesBySite).flatMap(
      (deviceGroup) => selectTopTwoDevices(deviceGroup)
    );

    const visibleDeviceNames = new Set(topDevicesPerSite.map((d) => d.name));

    // Build a map of device id -> device for link resolution (supporting string and number IDs)
    const allDevicesMapById = new Map();
    allTopologyDevices.forEach((d) => {
      allDevicesMapById.set(d.id, d);
      if (d.id != null) {
        allDevicesMapById.set(String(d.id), d);
        if (!isNaN(Number(d.id))) allDevicesMapById.set(Number(d.id), d);
      }
    });

    const deviceMapById = new Map();
    devicesForChart.forEach((d) => {
      deviceMapById.set(d.id, d);
      if (d.id != null) {
        deviceMapById.set(String(d.id), d);
        if (!isNaN(Number(d.id))) deviceMapById.set(Number(d.id), d);
      }
    });

    // Helper to get short name
    const getShortName = (name) => {
      if (!name) return name;

      // 1. Shared site logic (Original method)
      const isSharedSite = ["H1", "H2", "H4", "H5", "H7", "H8"].some((str) => name.includes(str));
      if (isSharedSite) {
        const matches = name.match(/[a-zA-Z]\d+/g);
        return matches ? matches[matches.length - 1].toUpperCase() : name;
      }

      // 2. Format: aa<number>_bbb_L<1, 2 or 3>-<1 or 2>-ccc -> L<1, 2 or 3>-<1 or 2>
      const lMatch = name.match(/L[123]-[12]/i);
      if (lMatch) {
        return lMatch[0].toUpperCase();
      }

      // 3. Format: xx_yy_zzz_aaaaa<number> -> yy zzz <number>
      const parts = name.split('_');
      if (parts.length === 4) {
        const lastPartMatch = parts[3].match(/\d+$/);
        if (lastPartMatch) {
          const num = lastPartMatch[0];
          return `${parts[1]} ${parts[2]} ${num}`;
        }
      }

      // Fallback
      return name;
    };

    // Build nodes
    const transformedNodes = topDevicesPerSite.map((device) => ({
      id: device.name,
      group: "node",
      name: device.name,
      shortName: getShortName(device.name),
      ip: device.ip,
      zone: device.coresite_name || "Unknown",
      pikudId: device.coresite_name || "Unknown",
      nodeType: "router",
      status: device.status || "up",
      device: device,
    }));

    // Pre-calculate IP pair frequencies per device to identify bundle members sharing an IP
    const ipPairCountsPerDevice = new Map();
    devicesForChart.forEach((dev) => {
      if (!dev.links) return;
      const devKey = cleanDeviceKey(dev.name);
      dev.links.forEach((l) => {
        const locIp = l.local_link_ip || l.local_ip;
        const remIp = l.remote_link_ip || l.remote_ip;
        if (locIp && remIp) {
          const pair = [String(locIp).trim(), String(remIp).trim()].sort().join("<->");
          const key = `${devKey}##${pair}`;
          ipPairCountsPerDevice.set(key, (ipPairCountsPerDevice.get(key) || 0) + 1);
        }
      });
    });

    // Extract and deduplicate links from devices
    const seenLinkIds = new Set();
    const linksBySignature = new Map();
    const endpointToSignature = new Map();
    const uniqueIpPairToSignature = new Map();

    devicesForChart.forEach((device) => {
      if (!device.links) return;

      device.links.forEach((link) => {
        // Skip duplicate records by ID
        if (seenLinkIds.has(link.id)) return;
        seenLinkIds.add(link.id);

        const remoteDevice =
          (link.remote_device_id != null ? (deviceMapById.get(link.remote_device_id) || allDevicesMapById.get(link.remote_device_id)) : null) ||
          (link.remote_device_id != null ? (deviceMapById.get(String(link.remote_device_id)) || allDevicesMapById.get(String(link.remote_device_id))) : null);

        const canonicalRemoteDevName = (remoteDevice ? remoteDevice.name : null) || link.remote_device_name || "Unknown";
        const remoteDeviceName = canonicalRemoteDevName;
        const remoteZone = (remoteDevice ? remoteDevice.coresite_name : null) || link.remote_coresite_name || "Unknown";

        // Normalize oper_status and ospf_state to up/down/issue
        const { status: normalized, statusDate: linkStatusDate } = getLinkStatusAndDate(link);

        const isBothDevicesVisible = Boolean(
          visibleDeviceNames.has(device.name) &&
          remoteDevice &&
          visibleDeviceNames.has(remoteDevice.name)
        );

        // Determine link endpoints and normalized interface keys for bidirectional deduplication
        const localDevClean = cleanDeviceKey(device.name);
        const remDevClean = cleanDeviceKey(canonicalRemoteDevName);

        const rawLocalIf = link.local_interface ? String(link.local_interface).trim() : "";
        const rawRemoteIf = link.remote_interface ? String(link.remote_interface).trim() : "";

        const normLocalIf = normalizeInterfaceName(rawLocalIf);
        const normRemoteIf = normalizeInterfaceName(rawRemoteIf);

        const normLocalEp = normLocalIf ? `${localDevClean}::${normLocalIf}` : null;
        const normRemoteEp = normRemoteIf ? `${remDevClean}::${normRemoteIf}` : null;

        const rawLocalEp = rawLocalIf ? `${localDevClean}::${rawLocalIf}` : null;
        const rawRemoteEp = rawRemoteIf ? `${remDevClean}::${rawRemoteIf}` : null;

        const localDevId = device.id != null ? String(device.id) : null;
        const remoteDevId = (remoteDevice?.id ?? link.remote_device_id) != null ? String(remoteDevice?.id ?? link.remote_device_id) : null;

        const idLocalEp = (localDevId && normLocalIf) ? `id:${localDevId}::${normLocalIf}` : null;
        const idRemoteEp = (remoteDevId && normRemoteIf) ? `id:${remoteDevId}::${normRemoteIf}` : null;

        const localIp = link.local_link_ip || link.local_ip || null;
        const remoteIp = link.remote_link_ip || link.remote_ip || null;
        const ipPair = (localIp && remoteIp)
          ? [String(localIp).trim(), String(remoteIp).trim()].sort().join("<->")
          : null;

        const devIpKey = `${localDevClean}##${ipPair}`;
        const remDevIpKey = `${remDevClean}##${ipPair}`;
        const isSharedIpOnAnyDev = Boolean(
          (ipPairCountsPerDevice.get(devIpKey) || 0) > 1 ||
          (ipPairCountsPerDevice.get(remDevIpKey) || 0) > 1
        );

        const isBundleLink = Boolean(
          isSharedIpOnAnyDev ||
          /\b(?:bundle|be|port-channel|portchannel)\s*[-_]?\s*\d+/i.test(link.description || "") ||
          /\b(?:bundle|be|port-channel|portchannel)\s*[-_]?\s*\d+/i.test(link.local_interface_description || "")
        );

        const uniqueIpKey = (ipPair && !isBundleLink)
          ? `${[localDevClean, remDevClean].sort().join("---")}##${ipPair}`
          : null;

        // Try to match an existing reciprocal signature
        let signature = null;
        if (normLocalEp && endpointToSignature.has(normLocalEp)) {
          signature = endpointToSignature.get(normLocalEp);
        } else if (normRemoteEp && endpointToSignature.has(normRemoteEp)) {
          signature = endpointToSignature.get(normRemoteEp);
        } else if (idLocalEp && endpointToSignature.has(idLocalEp)) {
          signature = endpointToSignature.get(idLocalEp);
        } else if (idRemoteEp && endpointToSignature.has(idRemoteEp)) {
          signature = endpointToSignature.get(idRemoteEp);
        } else if (rawLocalEp && endpointToSignature.has(rawLocalEp)) {
          signature = endpointToSignature.get(rawLocalEp);
        } else if (rawRemoteEp && endpointToSignature.has(rawRemoteEp)) {
          signature = endpointToSignature.get(rawRemoteEp);
        } else if (uniqueIpKey && uniqueIpPairToSignature.has(uniqueIpKey)) {
          signature = uniqueIpPairToSignature.get(uniqueIpKey);
        }

        // If no existing signature matched, generate canonical signature
        if (!signature) {
          if (normLocalEp && normRemoteEp) {
            signature = [normLocalEp, normRemoteEp].sort().join("---");
          } else if (idLocalEp && idRemoteEp) {
            signature = [idLocalEp, idRemoteEp].sort().join("---");
          } else if (rawLocalEp && rawRemoteEp) {
            signature = [rawLocalEp, rawRemoteEp].sort().join("---");
          } else if (normLocalEp || normRemoteEp) {
            signature = [normLocalEp || `${localDevClean}::*`, normRemoteEp || `${remDevClean}::*`].sort().join("---");
          } else if (uniqueIpKey) {
            signature = uniqueIpKey;
          } else {
            signature = [localDevClean, remDevClean, link.id].sort().join("---");
          }
        }

        if (linksBySignature.has(signature)) {
          const existing = linksBySignature.get(signature);
          if (!existing.allIds) existing.allIds = [existing.id];
          if (!existing.allIds.includes(link.id)) existing.allIds.push(link.id);

          // Elevate status if reciprocal side indicates down/issue
          if (normalized === "down") {
            existing.category = "down";
            existing.status = "down";
            existing.normalizedStatus = "down";
            if (linkStatusDate) {
              existing.statusDate = linkStatusDate;
              existing.statusChangedAt = linkStatusDate;
              existing.last_state_change_at = linkStatusDate;
            }
          } else if (normalized === "issue" && existing.category !== "down") {
            existing.category = "issue";
            existing.status = "issue";
            existing.normalizedStatus = "issue";
            if (linkStatusDate) {
              existing.statusDate = linkStatusDate;
              existing.statusChangedAt = linkStatusDate;
              existing.last_state_change_at = linkStatusDate;
            }
          }

          // If either side determines visibility, ensure it is marked visible
          if (isBothDevicesVisible) {
            existing.isVisibleOnMap = true;
          }

          // Fill any missing metadata from reciprocal link
          const isFlipped = cleanDeviceKey(existing.sourceName) === remDevClean;
          const currentDevIp = device.ip || device.ip_address || null;
          const currentRemoteDevIp = link.remote_device_ip || (remoteDevice ? (remoteDevice.ip || remoteDevice.ip_address) : null) || link.neighbor_ip || null;

          if (!existing.allLocalInterfaces) existing.allLocalInterfaces = [existing.local_interface].filter(Boolean);
          if (!existing.allRemoteInterfaces) existing.allRemoteInterfaces = [existing.remote_interface].filter(Boolean);

          if (isFlipped) {
            if (rawLocalIf && !existing.allRemoteInterfaces.includes(rawLocalIf)) {
              existing.allRemoteInterfaces.push(rawLocalIf);
            }
            if (rawRemoteIf && !existing.allLocalInterfaces.includes(rawRemoteIf)) {
              existing.allLocalInterfaces.push(rawRemoteIf);
            }

            if (!existing.remote_device_ip && currentDevIp) {
              existing.remote_device_ip = currentDevIp;
              existing.target_device_ip = currentDevIp;
            }
            if (!existing.local_device_ip && currentRemoteDevIp) {
              existing.local_device_ip = currentRemoteDevIp;
              existing.source_device_ip = currentRemoteDevIp;
            }
            if (!existing.remote_device_name && (link.remote_device_name || remDevName)) {
              existing.remote_device_name = link.remote_device_name || remDevName;
            }
            if (!existing.remote_interface && rawLocalIf) {
              existing.remote_interface = rawLocalIf;
            }
            if (!existing.remote_link_ip && (link.local_link_ip || link.local_ip)) {
              existing.remote_link_ip = link.local_link_ip || link.local_ip;
            }
            if (!existing.remote_ip && (link.local_link_ip || link.local_ip)) {
              existing.remote_ip = link.local_link_ip || link.local_ip;
            }
            if (!existing.local_link_ip && (link.remote_link_ip || link.remote_ip)) {
              existing.local_link_ip = link.remote_link_ip || link.remote_ip;
            }
            if (!existing.local_ip && (link.remote_link_ip || link.remote_ip)) {
              existing.local_ip = link.remote_link_ip || link.remote_ip;
            }
            if (!existing.remote_oper_status && (link.oper_status || link.physical_status)) {
              existing.remote_oper_status = link.oper_status || link.physical_status;
            }
          } else {
            if (rawLocalIf && !existing.allLocalInterfaces.includes(rawLocalIf)) {
              existing.allLocalInterfaces.push(rawLocalIf);
            }
            if (rawRemoteIf && !existing.allRemoteInterfaces.includes(rawRemoteIf)) {
              existing.allRemoteInterfaces.push(rawRemoteIf);
            }

            if (!existing.local_device_ip && currentDevIp) {
              existing.local_device_ip = currentDevIp;
              existing.source_device_ip = currentDevIp;
            }
            if (!existing.remote_device_ip && currentRemoteDevIp) {
              existing.remote_device_ip = currentRemoteDevIp;
              existing.target_device_ip = currentRemoteDevIp;
            }
            if (!existing.remote_device_name && (link.remote_device_name || remDevName)) {
              existing.remote_device_name = link.remote_device_name || remDevName;
            }
            if (!existing.remote_interface && rawRemoteIf) {
              existing.remote_interface = rawRemoteIf;
            }
            if (!existing.local_link_ip && (link.local_link_ip || link.local_ip)) {
              existing.local_link_ip = link.local_link_ip || link.local_ip;
            }
            if (!existing.local_ip && (link.local_link_ip || link.local_ip)) {
              existing.local_ip = link.local_link_ip || link.local_ip;
            }
            if (!existing.remote_link_ip && (link.remote_link_ip || link.remote_ip)) {
              existing.remote_link_ip = link.remote_link_ip || link.remote_ip;
            }
            if (!existing.remote_ip && (link.remote_link_ip || link.remote_ip)) {
              existing.remote_ip = link.remote_link_ip || link.remote_ip;
            }
            if (!existing.remote_oper_status && link.remote_oper_status) {
              existing.remote_oper_status = link.remote_oper_status;
            }
          }

          existing.allInterfaces = Array.from(new Set([
            ...existing.allLocalInterfaces,
            ...existing.allRemoteInterfaces,
            existing.local_interface,
            existing.remote_interface,
          ].filter(Boolean)));

          if (!existing.description && (link.local_interface_description || link.description)) {
            existing.description = link.local_interface_description || link.description;
            existing.local_interface_description = existing.description;
          }
          if ((existing.ping_success_attempts == null) && link.ping_success_attempts != null) {
            existing.ping_success_attempts = link.ping_success_attempts;
          }
          if ((existing.ping_success_rate == null) && (link.ping_success_rate != null || link.ping_rate != null || link.pingSuccessRate != null || link.ping != null)) {
            existing.ping_success_rate = link.ping_success_rate ?? link.ping_rate ?? link.pingSuccessRate ?? link.ping;
          }
          if ((existing.ping_packets_success == null) && (link.ping_packets_success != null || link.ping_success_attempts != null)) {
            existing.ping_packets_success = link.ping_packets_success ?? link.ping_success_attempts;
          }
          if ((existing.ping_packets_total == null) && (link.ping_packets_total != null || link.total_pings != null || link.ping_total != null)) {
            existing.ping_packets_total = link.ping_packets_total ?? link.total_pings ?? link.ping_total;
          }
          if ((existing.ping_ratio == null) && link.ping_ratio != null) {
            existing.ping_ratio = link.ping_ratio;
          }
          if ((existing.total_pings == null) && (link.total_pings != null || link.ping_total != null || link.ping_packets_total != null)) {
            existing.total_pings = link.total_pings ?? link.ping_total ?? link.ping_packets_total;
            existing.ping_total = existing.total_pings;
          }
          if ((existing.last_ping_at == null) && (link.last_ping_at != null || link.lastPingAt != null)) {
            existing.last_ping_at = link.last_ping_at ?? link.lastPingAt;
          }
          const upSec = link.ospf_uptime_seconds ?? link.ospf_up_time_seconds;
          if (existing.ospf_uptime_seconds == null && upSec != null) {
            existing.ospf_uptime_seconds = upSec;
            existing.ospf_up_time_seconds = upSec;
          }
          const upStr = link.ospf_uptime ?? link.ospf_up_time;
          if (existing.ospf_uptime == null && upStr != null) {
            existing.ospf_uptime = upStr;
            existing.ospf_up_time = upStr;
          }
          if (existing.ospf_state_duration_seconds == null && link.ospf_state_duration_seconds != null) {
            existing.ospf_state_duration_seconds = link.ospf_state_duration_seconds;
          }
          if (existing.ospf_state_duration == null && link.ospf_state_duration != null) {
            existing.ospf_state_duration = link.ospf_state_duration;
          }
          if (existing.last_ospf_down_at == null && link.last_ospf_down_at != null) {
            existing.last_ospf_down_at = link.last_ospf_down_at;
          }

          const currentInBps = link.in_bps ?? link.input_rate ?? link.inBps ?? link.bytes_in_rate ?? link.bytesIn ?? null;
          const currentOutBps = link.out_bps ?? link.output_rate ?? link.outBps ?? link.bytes_out_rate ?? link.bytesOut ?? null;
          if (existing.in_bps == null) {
            existing.in_bps = isFlipped ? currentOutBps : currentInBps;
            existing.input_rate = existing.in_bps;
          }
          if (existing.out_bps == null) {
            existing.out_bps = isFlipped ? currentInBps : currentOutBps;
            existing.output_rate = existing.out_bps;
          }

          if (normLocalEp) endpointToSignature.set(normLocalEp, signature);
          if (normRemoteEp) endpointToSignature.set(normRemoteEp, signature);
          if (idLocalEp) endpointToSignature.set(idLocalEp, signature);
          if (idRemoteEp) endpointToSignature.set(idRemoteEp, signature);
          if (rawLocalEp) endpointToSignature.set(rawLocalEp, signature);
          if (rawRemoteEp) endpointToSignature.set(rawRemoteEp, signature);
          if (uniqueIpKey) uniqueIpPairToSignature.set(uniqueIpKey, signature);
          return;
        }

        const localDevIp = device.ip || device.ip_address || null;
        const remoteDevIp = link.remote_device_ip || (remoteDevice ? (remoteDevice.ip || remoteDevice.ip_address) : null) || link.neighbor_ip || null;

        const linkObj = {
          id: link.id,
          allIds: [link.id],
          source: device.name,
          target: remoteDeviceName,
          sourceName: device.name,
          targetName: remoteDeviceName,
          coredevice_id: device.id,
          neighbor_coredevice_id: link.remote_device_id,
          remote_device_id: link.remote_device_id,
          remote_device_name: link.remote_device_name || remoteDeviceName,
          sourceZone: device.coresite_name || "Unknown",
          targetZone: remoteZone,
          physical_status: link.oper_status,
          protocol_status: link.admin_status,
          oper_status: link.oper_status,
          remote_oper_status: link.remote_oper_status,
          admin_status: link.admin_status,
          description: link.local_interface_description || link.description || "",
          local_interface_description: link.local_interface_description || link.description || "",
          category: normalized,
          status: normalized,
          normalizedStatus: normalized,
          statusDate: linkStatusDate,
          statusChangedAt: linkStatusDate || link.last_state_change_at,
          last_state_change_at: linkStatusDate || link.last_state_change_at,
          linkType: "core",
          bandwidth: link.bandwidth_mbps
            ? (typeof link.bandwidth_mbps === "number"
              ? (link.bandwidth_mbps >= 1000 ? `${link.bandwidth_mbps / 1000} Gbps` : `${link.bandwidth_mbps} Mbps`)
              : link.bandwidth_mbps)
            : "10G",
          bandwidth_mbps: link.bandwidth_mbps,
          mtu: link.mtu,
          ping_success_rate: link.ping_success_rate ?? link.ping_rate ?? link.pingSuccessRate ?? link.ping ?? link.rawLink?.ping_success_rate,
          ping_success_attempts: link.ping_success_attempts ?? link.ping_packets_success ?? link.pingPacketsSuccess ?? link.rawLink?.ping_success_attempts,
          ping_packets_success: link.ping_packets_success ?? link.ping_success_attempts ?? link.pingPacketsSuccess ?? link.rawLink?.ping_packets_success,
          ping_packets_total: link.ping_packets_total ?? link.total_pings ?? link.ping_total ?? link.pingPacketsTotal ?? link.rawLink?.ping_packets_total,
          ping_ratio: link.ping_ratio ?? link.packet_ratio ?? link.rawLink?.ping_ratio,
          total_pings: link.total_pings ?? link.ping_total ?? link.ping_packets_total ?? link.rawLink?.total_pings,
          ping_total: link.ping_total ?? link.total_pings ?? link.ping_packets_total ?? link.rawLink?.ping_total,
          last_ping_at: link.last_ping_at ?? link.lastPingAt ?? link.rawLink?.last_ping_at,
          local_interface: link.local_interface,
          remote_interface: link.remote_interface,
          allLocalInterfaces: [link.local_interface].filter(Boolean),
          allRemoteInterfaces: [link.remote_interface].filter(Boolean),
          allInterfaces: [link.local_interface, link.remote_interface].filter(Boolean),
          local_device_ip: localDevIp,
          source_device_ip: localDevIp,
          remote_device_ip: remoteDevIp,
          target_device_ip: remoteDevIp,
          local_link_ip: link.local_link_ip || link.local_ip,
          local_ip: link.local_link_ip || link.local_ip,
          remote_link_ip: link.remote_link_ip || link.remote_ip,
          remote_ip: link.remote_link_ip || link.remote_ip || link.remote_interface_ip,
          destinationIp: link.remote_link_ip || remoteDevIp || link.remote_ip,
          ospf_state: link.ospf_state,
          is_ospf_full: link.is_ospf_full !== undefined ? Boolean(link.is_ospf_full) : (String(link.ospf_state || "").toUpperCase() === "FULL"),
          ospf_uptime_seconds: link.ospf_uptime_seconds ?? link.ospf_up_time_seconds ?? link.rawLink?.ospf_uptime_seconds ?? link.rawLink?.ospf_up_time_seconds,
          ospf_up_time_seconds: link.ospf_uptime_seconds ?? link.ospf_up_time_seconds ?? link.rawLink?.ospf_uptime_seconds ?? link.rawLink?.ospf_up_time_seconds,
          ospf_uptime: link.ospf_uptime ?? link.ospf_up_time ?? link.rawLink?.ospf_uptime ?? link.rawLink?.ospf_up_time,
          ospf_up_time: link.ospf_uptime ?? link.ospf_up_time ?? link.rawLink?.ospf_uptime ?? link.rawLink?.ospf_up_time,
          ospf_state_duration_seconds: link.ospf_state_duration_seconds ?? link.rawLink?.ospf_state_duration_seconds,
          ospf_state_duration: link.ospf_state_duration ?? link.rawLink?.ospf_state_duration,
          last_up_at: link.last_up_at,
          last_down_at: link.last_down_at,
          last_ospf_down_at: link.last_ospf_down_at ?? link.rawLink?.last_ospf_down_at,
          last_ospf_full_at: link.last_ospf_full_at,
          last_seen_at: link.last_seen_at,
          link_drops_last_24h: link.link_drops_last_24h ?? 0,
          ospf_drops_last_24h: link.ospf_drops_last_24h ?? 0,
          in_bps: link.in_bps ?? link.input_rate ?? link.inBps ?? link.bytes_in_rate ?? link.bytesIn ?? null,
          out_bps: link.out_bps ?? link.output_rate ?? link.outBps ?? link.bytes_out_rate ?? link.bytesOut ?? null,
          input_rate: link.input_rate ?? link.in_bps ?? null,
          output_rate: link.output_rate ?? link.out_bps ?? null,
          rawLink: link,
          isVisibleOnMap: isBothDevicesVisible,
        };

        linksBySignature.set(signature, linkObj);
        if (normLocalEp) endpointToSignature.set(normLocalEp, signature);
        if (normRemoteEp) endpointToSignature.set(normRemoteEp, signature);
        if (idLocalEp) endpointToSignature.set(idLocalEp, signature);
        if (idRemoteEp) endpointToSignature.set(idRemoteEp, signature);
        if (rawLocalEp) endpointToSignature.set(rawLocalEp, signature);
        if (rawRemoteEp) endpointToSignature.set(rawRemoteEp, signature);
        if (uniqueIpKey) uniqueIpPairToSignature.set(uniqueIpKey, signature);
      });
    });

    const allDrawerLinks = Array.from(linksBySignature.values());
    const transformedLinks = allDrawerLinks.filter((l) => l.isVisibleOnMap);

    return {
      nodes: transformedNodes,
      links: transformedLinks,
      drawerLinks: allDrawerLinks,
    };
  }, [allTopologyDevices]);

  // All event handlers
  const handleZoneClick = useCallback(
    (zoneId) => {
      navigate(`/p-chart/zone/${zoneId}`);
    },
    [navigate]
  );

  const handleNodeClick = useCallback(
    (nodeData) => {
      const zone = nodeData?.zone || nodeData?.zoneName || "Zone";
      const hostname = nodeData?.hostname || nodeData?.id || nodeData?.name;
      if (hostname) {
        navigate(`/p-chart/zone/${zone}/node/${hostname}`);
      }
    },
    [navigate]
  );

  const handleLinkClick = useCallback((linkDetailPayload) => {
    if (!linkDetailPayload) return;
    const payload = createLinkPopupPayload(linkDetailPayload) || linkDetailPayload;
    const src =
      typeof payload.source === "object"
        ? payload.source?.id || payload.source?.hostname || payload.source?.name
        : payload.sourceNode || payload.sourceName || payload.source;
    const tgt =
      typeof payload.target === "object"
        ? payload.target?.id || payload.target?.hostname || payload.target?.name
        : payload.targetNode || payload.targetName || payload.target;

    setPopupLink({
      data: { ...payload, skipFetch: true, isCoreTopology: true },
      type: "link",
      title: `${src || "Device A"} ⟷ ${tgt || "Device B"}`,
    });
  }, []);

  // Automatically open inspect popup when redirected from an alert ("See Line")
  const inspectHandledKeyRef = useRef(null);
  useEffect(() => {
    const targetLinkId =
      location.state?.inspectLinkId ||
      location.state?.downedLinkId ||
      location.state?.focusedLinkId;
    const shouldOpen =
      location.state?.openInspectPopup || Boolean(location.state?.inspectLinkId);

    if (!shouldOpen || !targetLinkId) return;

    const navKey = `${location.key || "init"}_${targetLinkId}`;
    if (inspectHandledKeyRef.current === navKey) return;

    const foundLink =
      graphData.drawerLinks.find(
        (l) =>
          l.id === targetLinkId ||
          String(l.id) === String(targetLinkId) ||
          (l.allIds &&
            (l.allIds.includes(targetLinkId) ||
              l.allIds.includes(Number(targetLinkId)) ||
              l.allIds.includes(String(targetLinkId))))
      ) ||
      graphData.links.find(
        (l) =>
          l.id === targetLinkId ||
          String(l.id) === String(targetLinkId) ||
          (l.allIds &&
            (l.allIds.includes(targetLinkId) ||
              l.allIds.includes(Number(targetLinkId)) ||
              l.allIds.includes(String(targetLinkId))))
      ) ||
      location.state?.selectedLink;

    if (foundLink) {
      inspectHandledKeyRef.current = navKey;
      handleLinkClick(foundLink);
    }
  }, [
    location.key,
    location.state,
    graphData.drawerLinks,
    graphData.links,
    handleLinkClick,
  ]);

  // Keep open popup updated in real-time when polling updates graph data
  React.useEffect(() => {
    if (!popupLink?.data) return;
    const currentId = popupLink.data.id || popupLink.data.linkId;
    if (!currentId) return;
    const updated = graphData.drawerLinks.find(
      (l) => l.id === currentId || (l.allIds && l.allIds.includes(currentId))
    );
    if (updated) {
      const payload = createLinkPopupPayload(updated) || updated;
      setPopupLink((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          data: { ...payload, skipFetch: true, isCoreTopology: true },
        };
      });
    }
  }, [graphData.drawerLinks]);

  const handleClosePopup = useCallback(() => {
    setPopupLink(null);
  }, []);

  const handleToggleDetailView = useCallback(() => {
    setShowDetailedLinks((prev) => !prev);
  }, []);

  const handleRetry = () => dispatch(fetchInitialData());

  // --- Loading, Error, and Empty State Rendering Logic ---
  const isLoading = topologyStatus === "loading";
  const hasError = topologyStatus === "failed";
  const isDataEmpty = !isLoading && !hasError && graphData.nodes.length === 0;

  if (isLoading) {
    return <LoadingSpinner text="Building P-Chart..." />;
  }

  if (hasError) {
    return <ErrorMessage onRetry={handleRetry} />;
  }

  if (isDataEmpty) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          No Data Available
        </h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          There is no network data available to build the P-Chart.
        </p>
      </div>
    );
  }

  // --- Original component return for successful data load ---
  return (
    <div className="w-full h-full flex flex-col">
      <LinkDetailPopup
        linkData={popupLink?.data || null}
        linkType={popupLink?.type || "link"}
        linkTitle={popupLink?.title || ""}
        onClose={handleClosePopup}
        theme={theme}
      />

      <div className="flex-grow relative overflow-hidden">
        <NetworkLinksSideDrawer
          links={graphData.drawerLinks}
          onLinkClick={handleLinkClick}
          theme={theme}
          chartName="P-Network"
          isOpen={isDrawerOpen}
          onOpenChange={handleOpenChange}
          activeFilter={activeFilter}
          onActiveFilterChange={setActiveFilter}
          pingSubFilter={pingSubFilter}
          onPingSubFilterChange={setPingSubFilter}
          markedLinkIds={markedLinkIds}
          onToggleMarkLink={handleToggleMarkLink}
          onMarkAll={handleMarkAll}
          onClearMarks={handleClearMarks}
          onHoverLink={setHoveredLinkId}
          onHoverFilter={setHoveredFilter}
        />
        <NetworkVisualizer5
          key={`${theme}-detailed`}
          data={graphData}
          theme={theme}
          showDetailedLinks={true}
          isDrawerOpen={isDrawerOpen}
          activeFilter={isDrawerOpen ? activeFilter : null}
          pingSubFilter={pingSubFilter}
          markedLinkIds={markedLinkIds}
          hoveredLinkId={hoveredLinkId}
          hoveredFilter={hoveredFilter}
          trafficByZone={trafficByZone}
          onZoneClick={handleZoneClick}
          onLinkClick={handleLinkClick}
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
};

export default NetworkVisualizer5Wrapper;
