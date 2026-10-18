import axios from "axios";
import Cookies from "js-cookie";

// --- Configuration ---
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

// --- Create a Centralized Axios Instance ---
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// --- Axios Interceptor for Authentication ---
apiClient.interceptors.request.use(
  (config) => {
    const token = Cookies.get("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- API Helper Function ---
const handleApiCall = async (request) => {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    console.error("API call failed:", error.response || error.message);
    throw error;
  }
};

export const api = {
  // --- AUTHENTICATION ---
  login: async (username, password) => {
    const response = await apiClient.post("/login", { username, password });

    const [authInfo, roleInfo] = response.data;

    const token = authInfo.access_token;
    const role = roleInfo.role;

    if (token && role) {
      Cookies.set("authToken", token, {
        expires: 7,
      });
      Cookies.set("userRrole", role.toLowerCase(), {
        expires: 7,
      });
    }

    return { token, role: role ? role.toLowerCase() : null };
  },

  // --- GET Endpoints ---
  getTenGigLines: (skip = 0, limit = 20, coredevice_id = null, start_date = null, end_date = null) => {
    const params = { skip, limit };
    if (coredevice_id) params.coredevice_id = coredevice_id;
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    return handleApiCall(apiClient.get("/links", { params }));
  },
  getNetTypes: () => handleApiCall(apiClient.get("/networks")),
  getCorePikudim: async () => {
    const topo = await handleApiCall(apiClient.get("/api/core-topology"));
    const uniqueSites = [...new Set(topo.devices.map(d => d.coresite_name).filter(Boolean))];
    return uniqueSites.map((name, index) => ({ id: index + 1, name: name, core_site_name: name }));
  },
  getCoreDevices: async () => {
    const networks = await handleApiCall(apiClient.get("/networks")).catch(() => []);
    const allDevices = [];

    await Promise.all(networks.map(async (network) => {
      try {
        const sites = await handleApiCall(apiClient.get(`/network/${network.id}/coresites`));

        await Promise.all(sites.map(async (site) => {
          try {
            const devices = await handleApiCall(
              apiClient.get(`/network/${network.id}/coresite/${site.id}/coredevices`)
            );
            if (Array.isArray(devices)) {
              allDevices.push(...devices);
            }
          } catch (e) {
            console.error(`Failed to fetch devices for network ${network.id}, site ${site.id}`, e);
          }
        }));
      } catch (e) {
        console.error(`Failed to fetch sites for network ${network.id}`, e);
      }
    }));

    return allDevices;
  },
  getCoreTopology: () => handleApiCall(apiClient.get("/api/core-topology")),
  getCoreTopologyEvents: (params) =>
    handleApiCall(apiClient.get("/api/core-topology-events", { params })),
  getSites: () => handleApiCall(apiClient.get("/sites")),
  getLinksTopology: () => handleApiCall(apiClient.get("/links/topology")),
  getLinksTopologyByDevice: (deviceId) => handleApiCall(apiClient.get(`/link/topology/${deviceId}`)),
  getCoreSites: (networkId) => handleApiCall(apiClient.get(`/network/${networkId}/coresites`)),
  getCoreDevicesBySite: (networkId, coresiteId) => handleApiCall(apiClient.get(`/network/${networkId}/coresite/${coresiteId}/coredevices`)),
  getDeviceInfo: (deviceId) =>
    handleApiCall(apiClient.get(`/get_device_info/${deviceId}`)).catch(() => []),
  getDevicesByCorePikudim: (corePikudimId) =>
    handleApiCall(
      apiClient.get(`/coresite/${corePikudimId}/coredevices`)
    ),
  getSiteBandwidth: (siteName) =>
    handleApiCall(apiClient.get(`/get_site_bw/${siteName}`)).catch(() => ({ bw: "10G" })),
  getInterfacesUp: (siteName) =>
    handleApiCall(apiClient.get(`/get_interfaces_up/${siteName}`)).catch(() => []),
  getCoreSiteTraffic: (coresiteId) =>
    handleApiCall(apiClient.get(`/get-core-site-traffic/${coresiteId}/`)),
  getUsers: () => handleApiCall(apiClient.get("/users/")),

  // --- POST (Create/Add) Endpoints ---
  addCorePikudim: (pikudData) =>
    handleApiCall(apiClient.post("/admin/coresite/create/", { name: pikudData.name || pikudData.core_site_name })),
  addCoreDevice: (deviceData) =>
    handleApiCall(apiClient.post("/admin/coredevice/create/", {
      name: deviceData.name || deviceData.hostname,
      ip: deviceData.ip || deviceData.ip_address,
      coresite_id: parseInt(deviceData.coresite_id || deviceData.core_pikudim_site_id, 10),
    })),
  addNetType: (netTypeData) =>
    handleApiCall(apiClient.post("/admin/network/create/", { name: netTypeData.name })),
  getWanConnection: (networkData) =>
    handleApiCall(apiClient.post("/get_wan_connection", networkData)).catch(() => ({ status: "connected" })),

  // --- CORE TOPOLOGY Endpoints ---
  executeManualPing: (linkId, config) => {
    const { repeat = 10000, size = 9000, dfBit = false } = config || {};
    return handleApiCall(
      apiClient.post("/api/core-topology/ping-link", {
        link_id: linkId,
        repeat,
        size,
        df_bit: dfBit,
      })
    );
  },

  // --- PUT (Update/Action) Endpoints ---
  makeUserAdmin: (userId) =>
    handleApiCall(apiClient.put(`/users/${userId}/make-admin`)),

  refreshInterfacesPerDevice: (deviceId) =>
    handleApiCall(apiClient.put(`/refresh_interfaces_per_device/${deviceId}`)).catch(() => ({ status: "ok" })),

  refreshInterface: (refreshData) =>
    handleApiCall(apiClient.put(`/refresh_interface`, refreshData)).catch(() => ({ status: "ok" })),

  favoriteAlert: (alertId) =>
    handleApiCall(apiClient.put(`/favorite_alert/${alertId}`)).catch(() => ({ status: "ok" })),

  // --- DELETE Endpoints ---
  deleteCorePikudim: (corePikudimId) =>
    handleApiCall(apiClient.delete(`/admin/coresite/delete/${corePikudimId}`)),
  deleteDevice: (deviceId) =>
    handleApiCall(apiClient.delete(`/admin/coredevice/delete/${deviceId}`)),
  deleteNetType: (netTypeId) =>
    handleApiCall(apiClient.delete(`/admin/network/delete/${netTypeId}`)),
  deleteAlert: (alertId) =>
    handleApiCall(apiClient.delete(`/delete_alert/${alertId}`)).catch(() => ({ status: "ok" })),

  // --- ALERTS Endpoints ---
  getAllAlerts: () =>
    handleApiCall(apiClient.get("/alerts")).then((res) => (Array.isArray(res) ? res : res.alerts || [])),

  getAllAlertsStatus: () =>
    handleApiCall(apiClient.get("/get_all_alerts_status")).catch(() => ({ status: "ok" })),

  getAllAlertsSeverity: () =>
    handleApiCall(apiClient.get("/get_all_alerts_severity")).catch(() => ({ severities: [] })),

  getFavoriteLinks: () =>
    handleApiCall(apiClient.get("/favorite-links")),

  addFavoriteLink: (linkId) =>
    handleApiCall(apiClient.post(`/add-favorite-link/${linkId}`)),

  removeFavoriteLink: (linkId) =>
    handleApiCall(apiClient.delete(`/delete-favorite-link/${linkId}`)),
};

export const getLinkDetails = (coredevice_id, neighbor_coredevice_id, name) => {
  const params = { skip: 0, limit: 1, coredevice_id, neighbor_coredevice_id, name };
  return handleApiCall(apiClient.get("/links", { params }));
};
