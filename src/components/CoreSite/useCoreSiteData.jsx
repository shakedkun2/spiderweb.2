import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useNodeLayout } from "./useNodeLayout";
import { api } from "../../services/apiServices";
import { createLinkPopupPayload } from "../chart/handleInteractions";
import { selectTopologyDevices, fetchCoreTopology } from "../../redux/slices/coreTopologySlice";
import { selectAllDevices } from "../../redux/slices/devicesSlice";
import { selectAllSites } from "../../redux/slices/sitesSlice";
import {
  getLinkStatusAndDate,
  normalizeInterfaceName,
  cleanDeviceKey,
} from "../chart/drawHelpers";

export function useCoreSiteData(chartType) {
  const { zoneId, nodeId: nodeIdFromUrl } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const containerRef = useRef(null);

  const allTopologyDevices = useSelector(selectTopologyDevices);
  const allDevices = useSelector(selectAllDevices);
  const allSites = useSelector(selectAllSites);

  const [directCoreTopology, setDirectCoreTopology] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [showExtendedNodes, setShowExtendedNodes] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get("showExtended") === "true" || sp.get("extended") === "true";
    } catch {
      return false;
    }
  });
  const [animateExtendedLayoutUp, setAnimateExtendedLayoutUp] = useState(false);
  const [previousSelectedNodeId, setPreviousSelectedNodeId] = useState(null);
  const [popupDetail, setPopupDetail] = useState(null);
  const [coreSiteId, setCoreSiteId] = useState(null);

  // Local states for devices, sites, and end-site links
  const [localDevices, setLocalDevices] = useState([]);
  const [localSites, setLocalSites] = useState([]);
  const [rawEndSiteLinks, setRawEndSiteLinks] = useState([]);

  // 1. Fetch core topology (Redux thunk + direct fallback) and poll every 5 seconds
  useEffect(() => {
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

  const topologyDevicesToUse = useMemo(() => {
    if (allTopologyDevices && allTopologyDevices.length > 0) {
      return allTopologyDevices;
    }
    return directCoreTopology || [];
  }, [allTopologyDevices, directCoreTopology]);

  // Helper sets to reliably identify core devices
  const coreDeviceIds = useMemo(() => {
    const ids = new Set();
    allDevices.forEach((d) => {
      if (d.id != null) ids.add(String(d.id));
    });
    topologyDevicesToUse.forEach((d) => {
      if (d.id != null) ids.add(String(d.id));
    });
    localDevices.forEach((d) => {
      if (d.id != null) ids.add(String(d.id));
    });
    return ids;
  }, [allDevices, topologyDevicesToUse, localDevices]);

  const coreDeviceNames = useMemo(() => {
    const names = new Set();
    allDevices.forEach((d) => {
      if (d.hostname) names.add(d.hostname.toLowerCase());
      if (d.name) names.add(d.name.toLowerCase());
    });
    topologyDevicesToUse.forEach((d) => {
      if (d.name) names.add(d.name.toLowerCase());
      if (d.hostname) names.add(d.hostname.toLowerCase());
    });
    localDevices.forEach((d) => {
      if (d.hostname) names.add(d.hostname.toLowerCase());
      if (d.name) names.add(d.name.toLowerCase());
    });
    return names;
  }, [allDevices, topologyDevicesToUse, localDevices]);

  // 2. Fetch core site details and core devices for this zone
  useEffect(() => {
    let isMounted = true;
    const fetchZoneData = async () => {
      try {
        const networkId = chartType === "P" ? 2 : 1;

        // Fetch core sites to find the ID for the current zoneId (name)
        const coreSites = await api.getCoreSites(networkId).catch(() => []);
        const site = coreSites.find(
          (s) =>
            s.name === zoneId ||
            s.core_site_name === zoneId ||
            cleanDeviceKey(s.name) === cleanDeviceKey(zoneId) ||
            cleanDeviceKey(s.core_site_name) === cleanDeviceKey(zoneId)
        );

        let siteId = site?.id;
        if (!siteId) {
          const foundInTopo = topologyDevicesToUse.find(
            (d) =>
              d.coresite_name === zoneId ||
              cleanDeviceKey(d.coresite_name) === cleanDeviceKey(zoneId)
          );
          if (foundInTopo?.coresite_id) {
            siteId = foundInTopo.coresite_id;
          }
        }

        if (siteId && isMounted) {
          setCoreSiteId(siteId);
        }

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

          // Original method fallback for L Network devices that aren't specifically caught above
          const originalMatches = name.match(/[a-zA-Z]\d+/g);
          return originalMatches ? originalMatches[originalMatches.length - 1].toUpperCase() : name;
        };

        // Fetch devices for the site
        let devices = siteId
          ? await api.getCoreDevicesBySite(networkId, siteId).catch(() => [])
          : [];

        // Fallback if empty: search in topologyDevicesToUse or allDevices
        if (!devices || devices.length === 0) {
          const normZone = cleanDeviceKey(zoneId || "");
          devices = topologyDevicesToUse.filter((d) => {
            const dZone = cleanDeviceKey(d.coresite_name || "");
            return dZone && (dZone === normZone || d.coresite_name === zoneId);
          });
        }
        if (!devices || devices.length === 0) {
          const normZone = cleanDeviceKey(zoneId || "");
          devices = allDevices.filter((d) => {
            const dZone = cleanDeviceKey(d.coresite_name || d.zoneName || "");
            return dZone && (dZone === normZone || d.coresite_name === zoneId);
          });
        }

        const getEnding = (n) => {
          if (!n) return "";
          const match = n.match(/(\d+)(?!.*\d)/);
          return match ? parseInt(match[1], 10) : 99;
        };

        const priorityOrder = [1, 2, 4, 5, 7, 8];
        const sortedDevices = [...devices].sort((a, b) => {
          const a_ending = getEnding(a.hostname || a.name);
          const b_ending = getEnding(b.hostname || b.name);
          const a_p = priorityOrder.indexOf(a_ending) === -1 ? 99 : priorityOrder.indexOf(a_ending);
          const b_p = priorityOrder.indexOf(b_ending) === -1 ? 99 : priorityOrder.indexOf(b_ending);
          return a_p - b_p;
        });

        const normalizedDevices = sortedDevices.map((d) => ({
          ...d,
          hostname: d.hostname || d.name,
          shortName: getShortName(d.hostname || d.name),
        }));

        if (isMounted) {
          setLocalDevices(normalizedDevices);
        }

        const sites = await api.getSites().catch(() => []);
        if (isMounted) {
          setLocalSites(sites && sites.length > 0 ? sites : allSites);
        }
      } catch (err) {
        console.error("Failed to fetch zone data", err);
      }
    };

    fetchZoneData();
    return () => {
      isMounted = false;
    };
  }, [zoneId, chartType, topologyDevicesToUse, allDevices, allSites]);

  // Set the initially selected node once devices are loaded
  useEffect(() => {
    if (localDevices.length > 0 && !selectedNodeId) {
      const searchParams = new URLSearchParams(location.search);
      const shouldExtend =
        location.state?.showExtendedNodes === true ||
        searchParams.get("showExtended") === "true" ||
        searchParams.get("extended") === "true";

      const preferredNode = location.state?.targetNodeId || location.state?.focusedNode;
      const initialNodeId =
        nodeIdFromUrl ||
        (preferredNode && localDevices.some((d) => d.hostname === preferredNode || d.name === preferredNode)
          ? preferredNode
          : null) ||
        (shouldExtend
          ? (localDevices[4]?.hostname || localDevices[2]?.hostname || localDevices[0]?.hostname)
          : localDevices[0]?.hostname);

      if (initialNodeId) {
        setSelectedNodeId(initialNodeId);
        setPreviousSelectedNodeId(initialNodeId);
      }
    }
  }, [localDevices, nodeIdFromUrl, selectedNodeId, location.state, location.search]);

  // Synchronize selectedNodeId if targetNodeId is updated via navigation state
  useEffect(() => {
    const target = location.state?.targetNodeId || location.state?.focusedNode;
    if (target && localDevices.length > 0) {
      const match = localDevices.find((d) => d.hostname === target || d.name === target);
      if (match) {
        setSelectedNodeId(match.hostname || match.name);
      }
    }
  }, [location.state?.targetNodeId, location.state?.focusedNode, localDevices]);

  // 3. For every connection between core devices: use the info from the core-topology endpoint
  // Deduplicated by ID, bidirectional signatures, and device interface
  const coreDeviceLinks = useMemo(() => {
    if (!topologyDevicesToUse || topologyDevicesToUse.length === 0 || localDevices.length === 0) {
      return [];
    }

    const result = [];
    const seenLinkIds = new Set();
    const seenSignatures = new Set();
    const seenDeviceIfs = new Set();

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

    // Fast lookup maps
    const localDeviceMapByName = new Map();
    const localDeviceMapById = new Map();
    localDevices.forEach((d) => {
      if (d.hostname) localDeviceMapByName.set(d.hostname.toLowerCase(), d);
      if (d.name) localDeviceMapByName.set(d.name.toLowerCase(), d);
      if (d.id != null) localDeviceMapById.set(String(d.id), d);
    });

    const topoMapByName = new Map();
    const topoMapById = new Map();
    topologyDevicesToUse.forEach((d) => {
      if (d.name) topoMapByName.set(d.name.toLowerCase(), d);
      if (d.hostname) topoMapByName.set(d.hostname.toLowerCase(), d);
      if (d.id != null) topoMapById.set(String(d.id), d);
    });

    // 3a. Process links originating from each local core device in core-topology
    localDevices.forEach((localDev) => {
      const devIdStr = localDev.id != null ? String(localDev.id) : null;
      const devNameLower = (localDev.name || localDev.hostname || "").toLowerCase();

      const topoDev =
        (devIdStr ? topoMapById.get(devIdStr) : null) ||
        topoMapByName.get(devNameLower);

      if (topoDev && Array.isArray(topoDev.links)) {
        topoDev.links.forEach((link) => {
          if (!link) return;
          const linkIdStr = link.id != null ? String(link.id) : null;
          if (linkIdStr && seenLinkIds.has(linkIdStr)) return;

          const rawLocalIf = link.local_interface || "";
          const rawRemoteIf = link.remote_interface || "";
          const normLocalIf = normalizeInterfaceName(rawLocalIf);

          const remoteDevice =
            (link.remote_device_id != null ? topoMapById.get(String(link.remote_device_id)) : null) ||
            (link.remote_device_name ? topoMapByName.get(link.remote_device_name.toLowerCase()) : null) ||
            (link.remote_device_id != null ? localDeviceMapById.get(String(link.remote_device_id)) : null) ||
            (link.remote_device_name ? localDeviceMapByName.get(link.remote_device_name.toLowerCase()) : null) ||
            allDevices.find((d) =>
              (link.remote_device_id != null && (d.id === link.remote_device_id || String(d.id) === String(link.remote_device_id))) ||
              (link.remote_device_name && (d.name === link.remote_device_name || d.hostname === link.remote_device_name))
            );

          const remoteName =
            remoteDevice?.hostname ||
            remoteDevice?.name ||
            link.remote_device_name ||
            `Device-${link.remote_device_id || "Unknown"}`;

          const localName = localDev.hostname || localDev.name;

          const sig = makeSignature(
            localName,
            rawLocalIf,
            remoteName,
            rawRemoteIf
          );

          const devIfKey = `${cleanDeviceKey(localName)}::${normLocalIf}`;

          if (sig && seenSignatures.has(sig)) return;
          if (normLocalIf && seenDeviceIfs.has(devIfKey)) return;

          if (linkIdStr) seenLinkIds.add(linkIdStr);
          if (sig) seenSignatures.add(sig);
          if (normLocalIf) seenDeviceIfs.add(devIfKey);

          const currentSite = topoDev.coresite_name || localDev.coresite_name || zoneId;
          const remoteSite = remoteDevice?.coresite_name || remoteDevice?.zoneName || link.remote_coresite_name;
          const isSameSite = Boolean(currentSite && remoteSite && currentSite.toLowerCase() === remoteSite.toLowerCase());

          const { status: normalizedStatus, statusDate: linkStatusDate } = getLinkStatusAndDate(link);

          result.push({
            ...link,
            id: link.id || `core-link-${localName}-${remoteName}-${rawLocalIf}`,
            isCoreLink: true,
            isCoreDeviceConnection: true,
            sourceDevice: localDev,
            remoteDevice: remoteDevice || { id: link.remote_device_id, name: remoteName },
            neighbor_coredevice: remoteDevice || { id: link.remote_device_id, name: remoteName },
            coredevice: localDev,
            source: localName,
            target: remoteName,
            sourceNode: localName,
            targetNode: remoteName,
            name: remoteName,
            destinationIp: link.remote_link_ip || link.remote_device_ip || link.remote_ip || "N/A",
            description: link.local_interface_description || link.description || `Link to ${remoteName}`,
            local_interface_description: link.local_interface_description || link.description || `Link to ${remoteName}`,
            status: normalizedStatus,
            statusDate: linkStatusDate,
            linkType: isSameSite ? "inter-core-same-site" : "inter-core-different-site",
            rawLink: link,
          });
        });
      }
    });

    // 3b. Also check if any other device in core-topology targets one of our local devices
    topologyDevicesToUse.forEach((topoDev) => {
      if (!topoDev.links || !Array.isArray(topoDev.links)) return;

      topoDev.links.forEach((link) => {
        if (!link) return;

        const targetLocalDev =
          (link.remote_device_id != null ? localDeviceMapById.get(String(link.remote_device_id)) : null) ||
          (link.remote_device_name ? localDeviceMapByName.get(link.remote_device_name.toLowerCase()) : null);

        if (!targetLocalDev) return;

        const linkIdStr = link.id != null ? String(link.id) : null;
        if (linkIdStr && seenLinkIds.has(linkIdStr)) return;

        const rawLocalIf = link.remote_interface || link.local_interface || "";
        const rawRemoteIf = link.local_interface || link.remote_interface || "";
        const normLocalIf = normalizeInterfaceName(rawLocalIf);
        const remoteName = topoDev.hostname || topoDev.name || `Device-${topoDev.id || "Unknown"}`;
        const localName = targetLocalDev.hostname || targetLocalDev.name;

        const sig = makeSignature(
          localName,
          rawLocalIf,
          remoteName,
          rawRemoteIf
        );

        const devIfKey = `${cleanDeviceKey(localName)}::${normLocalIf}`;

        if (sig && seenSignatures.has(sig)) return;
        if (normLocalIf && seenDeviceIfs.has(devIfKey)) return;

        if (linkIdStr) seenLinkIds.add(linkIdStr);
        if (sig) seenSignatures.add(sig);
        if (normLocalIf) seenDeviceIfs.add(devIfKey);

        const currentSite = targetLocalDev.coresite_name || zoneId;
        const remoteSite = topoDev.coresite_name;
        const isSameSite = Boolean(currentSite && remoteSite && currentSite.toLowerCase() === remoteSite.toLowerCase());

        const normalizedRawLink = {
          ...link,
          local_interface: rawLocalIf,
          remote_interface: rawRemoteIf,
          local_link_ip: link.remote_link_ip || link.remote_ip,
          remote_link_ip: link.local_link_ip || link.local_ip,
          remote_device_name: remoteName,
          remote_device_id: topoDev.id,
          in_bps: link.out_bps ?? link.output_rate,
          out_bps: link.in_bps ?? link.input_rate,
        };

        const { status: normalizedStatus, statusDate: linkStatusDate } = getLinkStatusAndDate(link);

        result.push({
          ...link,
          id: link.id || `core-link-${localName}-${remoteName}-${rawLocalIf}`,
          isCoreLink: true,
          isCoreDeviceConnection: true,
          sourceDevice: targetLocalDev,
          remoteDevice: topoDev,
          neighbor_coredevice: topoDev,
          coredevice: targetLocalDev,
          source: localName,
          target: remoteName,
          sourceNode: localName,
          targetNode: remoteName,
          name: remoteName,
          local_interface: rawLocalIf,
          remote_interface: rawRemoteIf,
          local_link_ip: link.remote_link_ip || link.remote_ip,
          remote_link_ip: link.local_link_ip || link.local_ip,
          destinationIp: link.local_link_ip || link.local_ip || topoDev.ip || "N/A",
          description: link.local_interface_description || link.description || `Link to ${remoteName}`,
          local_interface_description: link.local_interface_description || link.description || `Link to ${remoteName}`,
          status: normalizedStatus,
          statusDate: linkStatusDate,
          in_bps: link.out_bps ?? link.output_rate,
          out_bps: link.in_bps ?? link.input_rate,
          linkType: isSameSite ? "inter-core-same-site" : "inter-core-different-site",
          rawLink: normalizedRawLink,
        });
      });
    });

    return result;
  }, [localDevices, topologyDevicesToUse, allDevices, zoneId]);

  // Links for the core-to-core connections in the canvas
  const mappedLinksForChart = useMemo(() => {
    return coreDeviceLinks;
  }, [coreDeviceLinks]);

  // 4. Fetch links from getLinksTopologyByDevice ONLY for connections to end sites
  useEffect(() => {
    if (localDevices.length === 0) {
      setRawEndSiteLinks([]);
      return;
    }

    let isMounted = true;
    const fetchDeviceLinks = async () => {
      try {
        const linksArrays = await Promise.all(
          localDevices.map(async (d) => {
            if (!d.id) return [];
            const data = await api.getLinksTopologyByDevice(d.id).catch(() => []);
            const arr = Array.isArray(data) ? data : data.links || [];
            return arr.map((l) => ({
              ...l,
              coredevice_id: l.coredevice_id || d.id,
              coredevice: l.coredevice || d,
            }));
          })
        );
        if (isMounted) {
          setRawEndSiteLinks(linksArrays.flat());
        }
      } catch (err) {
        console.error("Failed to fetch device links:", err);
        if (isMounted) setRawEndSiteLinks([]);
      }
    };

    fetchDeviceLinks();
    return () => {
      isMounted = false;
    };
  }, [localDevices]);

  // Filter and deduplicate end site links:
  // Strictly exclude any core links or duplicate interface connections
  const endSiteLinks = useMemo(() => {
    if (!rawEndSiteLinks || rawEndSiteLinks.length === 0) return [];

    // Create sets of already included core link IDs and interfaces for deduplication
    const coreIds = new Set(coreDeviceLinks.map((l) => String(l.id)));
    const coreIfs = new Set(
      coreDeviceLinks
        .map((l) => normalizeInterfaceName(l.local_interface))
        .filter(Boolean)
    );

    // Keep strictly connections to end sites:
    const endSitesOnly = rawEndSiteLinks.filter((link) => {
      if (!link) return false;

      // Skip if ID or local interface is already in core links
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

    // Deduplicate end site links by ID and (device + local_interface)
    const result = [];
    const seenEndSiteIds = new Set();
    const seenDeviceIfs = new Set();

    endSitesOnly.forEach((link) => {
      const linkIdStr = link.id != null ? String(link.id) : null;
      if (linkIdStr && seenEndSiteIds.has(linkIdStr)) return;

      const devId = String(link.coredevice_id || link.coredevice?.id || link.coredevice?.hostname || link.coredevice?.name || "");
      const normIf = normalizeInterfaceName(link.local_interface || "");
      const devIfKey = `${devId}::${normIf}`;

      if (normIf && seenDeviceIfs.has(devIfKey)) return;

      if (linkIdStr) seenEndSiteIds.add(linkIdStr);
      if (normIf) seenDeviceIfs.add(devIfKey);

      result.push(link);
    });

    return result;
  }, [rawEndSiteLinks, coreDeviceLinks, coreDeviceIds, coreDeviceNames]);

  // 5. Process end sites for the focused core device (SitesBar)
  // Deduplicate so each connected site appears only once
  const sitesForFocusedNode = useMemo(() => {
    if (!selectedNodeId || endSiteLinks.length === 0) return [];

    const sitesList = [];
    const sitesCollection = localSites.length > 0 ? localSites : allSites;

    // Find the currently selected device object
    const selectedDev = localDevices.find(
      (d) =>
        d.hostname === selectedNodeId ||
        d.name === selectedNodeId ||
        String(d.id) === String(selectedNodeId)
    );

    endSiteLinks.forEach((link) => {
      // Must belong to the focused device
      const devName = link.coredevice?.name || link.coredevice?.hostname || "";
      const devHostname = link.coredevice?.hostname || link.coredevice?.name || "";
      const devId = link.coredevice_id != null ? String(link.coredevice_id) : (link.coredevice?.id != null ? String(link.coredevice?.id) : "");

      const isMatch =
        devName === selectedNodeId ||
        devHostname === selectedNodeId ||
        devId === selectedNodeId ||
        (selectedDev && (devId === String(selectedDev.id) || devName === selectedDev.name || devHostname === selectedDev.hostname)) ||
        (cleanDeviceKey(devName) && cleanDeviceKey(devName) === cleanDeviceKey(selectedNodeId)) ||
        (cleanDeviceKey(devHostname) && cleanDeviceKey(devHostname) === cleanDeviceKey(selectedNodeId));

      if (!isMatch) return;

      // Find neighbor site object
      const neighborSite =
        link.neighbor_site ||
        (link.neighbor_site_id != null
          ? sitesCollection.find((s) => s.id === link.neighbor_site_id || String(s.id) === String(link.neighbor_site_id))
          : null);

      const siteName =
        (typeof neighborSite === "object" ? (neighborSite?.name || neighborSite?.site_name_english) : neighborSite) ||
        link.neighbor_site_name ||
        link.remote_device_name ||
        link.target;

      const siteObj = sitesCollection.find(
        (s) =>
          (neighborSite && typeof neighborSite === "object" && (s.id === neighborSite.id || s.name === neighborSite.name)) ||
          (link.neighbor_site_id != null && (s.id === link.neighbor_site_id || String(s.id) === String(link.neighbor_site_id))) ||
          (s.name && siteName && s.name.toLowerCase() === siteName.toLowerCase()) ||
          (s.site_name_english && siteName && s.site_name_english.toLowerCase() === siteName.toLowerCase())
      );

      if (siteObj) {
        sitesList.push({
          ...siteObj,
          linkId: link.id,
          rawLink: link,
          link: link,
        });
      } else if (siteName) {
        sitesList.push({
          id: link.neighbor_site_id || `site-${link.id}`,
          name: siteName,
          linkId: link.id,
          rawLink: link,
          link: link,
        });
      }
    });

    // Deduplicate sites by ID and Name
    const uniqueSites = [];
    const seenSiteIds = new Set();
    const seenSiteNames = new Set();

    sitesList.forEach((s) => {
      const idKey = s.id != null ? String(s.id) : null;
      const nameKey = (s.name || s.site_name_english || "").toLowerCase();

      if (idKey && seenSiteIds.has(idKey)) return;
      if (nameKey && seenSiteNames.has(nameKey)) return;

      if (idKey) seenSiteIds.add(idKey);
      if (nameKey) seenSiteNames.add(nameKey);

      uniqueSites.push(s);
    });

    return uniqueSites;
  }, [selectedNodeId, endSiteLinks, localSites, allSites, localDevices]);

  // Keep open link popup updated in real-time when polling updates core topology
  useEffect(() => {
    if (!popupDetail?.data || popupDetail.type !== "link") return;
    const currentId = popupDetail.data.id || popupDetail.data.linkId;
    if (!currentId) return;

    const updated = coreDeviceLinks.find(
      (l) => l.id === currentId || String(l.id) === String(currentId)
    );
    if (updated) {
      const raw = updated.rawLink || updated;
      const payload = createLinkPopupPayload(raw) || raw;
      const src =
        typeof payload.source === "object"
          ? payload.source?.id || payload.source?.hostname || payload.source?.name
          : payload.sourceNode || payload.sourceName || payload.source || updated.source;
      const tgt =
        typeof payload.target === "object"
          ? payload.target?.id || payload.target?.hostname || payload.target?.name
          : payload.targetNode || payload.targetName || payload.target || updated.target;

      setPopupDetail((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          title: `${src || "Device A"} ⟷ ${tgt || "Device B"}`,
          data: {
            ...payload,
            rawLink: payload.rawLink || raw,
            skipFetch: true,
            isCoreTopology: true,
          },
        };
      });
    }
  }, [coreDeviceLinks]);

  useEffect(() => {
    if (showExtendedNodes) {
      setAnimateExtendedLayoutUp(false);
      const timer = setTimeout(() => setAnimateExtendedLayoutUp(true), 100);
      return () => clearTimeout(timer);
    } else {
      setAnimateExtendedLayoutUp(false);
    }
  }, [showExtendedNodes]);

  useLayoutEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const shouldExtend =
      location.state?.showExtendedNodes === true ||
      searchParams.get("showExtended") === "true" ||
      searchParams.get("extended") === "true";

    setShowExtendedNodes(shouldExtend);
  }, [zoneId, location.state, location.search]);

  useLayoutEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    if (containerRef.current) updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const {
    nodes: layoutNodes,
    links: layoutLinks,
    centerX,
    centerY,
  } = useNodeLayout(
    dimensions.width,
    dimensions.height,
    showExtendedNodes,
    animateExtendedLayoutUp,
    localDevices,
    mappedLinksForChart
  );

  const nodes = layoutNodes.filter((node) => node.id !== "None");
  const links = layoutLinks.filter(
    (link) => link.source.id !== "None" && link.target.id !== "None"
  );

  const handleToggleExtendedNodes = () => {
    setShowExtendedNodes((prevShowExtended) => {
      const nextShowExtended = !prevShowExtended;
      if (nextShowExtended) {
        setPreviousSelectedNodeId(selectedNodeId);
        const newSelected = localDevices[2]?.hostname;
        if (newSelected) setSelectedNodeId(newSelected);
      } else {
        setSelectedNodeId(previousSelectedNodeId || localDevices[0]?.hostname);
      }
      return nextShowExtended;
    });
  };

  const onNodeClickInZone = (clickedNodeData) => {
    if (!clickedNodeData || !clickedNodeData.id) return;
    if (clickedNodeData.id === selectedNodeId) {
      navigate(`node/${clickedNodeData.id}`);
    } else {
      setSelectedNodeId(clickedNodeData.id);
    }
  };

  const openPopup = useCallback((payload) => {
    const { type } = payload;
    let title = "Details";
    if (type === "link") title = `${payload.sourceNode || payload.source} - ${payload.targetNode || payload.target}`;
    else if (type === "site") title = payload.name;
    setPopupDetail({ type, title, data: payload });
  }, []);

  const handleClosePopup = useCallback(() => {
    setPopupDetail(null);
  }, []);

  const handleNavigateToSite = useCallback((clickedSiteData) => {
    if (!clickedSiteData || !clickedSiteData.name) return;
    const navId = encodeURIComponent(clickedSiteData.name);
    navigate(`/sites/site/${navId}`, {
      state: { siteGroupData: [clickedSiteData] },
    });
  }, [navigate]);

  const handleSiteClick = (siteData) => {
    const siteDetailPayload = {
      id: siteData.id,
      navId: `site-${siteData.id}`,
      name: siteData.name || siteData.site_name_english,
      type: "site",
      zone: zoneId,
      description: `Details for ${siteData.name || siteData.site_name_english}`,
      ...siteData,
    };
    openPopup(siteDetailPayload);
  };

  const handleLinkClick = useCallback((linkData) => {
    if (!linkData) return;
    const raw = linkData.rawLink || linkData;
    const srcName =
      (typeof linkData.source === "object"
        ? linkData.source?.hostname || linkData.source?.name || linkData.source?.id
        : linkData.source) ||
      linkData.sourceNode ||
      (linkData.coredevice && (linkData.coredevice.hostname || linkData.coredevice.name)) ||
      "Device A";

    const tgtName =
      (typeof linkData.target === "object"
        ? linkData.target?.hostname || linkData.target?.name || linkData.target?.id
        : linkData.target) ||
      linkData.targetNode ||
      (linkData.neighbor_coredevice && (linkData.neighbor_coredevice.hostname || linkData.neighbor_coredevice.name)) ||
      linkData.name ||
      "Device B";

    const srcZone =
      linkData.sourceZone ||
      linkData.coredevice?.coresite_name ||
      zoneId ||
      "N/A";

    const tgtZone =
      linkData.targetZone ||
      linkData.neighbor_coredevice?.coresite_name ||
      raw.remote_coresite_name ||
      zoneId ||
      "N/A";

    const fullLinkObject = {
      ...raw,
      ...linkData,
      rawLink: raw,
      source: srcName,
      target: tgtName,
      sourceNode: srcName,
      targetNode: tgtName,
      sourceZone: srcZone,
      targetZone: tgtZone,
      sourceDevice: linkData.sourceDevice || linkData.coredevice,
      remoteDevice: linkData.remoteDevice || linkData.neighbor_coredevice,
      name: tgtName,
    };

    const payload = createLinkPopupPayload(fullLinkObject) || fullLinkObject;

    setPopupDetail({
      type: "link",
      title: `${srcName} ⟷ ${tgtName}`,
      data: {
        ...payload,
        source: srcName,
        target: tgtName,
        sourceNode: srcName,
        targetNode: tgtName,
        sourceZone: srcZone,
        targetZone: tgtZone,
        rawLink: raw,
        skipFetch: true,
        isCoreTopology: true,
      },
    });
  }, [zoneId]);

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
      (links &&
        links.find(
          (l) =>
            l.id === targetLinkId ||
            String(l.id) === String(targetLinkId) ||
            l.rawLink?.id === targetLinkId ||
            String(l.rawLink?.id) === String(targetLinkId) ||
            (l.allIds &&
              (l.allIds.includes(targetLinkId) ||
                l.allIds.includes(Number(targetLinkId)) ||
                l.allIds.includes(String(targetLinkId))))
        )) ||
      (mappedLinksForChart &&
        mappedLinksForChart.find(
          (l) =>
            l.id === targetLinkId ||
            String(l.id) === String(targetLinkId) ||
            l.rawLink?.id === targetLinkId ||
            String(l.rawLink?.id) === String(targetLinkId) ||
            (l.allIds &&
              (l.allIds.includes(targetLinkId) ||
                l.allIds.includes(Number(targetLinkId)) ||
                l.allIds.includes(String(targetLinkId))))
        )) ||
      (coreDeviceLinks &&
        coreDeviceLinks.find(
          (l) =>
            l.id === targetLinkId ||
            String(l.id) === String(targetLinkId) ||
            l.rawLink?.id === targetLinkId ||
            String(l.rawLink?.id) === String(targetLinkId) ||
            (l.allIds &&
              (l.allIds.includes(targetLinkId) ||
                l.allIds.includes(Number(targetLinkId)) ||
                l.allIds.includes(String(targetLinkId))))
        )) ||
      location.state?.selectedLink;

    if (foundLink) {
      inspectHandledKeyRef.current = navKey;
      handleLinkClick(foundLink);
    }
  }, [
    location.key,
    location.state,
    links,
    mappedLinksForChart,
    coreDeviceLinks,
    handleLinkClick,
  ]);

  return {
    zoneId,
    containerRef,
    dimensions,
    nodes,
    links,
    centerX,
    centerY,
    selectedNodeId,
    showExtendedNodes,
    handleToggleExtendedNodes,
    devicesInZoneCount: localDevices.length,
    coreSiteId,
    sitesForFocusedNode,
    onSiteClick: handleSiteClick,
    onLinkClick: handleLinkClick,
    onNodeClickInZone,
    popupDetail,
    handleClosePopup,
    handleNavigateToSite,
  };
}
