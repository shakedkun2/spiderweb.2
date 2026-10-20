import React from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Routes,
  Route,
  useParams,
  Navigate,
} from "react-router-dom";
import { ArrowUp, ArrowDown, XCircle } from "lucide-react";

// Page Components for each tab
import FavoritesPage from "./dashboard/FavoritesPage";
import AllInterfacesPage from "./dashboard/AllInterfacesPage";

// Chart and Site specific components
import NetworkVisualizerWrapper from "./dashboard/NetworkVisualizerWrapper";
import NetworkVisualizer5Wrapper from "./dashboard/NetworkVisualizer5Wrapper";
import CoreSitePage from "../components/CoreSite/CoreSitePage";
import LinkTable from "../components/CoreDevice/LinkTable";

// Helper hooks and Redux selectors
import { useRelatedDevices } from "../hooks/useRelatedDevices";
import { selectAllDevices, selectDeviceInfo } from "../redux/slices/devicesSlice";
import { selectAllSites } from "../redux/slices/sitesSlice";
import { selectTopologyDevices, fetchCoreTopology } from "../redux/slices/coreTopologySlice";
import { getLinkStatusAndDate, normalizeInterfaceName, cleanDeviceKey } from "../components/chart/drawHelpers";
import { api } from "../services/apiServices";

// This helper component can be used by other pages like FavoritesPage
function StatusIndicator({ status }) {
  const statusConfig = {
    Up: { color: "text-green-500", Icon: ArrowUp, label: "Up" },
    Down: { color: "text-red-500", Icon: ArrowDown, label: "Down" },
    "Admin Down": {
      color: "text-gray-500",
      Icon: XCircle,
      label: "Admin Down",
    },
  };
  const config = statusConfig[status] || statusConfig["Admin Down"];
  return (
    <div className={`flex items-center gap-2 font-medium ${config.color}`}>
      <config.Icon className="h-4 w-4" />
      <span>{config.label}</span>
    </div>
  );
}

// This component now correctly receives the theme prop to pass down.
function NodeDetailView({ chartType, theme }) {
  const { nodeId: deviceHostname, zoneId } = useParams();
  const dispatch = useDispatch();
  const allDevices = useSelector(selectAllDevices);
  const allTopologyDevices = useSelector(selectTopologyDevices);
  const allSites = useSelector(selectAllSites);
  const deviceInfo = useSelector(selectDeviceInfo);
  const otherDevicesInZone = useRelatedDevices(deviceHostname, zoneId);

  const [directCoreTopology, setDirectCoreTopology] = React.useState(null);
  const [endSiteLinks, setEndSiteLinks] = React.useState([]);

  // Fetch core topology (Redux thunk + direct fallback) and poll every 5s
  React.useEffect(() => {
    dispatch(fetchCoreTopology());
    api.getCoreTopology()
      .then((data) => {
        const devs = Array.isArray(data?.devices)
          ? data.devices
          : Array.isArray(data?.data?.devices)
          ? data.data.devices
          : Array.isArray(data)
          ? data
          : [];
        if (devs.length > 0) {
          setDirectCoreTopology(devs);
        }
      })
      .catch((err) => console.error("Failed to fetch direct core topology:", err));

    const interval = setInterval(() => {
      dispatch(fetchCoreTopology());
    }, 5000);
    return () => clearInterval(interval);
  }, [dispatch]);

  const topologyDevicesToUse = React.useMemo(() => {
    if (allTopologyDevices && allTopologyDevices.length > 0) {
      return allTopologyDevices;
    }
    return directCoreTopology || [];
  }, [allTopologyDevices, directCoreTopology]);

  // Find the current device object
  const currentDevice = React.useMemo(() => {
    return (
      allDevices.find((d) => 
        d.hostname === deviceHostname || 
        d.name === deviceHostname || 
        String(d.id) === String(deviceHostname)
      ) ||
      topologyDevicesToUse.find((d) =>
        d.name === deviceHostname ||
        d.hostname === deviceHostname ||
        String(d.id) === String(deviceHostname)
      ) ||
      null
    );
  }, [allDevices, topologyDevicesToUse, deviceHostname]);

  // Helper sets to reliably identify core devices
  const coreDeviceIds = React.useMemo(() => {
    const ids = new Set();
    allDevices.forEach((d) => {
      if (d.id != null) ids.add(String(d.id));
    });
    topologyDevicesToUse.forEach((d) => {
      if (d.id != null) ids.add(String(d.id));
    });
    return ids;
  }, [allDevices, topologyDevicesToUse]);

  const coreDeviceNames = React.useMemo(() => {
    const names = new Set();
    allDevices.forEach((d) => {
      if (d.hostname) names.add(d.hostname.toLowerCase());
      if (d.name) names.add(d.name.toLowerCase());
    });
    topologyDevicesToUse.forEach((d) => {
      if (d.name) names.add(d.name.toLowerCase());
      if (d.hostname) names.add(d.hostname.toLowerCase());
    });
    return names;
  }, [allDevices, topologyDevicesToUse]);

  // For every connection to a core device, use info from the core-topology endpoint
  const coreDeviceLinks = React.useMemo(() => {
    if (!currentDevice || !topologyDevicesToUse || topologyDevicesToUse.length === 0) return [];

    const currentDevId = currentDevice.id != null ? String(currentDevice.id) : null;
    const currentDevName = (currentDevice.name || currentDevice.hostname || deviceHostname || "").toLowerCase();

    const result = [];
    const seenLinkIds = new Set();
    const seenSignatures = new Set();
    const seenLocalIfs = new Set();

    const makeSignature = (devA, ifA, devB, ifB) => {
      const normDevA = cleanDeviceKey(devA || "");
      const normIfA = normalizeInterfaceName(ifA || "");
      const normDevB = cleanDeviceKey(devB || "");
      const normIfB = normalizeInterfaceName(ifB || "");
      if (!normDevA || !normDevB) return null;
      const epA = `${normDevA}::${normIfA}`;
      const epB = `${normDevB}::${normIfB}`;
      return [epA, epB].sort().join("---");
    };

    // Find current device in topology devices
    const topoDevice = topologyDevicesToUse.find((d) =>
      (currentDevId != null && d.id != null && String(d.id) === currentDevId) ||
      (d.name && d.name.toLowerCase() === currentDevName) ||
      (d.hostname && d.hostname.toLowerCase() === currentDevName)
    );

    // 1. First, process links originating from currentDevice in core-topology
    if (topoDevice && Array.isArray(topoDevice.links)) {
      topoDevice.links.forEach((link) => {
        if (!link) return;
        const linkIdStr = link.id != null ? String(link.id) : null;
        if (linkIdStr && seenLinkIds.has(linkIdStr)) return;

        const rawLocalIf = link.local_interface || "";
        const rawRemoteIf = link.remote_interface || "";
        const normLocalIf = normalizeInterfaceName(rawLocalIf);

        const remoteDevice =
          topologyDevicesToUse.find((d) =>
            (link.remote_device_id != null && (d.id === link.remote_device_id || String(d.id) === String(link.remote_device_id))) ||
            (link.remote_device_name && (d.name === link.remote_device_name || d.hostname === link.remote_device_name))
          ) ||
          allDevices.find((d) =>
            (link.remote_device_id != null && (d.id === link.remote_device_id || String(d.id) === String(link.remote_device_id))) ||
            (link.remote_device_name && (d.name === link.remote_device_name || d.hostname === link.remote_device_name))
          );

        const remoteName = remoteDevice?.name || remoteDevice?.hostname || link.remote_device_name || `Device-${link.remote_device_id || "Unknown"}`;
        const sig = makeSignature(
          currentDevice.name || currentDevice.hostname || deviceHostname,
          rawLocalIf,
          remoteName,
          rawRemoteIf
        );

        if (sig && seenSignatures.has(sig)) return;
        if (normLocalIf && seenLocalIfs.has(normLocalIf)) return;

        if (linkIdStr) seenLinkIds.add(linkIdStr);
        if (sig) seenSignatures.add(sig);
        if (normLocalIf) seenLocalIfs.add(normLocalIf);

        const currentSite = topoDevice.coresite_name || currentDevice.coresite_name || zoneId;
        const remoteSite = remoteDevice?.coresite_name || remoteDevice?.zoneName || link.remote_coresite_name;
        const isSameSite = Boolean(currentSite && remoteSite && currentSite.toLowerCase() === remoteSite.toLowerCase());

        result.push({
          ...link,
          isCoreLink: true,
          isCoreDeviceConnection: true,
          sourceDevice: topoDevice,
          remoteDevice: remoteDevice || { id: link.remote_device_id, name: remoteName },
          neighbor_coredevice: remoteDevice || { id: link.remote_device_id, name: remoteName },
          source: topoDevice.name || topoDevice.hostname || currentDevice.name,
          target: remoteName,
          name: remoteName,
          destinationIp: link.remote_link_ip || link.remote_device_ip || link.remote_ip || "N/A",
          description: link.local_interface_description || link.description || `Link to ${remoteName}`,
          local_interface_description: link.local_interface_description || link.description || `Link to ${remoteName}`,
          linkType: isSameSite ? "inter-core-same-site" : "inter-core-different-site",
          rawLink: link,
        });
      });
    }

    // 2. Only check other core devices for links where currentDevice is the target (if not already recorded)
    topologyDevicesToUse.forEach((dev) => {
      if (!dev.links || !Array.isArray(dev.links) || dev === topoDevice || (currentDevId != null && String(dev.id) === currentDevId)) return;

      dev.links.forEach((link) => {
        if (!link) return;
        const isRemoteCurrent =
          (currentDevId != null && link.remote_device_id != null && String(link.remote_device_id) === currentDevId) ||
          (link.remote_device_name && link.remote_device_name.toLowerCase() === currentDevName);

        if (!isRemoteCurrent) return;

        const linkIdStr = link.id != null ? String(link.id) : null;
        if (linkIdStr && seenLinkIds.has(linkIdStr)) return;

        const rawLocalIf = link.remote_interface || link.local_interface || "";
        const rawRemoteIf = link.local_interface || link.remote_interface || "";
        const normLocalIf = normalizeInterfaceName(rawLocalIf);
        const remoteName = dev.name || dev.hostname || `Device-${dev.id || "Unknown"}`;

        const sig = makeSignature(
          currentDevice.name || currentDevice.hostname || deviceHostname,
          rawLocalIf,
          remoteName,
          rawRemoteIf
        );

        if (sig && seenSignatures.has(sig)) return;
        if (normLocalIf && seenLocalIfs.has(normLocalIf)) return;

        if (linkIdStr) seenLinkIds.add(linkIdStr);
        if (sig) seenSignatures.add(sig);
        if (normLocalIf) seenLocalIfs.add(normLocalIf);

        const currentSite = currentDevice.coresite_name || zoneId;
        const remoteSite = dev.coresite_name;
        const isSameSite = Boolean(currentSite && remoteSite && currentSite.toLowerCase() === remoteSite.toLowerCase());

        const normalizedRawLink = {
          ...link,
          local_interface: rawLocalIf,
          remote_interface: rawRemoteIf,
          local_link_ip: link.remote_link_ip || link.remote_ip,
          remote_link_ip: link.local_link_ip || link.local_ip,
          remote_device_name: remoteName,
          remote_device_id: dev.id,
          in_bps: link.out_bps ?? link.output_rate,
          out_bps: link.in_bps ?? link.input_rate,
        };

        result.push({
          ...link,
          isCoreLink: true,
          isCoreDeviceConnection: true,
          sourceDevice: currentDevice,
          remoteDevice: dev,
          neighbor_coredevice: dev,
          source: currentDevice.name || currentDevice.hostname || deviceHostname,
          target: remoteName,
          name: remoteName,
          local_interface: rawLocalIf,
          remote_interface: rawRemoteIf,
          local_link_ip: link.remote_link_ip || link.remote_ip,
          remote_link_ip: link.local_link_ip || link.local_ip,
          destinationIp: link.local_link_ip || link.local_ip || dev.ip || "N/A",
          description: link.local_interface_description || link.description || `Link to ${remoteName}`,
          local_interface_description: link.local_interface_description || link.description || `Link to ${remoteName}`,
          in_bps: link.out_bps ?? link.output_rate,
          out_bps: link.in_bps ?? link.input_rate,
          linkType: isSameSite ? "inter-core-same-site" : "inter-core-different-site",
          rawLink: normalizedRawLink,
        });
      });
    });

    return result;
  }, [currentDevice, topologyDevicesToUse, allDevices, deviceHostname, zoneId]);

  // Fetch links from link/topology/{core_device_id} ONLY for connections to end sites
  React.useEffect(() => {
    if (currentDevice?.id) {
      api.getLinksTopologyByDevice(currentDevice.id)
        .then((data) => {
          const links = Array.isArray(data) ? data : data.links || [];

          // Create sets of already included core link IDs and interfaces for deduplication
          const coreIds = new Set(coreDeviceLinks.map((l) => String(l.id)));
          const coreIfs = new Set(
            coreDeviceLinks
              .map((l) => normalizeInterfaceName(l.local_interface))
              .filter(Boolean)
          );

          // Keep strictly connections to end sites:
          const endSitesOnly = links.filter((link) => {
            if (!link) return false;

            // Skip if ID or local interface is already in coreDeviceLinks
            if (link.id != null && coreIds.has(String(link.id))) return false;
            const normIf = normalizeInterfaceName(link.local_interface || "");
            if (normIf && coreIfs.has(normIf)) return false;

            // Skip if explicitly core or inter-core link
            if (link.neighbor_is_core === true) return false;
            if (link.type === "inter-core-same-site" || link.type === "inter-core-different-site") return false;

            // Skip if neighbor is any known core device
            if (link.neighbor_coredevice && (link.neighbor_coredevice.id != null || link.neighbor_coredevice.name)) {
              return false;
            }
            if (link.neighbor_coredevice_id != null && coreDeviceIds.has(String(link.neighbor_coredevice_id))) {
              return false;
            }
            if (link.remote_device_id != null && coreDeviceIds.has(String(link.remote_device_id))) {
              return false;
            }
            if (link.remote_device_name && coreDeviceNames.has(link.remote_device_name.toLowerCase())) {
              return false;
            }

            // Must be an end site connection:
            if (link.neighbor_is_core === false) return true;
            if (link.neighbor_site || link.neighbor_site_id) return true;
            if (link.type === "core-to-site") return true;
            if (!link.neighbor_coredevice && !link.neighbor_coredevice_id) return true;

            return false;
          });
          setEndSiteLinks(endSitesOnly);
        })
        .catch((err) => {
          console.error("Failed to fetch end site links:", err);
          setEndSiteLinks([]);
        });
    } else {
      setEndSiteLinks([]);
    }
  }, [currentDevice?.id, coreDeviceLinks, coreDeviceIds, coreDeviceNames]);

  // Format end site links and deduplicate
  const formattedEndSiteLinks = React.useMemo(() => {
    if (!endSiteLinks || endSiteLinks.length === 0) return [];

    const result = [];
    const seenEndSiteIds = new Set();
    const seenEndSiteIfs = new Set();

    endSiteLinks.forEach((link) => {
      if (!link) return;
      const linkIdStr = link.id != null ? String(link.id) : null;
      if (linkIdStr && seenEndSiteIds.has(linkIdStr)) return;

      const normIf = normalizeInterfaceName(link.local_interface || "");
      if (normIf && seenEndSiteIfs.has(normIf)) return;

      if (linkIdStr) seenEndSiteIds.add(linkIdStr);
      if (normIf) seenEndSiteIfs.add(normIf);

      const neighborSite =
        link.neighbor_site ||
        (link.neighbor_site_id != null ? allSites.find((s) => s.id === link.neighbor_site_id || String(s.id) === String(link.neighbor_site_id)) : null);

      const siteName =
        (typeof neighborSite === "object" ? neighborSite?.name : neighborSite) ||
        link.neighbor_site_name ||
        link.remote_device_name ||
        link.target ||
        "End Site";

      result.push({
        ...link,
        isCoreLink: false,
        isCoreDeviceConnection: false,
        name: siteName,
        destinationIp: link.remote_link_ip || link.remote_device_ip || link.neighbor_ip || link.remote_ip || "N/A",
        description: link.local_interface_description || link.description || `Link to ${siteName}`,
        local_interface_description: link.local_interface_description || link.description || `Link to ${siteName}`,
        linkType: "core-to-site",
        rawLink: link,
      });
    });

    return result;
  }, [endSiteLinks, allSites]);

  // Combined links for the device, strictly deduplicated
  const combinedRawLinks = React.useMemo(() => {
    const combined = [];
    const seenIds = new Set();
    const seenIfs = new Set();

    // Core device links take precedence
    coreDeviceLinks.forEach((link) => {
      if (link.id != null) seenIds.add(String(link.id));
      const normIf = normalizeInterfaceName(link.local_interface || "");
      if (normIf) seenIfs.add(normIf);
      combined.push(link);
    });

    // Add end site links without duplicate IDs or local interfaces
    formattedEndSiteLinks.forEach((link) => {
      if (link.id != null && seenIds.has(String(link.id))) return;
      const normIf = normalizeInterfaceName(link.local_interface || "");
      if (normIf && seenIfs.has(normIf)) return;

      if (link.id != null) seenIds.add(String(link.id));
      if (normIf) seenIfs.add(normIf);
      combined.push(link);
    });

    return combined;
  }, [coreDeviceLinks, formattedEndSiteLinks]);

  const linksForTable = React.useMemo(() => {
    if (!currentDevice) return [];

    const typeId = chartType === "P" ? 2 : 1;
    const seenResultIds = new Set();
    const seenResultIfs = new Set();

    return combinedRawLinks
      .filter((link) => {
        // Match network type if present
        const linkTypeId = link.network_type_id ?? link.type_id;
        if (
          linkTypeId !== undefined &&
          linkTypeId !== null &&
          Number(linkTypeId) !== typeId
        ) {
          return false;
        }

        const linkIdStr = link.id != null ? String(link.id) : null;
        if (linkIdStr && seenResultIds.has(linkIdStr)) return false;

        const normIf = normalizeInterfaceName(link.local_interface || "");
        if (normIf && seenResultIfs.has(normIf)) return false;

        if (linkIdStr) seenResultIds.add(linkIdStr);
        if (normIf) seenResultIfs.add(normIf);

        return true;
      })
      .map((link) => {
        const { status: normalizedStatus, statusDate: linkStatusDate } = getLinkStatusAndDate(link);

        const bw = link.bandwidth || link.Bandwidth || link.bw;
        const formattedBw =
          typeof bw === "number"
            ? bw >= 1000
              ? `${bw / 1000} Gbps`
              : `${bw} Mbps`
            : bw || (link.bandwidth_mbps ? (link.bandwidth_mbps >= 1000 ? `${link.bandwidth_mbps / 1000} Gbps` : `${link.bandwidth_mbps} Mbps`) : "10 Gbps");

        return {
          ...link,
          id: link.id || `link-${Math.random()}`,
          name: link.name,
          destinationIp: link.destinationIp || link.remote_link_ip || link.remote_device_ip || link.neighbor_ip || link.remote_ip || "N/A",
          description: link.local_interface_description || link.description || "N/A",
          local_interface_description: link.local_interface_description || link.description || "N/A",
          local_link_ip: link.local_link_ip || link.local_ip,
          remote_link_ip: link.remote_link_ip || link.remote_ip,
          remote_device_ip: link.remote_device_ip,
          status: normalizedStatus,
          statusDate: linkStatusDate,
          statusChangedAt: linkStatusDate || link.last_state_change_at,
          ospf_uptime_seconds: link.ospf_uptime_seconds ?? link.ospf_up_time_seconds,
          ospf_up_time_seconds: link.ospf_uptime_seconds ?? link.ospf_up_time_seconds,
          ospf_uptime: link.ospf_uptime ?? link.ospf_up_time,
          ospf_up_time: link.ospf_uptime ?? link.ospf_up_time,
          ospf_state_duration_seconds: link.ospf_state_duration_seconds,
          ospf_state_duration: link.ospf_state_duration,
          last_up_at: link.last_up_at,
          last_down_at: link.last_down_at,
          last_ospf_down_at: link.last_ospf_down_at,
          bandwidth: formattedBw,
          bandwidth_mbps: link.bandwidth_mbps,
          mtu: link.mtu,
          ping_success_rate: link.ping_success_rate,
          ping_success_attempts: link.ping_success_attempts,
          ping_packets_success: link.ping_packets_success ?? link.ping_success_attempts,
          ping_packets_total: link.ping_packets_total,
          ping_ratio: link.ping_ratio,
          total_pings: link.total_pings ?? link.ping_total,
          ping_total: link.ping_total ?? link.total_pings,
          last_ping_at: link.last_ping_at,
          ospfStatus: link.OSPF || link.ospfStatus || link.ospf_state || "Enabled",
          mplsStatus: link.MPLS || link.mplsStatus || "Enabled",
          type: link.linkType || link.type || (link.isCoreLink ? "inter-core-different-site" : "core-to-site"),
          additionalDetails: {
            mediaType: link.MediaType || link.media_type || "Fiber",
            cdpNeighbors: link.CDP || link.cdp || link.name,
            containerName: link.containerName || "Core Backbone",
            mtu: link.mtu || 9000,
            ping_success_rate: link.ping_success_rate,
            ping_success_attempts: link.ping_success_attempts,
            ping_packets_success: link.ping_packets_success ?? link.ping_success_attempts,
            ping_packets_total: link.ping_packets_total,
            ping_ratio: link.ping_ratio,
            total_pings: link.total_pings ?? link.ping_total,
            ping_total: link.ping_total ?? link.total_pings,
            last_ping_at: link.last_ping_at,
            crcErrors: link.crc ?? link.crcErrors ?? 0,
            inputDataRate: link.input_data
              ? `${link.input_data} Mbps`
              : link.input_rate || (link.in_bps ? `${(link.in_bps / 1000000).toFixed(1)} Mbps` : "N/A"),
            outputDataRate: link.output_data
              ? `${link.output_data} Mbps`
              : link.output_rate || (link.out_bps ? `${(link.out_bps / 1000000).toFixed(1)} Mbps` : "N/A"),
            txPower: link.tx !== undefined ? `${link.tx} dBm` : (link.TX ? `${link.TX} dBm` : link.txPower || "N/A"),
            rxPower: link.rx !== undefined ? `${link.rx} dBm` : (link.RX ? `${link.RX} dBm` : link.rxPower || "N/A"),
          },
        };
      });
  }, [currentDevice, chartType, combinedRawLinks]);

  const deviceInterfaces = React.useMemo(() => {
    if (!currentDevice) return [];

    if (linksForTable && linksForTable.length > 0) {
      return linksForTable.map((link) => {
        const remoteName = link.name || "Unknown Device";
        const operStatus = String(link.oper_status || link.status || link.physicalStatus || "down").toLowerCase() === "up" ? "Up" : "Down";
        const ospfStatus = String(link.ospf_state || link.ospfStatus || link.protocolStatus || "down").toLowerCase() === "full" ? "Up" : "Down";

        return {
          id: link.id || Math.random().toString(),
          name: link.local_interface || link.name || "Unknown Interface",
          description: link.local_interface_description || link.description || `Link to ${remoteName}`,
          local_interface_description: link.local_interface_description || link.description || "",
          physical_status: operStatus,
          protocol_status: ospfStatus,
          bandwidth: link.bandwidth || (link.bandwidth_mbps ? (link.bandwidth_mbps >= 1000 ? `${link.bandwidth_mbps / 1000} Gbps` : `${link.bandwidth_mbps} Mbps`) : 10000),
          bandwidth_mbps: link.bandwidth_mbps,
          mtu: link.mtu || 9000,
          ping_success_rate: link.ping_success_rate,
          ping_success_attempts: link.ping_success_attempts,
          ping_packets_success: link.ping_packets_success ?? link.ping_success_attempts,
          ping_packets_total: link.ping_packets_total,
          ping_ratio: link.ping_ratio,
          total_pings: link.total_pings ?? link.ping_total,
          ping_total: link.ping_total ?? link.total_pings,
          last_ping_at: link.last_ping_at,
          local_link_ip: link.local_link_ip || link.local_ip,
          remote_link_ip: link.remote_link_ip || link.remote_ip,
          remote_device_ip: link.remote_device_ip,
          destinationIp: link.destinationIp || "N/A",
          media_type: link.media_type || link.MediaType || "Fiber Optic",
          cdp: remoteName,
          ospf: ospfStatus,
          mpls: link.mpls || "Enabled",
          is_ospf_full: link.is_ospf_full !== undefined ? Boolean(link.is_ospf_full) : ospfStatus === "Up",
          last_state_change_at: link.last_state_change_at,
          tx: link.tx !== undefined ? link.tx : (link.tx_power !== undefined ? link.tx_power : (link.TX !== undefined ? link.TX : "N/A")),
          rx: link.rx !== undefined ? link.rx : (link.rx_power !== undefined ? link.rx_power : (link.RX !== undefined ? link.RX : "N/A")),
          crc: link.crc || 0,
        };
      });
    }

    if (deviceInfo) {
      const found =
        deviceInfo[currentDevice.id] ||
        deviceInfo[String(currentDevice.id)] ||
        deviceInfo[currentDevice.hostname];
      if (Array.isArray(found) && found.length > 0) {
        return found;
      }
    }

    return [];
  }, [currentDevice, deviceInfo, linksForTable]);

  return (
    <div className="w-full h-full overflow-hidden flex flex-col min-h-0 p-2 sm:p-3">
      <LinkTable
        coreDeviceName={deviceHostname}
        coreSiteName={zoneId}
        linksData={linksForTable}
        otherDevicesInZone={otherDevicesInZone}
        theme={theme}
        chartType={chartType}
        interfaces={deviceInterfaces}
        currentDevice={currentDevice}
      />
    </div>
  );
}

export function DashboardPage({
  isAppFullscreen,
  theme,
  popupAnchorCoords,
  chartKeySuffix,
}) {
  return (
    <Routes>
      <Route path="/favorites" element={<FavoritesPage theme={theme} />} />
      <Route path="/all_interfaces" element={<AllInterfacesPage theme={theme} />} />

      {/* Libot (replaces l-chart) */}
      <Route
        path="/Libot/*"
        element={
          <Routes>
            {/* The index route gets the non-scrolling, fixed-height layout */}
            <Route
              index
              element={
                <div
                  className={`relative w-full h-full ${
                    !isAppFullscreen && "rounded-lg shadow-sm"
                  } overflow-hidden bg-white dark:bg-gray-900`}
                >
                  <NetworkVisualizerWrapper
                    key={`l-visualizer-${chartKeySuffix}-${theme}`}
                    theme={theme}
                  />
                </div>
              }
            />
            {/* The node route is rendered directly, allowing it to use the main scrollbar */}
            <Route
              path="zone/:zoneId/node/:nodeId"
              element={<NodeDetailView chartType="L" theme={theme} />}
            />
            <Route
              path="zone/:zoneId"
              element={
                <CoreSitePage
                  theme={theme}
                  popupAnchor={popupAnchorCoords}
                  chartType="L"
                />
              }
            />
          </Routes>
        }
      />
      {/* Legacy redirect for l-chart */}
      <Route path="/l-chart/*" element={<Navigate to="/Libot" replace />} />

      {/* Pikudim (replaces p-chart) */}
      <Route
        path="/Pikudim/*"
        element={
          <Routes>
            {/* The index route gets its own non-scrolling, fixed-height layout */}
            <Route
              index
              element={
                <div
                  className={`relative w-full h-full ${
                    !isAppFullscreen && "rounded-lg shadow-sm"
                  } overflow-hidden bg-white dark:bg-gray-900`}
                >
                  <NetworkVisualizer5Wrapper
                    key={`p-visualizer-${chartKeySuffix}-${theme}`}
                    theme={theme}
                  />
                </div>
              }
            />
            {/* The node route is rendered directly, allowing it to use the main scrollbar */}
            <Route
              path="zone/:zoneId/node/:nodeId"
              element={<NodeDetailView chartType="P" theme={theme} />}
            />
            <Route
              path="zone/:zoneId"
              element={
                <CoreSitePage
                  theme={theme}
                  popupAnchor={popupAnchorCoords}
                  chartType="P"
                />
              }
            />
          </Routes>
        }
      />
      {/* Legacy redirect for p-chart */}
      <Route path="/p-chart/*" element={<Navigate to="/Pikudim" replace />} />

      {/* Default routes to redirect to the favorites tab */}
      <Route path="/" element={<Navigate to="/favorites" replace />} />
      <Route path="*" element={<Navigate to="/favorites" replace />} />
    </Routes>
  );
}
