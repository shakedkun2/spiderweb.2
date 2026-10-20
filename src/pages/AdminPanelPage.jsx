import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Users,
  ShieldCheck,
  Shield,
  User,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  Server,
  Building2,
  Network,
  Check,
  AlertCircle,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

// Redux Slices & Actions
import {
  fetchUsers,
  makeUserAdmin,
  selectAllUsers,
  selectUsersStatus,
} from "../redux/slices/usersSlice";
import {
  addCoreDevice,
  deleteCoreDevice,
  selectAllDevices,
  fetchDevices,
} from "../redux/slices/devicesSlice";
import {
  addCoreSite,
  deleteCoreSite,
  selectAllPikudim,
  fetchCorePikudim,
} from "../redux/slices/corePikudimSlice";
import {
  addNetType,
  deleteNetType,
  selectAllNetTypes,
  fetchNetTypes,
} from "../redux/slices/netTypesSlice";

// Reusable Confirmation Modal
function ConfirmationModal({ isOpen, title, description, confirmText, confirmVariant = "primary", onConfirm, onCancel, isSubmitting }) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
    primary: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white",
    success: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-white",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl shrink-0 ${
              confirmVariant === "danger"
                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
            }`}
          >
            {confirmVariant === "danger" ? (
              <Trash2 className="w-6 h-6" />
            ) : (
              <ShieldCheck className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {title}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 inline-flex items-center gap-2 ${
              variantStyles[confirmVariant] || variantStyles.primary
            }`}
          >
            {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
            {confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Reusable Toast Alert Banner
function Toast({ toast, onClose }) {
  if (!toast?.show) return null;

  const isSuccess = toast.type === "success";

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in slide-in-from-bottom-5 duration-300">
      <div
        className={`flex items-start gap-3 p-4 rounded-xl shadow-xl border ${
          isSuccess
            ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
            : "bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100"
        }`}
      >
        {isSuccess ? (
          <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 text-sm font-medium pr-2">{toast.message}</div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Helper to compare IP addresses numerically
const compareIp = (ipA = "", ipB = "") => {
  const octetsA = String(ipA).split(".").map(Number);
  const octetsB = String(ipB).split(".").map(Number);
  for (let i = 0; i < 4; i++) {
    const aVal = isNaN(octetsA[i]) ? 0 : octetsA[i];
    const bVal = isNaN(octetsB[i]) ? 0 : octetsB[i];
    if (aVal !== bVal) return aVal - bVal;
  }
  return 0;
};

// Reusable Sortable Column Header Component
function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  align = "left",
  className = "",
}) {
  const isSorted = currentSort?.key === sortKey;
  const isAsc = isSorted && currentSort?.direction === "asc";
  const isDesc = isSorted && currentSort?.direction === "desc";

  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`py-3.5 px-4 cursor-pointer select-none group transition-colors hover:text-gray-900 dark:hover:text-white ${className}`}
      title={`Click to sort by ${label}`}
    >
      <div
        className={`inline-flex items-center gap-1.5 ${
          align === "right" ? "justify-end w-full" : ""
        }`}
      >
        <span>{label}</span>
        <span className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200">
          {isAsc ? (
            <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          ) : isDesc ? (
            <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-70 transition-opacity" />
          )}
        </span>
      </div>
    </th>
  );
}

export function AdminPanelPage() {
  const dispatch = useDispatch();

  // Redux Selectors
  const allUsers = useSelector(selectAllUsers);
  const usersStatus = useSelector(selectUsersStatus);
  const allCoreSites = useSelector(selectAllPikudim);
  const allDevices = useSelector(selectAllDevices);
  const allNetTypes = useSelector(selectAllNetTypes);

  // Active Tab: 'users' | 'netTypes' | 'sites' | 'devices'
  const [activeTab, setActiveTab] = useState("users");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Toast State
  const [toast, setToast] = useState({ show: false, type: "success", message: "" });
  const showToast = useCallback((message, type = "success") => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast((prev) => (prev.message === message ? { ...prev, show: false } : prev));
    }, 4500);
  }, []);

  // Confirmation Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "",
    confirmVariant: "primary",
    onConfirm: () => {},
    isSubmitting: false,
  });

  const closeModal = useCallback(() => {
    setModalConfig((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
  }, []);

  // Filter & Search states
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all"); // 'all' | 'admin' | 'user'
  const [deviceSearchTerm, setDeviceSearchTerm] = useState("");
  const [siteSearchTerm, setSiteSearchTerm] = useState("");

  // Sort states
  const [userSort, setUserSort] = useState({ key: "id", direction: "asc" });
  const [siteSort, setSiteSort] = useState({ key: "id", direction: "asc" });
  const [deviceSort, setDeviceSort] = useState({ key: "id", direction: "asc" });
  const [netTypeSort, setNetTypeSort] = useState({ key: "id", direction: "asc" });

  const handleToggleSort = (setter) => (columnKey) => {
    setter((prev) => {
      if (prev.key === columnKey) {
        return {
          key: columnKey,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  const handleUserSort = handleToggleSort(setUserSort);
  const handleSiteSort = handleToggleSort(setSiteSort);
  const handleDeviceSort = handleToggleSort(setDeviceSort);
  const handleNetTypeSort = handleToggleSort(setNetTypeSort);

  // Add Form visibility toggles
  const [showAddSite, setShowAddSite] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showAddNetType, setShowAddNetType] = useState(false);

  // Form input states
  const [coreSiteData, setCoreSiteData] = useState({ name: "", type_id: "1" });
  const [coreDeviceData, setCoreDeviceData] = useState({
    hostname: "",
    ip_address: "",
    core_pikudim_site_id: "",
    network_type_id: "",
  });
  const [netTypeData, setNetTypeData] = useState({ name: "" });
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);

  // Fetch initial data on mount
  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchUsers()),
        dispatch(fetchCorePikudim()),
        dispatch(fetchDevices()),
        dispatch(fetchNetTypes()),
      ]);
      showToast("Admin data refreshed successfully", "success");
    } catch (err) {
      showToast(`Error refreshing admin data: ${err.message || err}`, "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  // --- STATS CALCULATIONS ---
  const stats = useMemo(() => {
    const totalUsers = allUsers.length;
    const adminUsersCount = allUsers.filter((u) => u.role === "admin").length;
    const standardUsersCount = totalUsers - adminUsersCount;

    return {
      totalUsers,
      adminUsersCount,
      standardUsersCount,
      totalSites: allCoreSites.length,
      totalDevices: allDevices.length,
      totalNetTypes: allNetTypes.length,
    };
  }, [allUsers, allCoreSites, allDevices, allNetTypes]);

  // --- FILTERED LISTS ---
  const filteredUsers = useMemo(() => {
    return allUsers.filter((user) => {
      const matchesSearch =
        (user.username && user.username.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
        String(user.id).includes(userSearchTerm);

      const matchesRole =
        userRoleFilter === "all" ||
        (userRoleFilter === "admin" && user.role === "admin") ||
        (userRoleFilter === "user" && user.role !== "admin");

      return matchesSearch && matchesRole;
    });
  }, [allUsers, userSearchTerm, userRoleFilter]);

  const filteredSites = useMemo(() => {
    if (!siteSearchTerm.trim()) return allCoreSites;
    const term = siteSearchTerm.toLowerCase();
    return allCoreSites.filter((site) => {
      const name = (site.name || site.core_site_name || "").toLowerCase();
      return name.includes(term) || String(site.id).includes(term);
    });
  }, [allCoreSites, siteSearchTerm]);

  const filteredDevices = useMemo(() => {
    if (!deviceSearchTerm.trim()) return allDevices;
    const term = deviceSearchTerm.toLowerCase();
    return allDevices.filter((dev) => {
      const host = (dev.hostname || dev.name || "").toLowerCase();
      const ip = (dev.ip || dev.ip_address || "").toLowerCase();
      return host.includes(term) || ip.includes(term) || String(dev.id).includes(term);
    });
  }, [allDevices, deviceSearchTerm]);

  // --- SORTED LISTS ---
  const sortedUsers = useMemo(() => {
    const list = [...filteredUsers];
    const { key, direction } = userSort;
    const mult = direction === "asc" ? 1 : -1;

    list.sort((a, b) => {
      if (key === "id") {
        return (Number(a.id) - Number(b.id)) * mult;
      }
      if (key === "username") {
        return (a.username || "").localeCompare(b.username || "", undefined, { numeric: true }) * mult;
      }
      if (key === "role") {
        return (a.role || "").localeCompare(b.role || "") * mult;
      }
      if (key === "privilege") {
        const pA = a.role === "admin" ? 1 : 0;
        const pB = b.role === "admin" ? 1 : 0;
        return (pA - pB) * mult;
      }
      return 0;
    });

    return list;
  }, [filteredUsers, userSort]);

  const sortedSites = useMemo(() => {
    const list = [...filteredSites];
    const { key, direction } = siteSort;
    const mult = direction === "asc" ? 1 : -1;

    list.sort((a, b) => {
      if (key === "id") {
        return (Number(a.id) - Number(b.id)) * mult;
      }
      if (key === "name") {
        const nA = a.core_site_name || a.name || "";
        const nB = b.core_site_name || b.name || "";
        return nA.localeCompare(nB, undefined, { numeric: true }) * mult;
      }
      if (key === "type") {
        return ((a.type_id || 0) - (b.type_id || 0)) * mult;
      }
      if (key === "devicesCount") {
        const countA = allDevices.filter(
          (d) => d.coresite_id === a.id || d.core_pikudim_site_id === a.id
        ).length;
        const countB = allDevices.filter(
          (d) => d.coresite_id === b.id || d.core_pikudim_site_id === b.id
        ).length;
        return (countA - countB) * mult;
      }
      return 0;
    });

    return list;
  }, [filteredSites, siteSort, allDevices]);

  const sortedDevices = useMemo(() => {
    const list = [...filteredDevices];
    const { key, direction } = deviceSort;
    const mult = direction === "asc" ? 1 : -1;

    list.sort((a, b) => {
      if (key === "id") {
        return (Number(a.id) - Number(b.id)) * mult;
      }
      if (key === "hostname") {
        const hA = a.hostname || a.name || "";
        const hB = b.hostname || b.name || "";
        return hA.localeCompare(hB, undefined, { numeric: true }) * mult;
      }
      if (key === "ip") {
        const ipA = a.ip || a.ip_address || "";
        const ipB = b.ip || b.ip_address || "";
        return compareIp(ipA, ipB) * mult;
      }
      if (key === "site") {
        const siteIdA = a.coresite_id || a.core_pikudim_site_id;
        const siteIdB = b.coresite_id || b.core_pikudim_site_id;
        const siteA = allCoreSites.find((s) => s.id === siteIdA);
        const siteB = allCoreSites.find((s) => s.id === siteIdB);
        const nameA = siteA ? siteA.core_site_name || siteA.name : "";
        const nameB = siteB ? siteB.core_site_name || siteB.name : "";
        return nameA.localeCompare(nameB, undefined, { numeric: true }) * mult;
      }
      if (key === "network") {
        const netA = allNetTypes.find((n) => n.id === a.network_type_id)?.name || "";
        const netB = allNetTypes.find((n) => n.id === b.network_type_id)?.name || "";
        return netA.localeCompare(netB, undefined, { numeric: true }) * mult;
      }
      return 0;
    });

    return list;
  }, [filteredDevices, deviceSort, allCoreSites, allNetTypes]);

  const sortedNetTypes = useMemo(() => {
    const list = [...allNetTypes];
    const { key, direction } = netTypeSort;
    const mult = direction === "asc" ? 1 : -1;

    list.sort((a, b) => {
      if (key === "id") {
        return (Number(a.id) - Number(b.id)) * mult;
      }
      if (key === "name") {
        return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true }) * mult;
      }
      if (key === "devicesCount") {
        const countA = allDevices.filter((d) => d.network_type_id === a.id).length;
        const countB = allDevices.filter((d) => d.network_type_id === b.id).length;
        return (countA - countB) * mult;
      }
      return 0;
    });

    return list;
  }, [allNetTypes, netTypeSort, allDevices]);

  // Options for Dropdowns
  const coreSiteOptions = useMemo(
    () =>
      allCoreSites.map((site) => ({
        value: site.id,
        label: site.core_site_name || site.name,
      })),
    [allCoreSites]
  );

  const netTypeOptions = useMemo(
    () =>
      allNetTypes.map((nt) => ({
        value: nt.id,
        label: nt.name,
      })),
    [allNetTypes]
  );

  // --- ACTION: MAKE USER ADMIN ---
  const promptMakeAdmin = (user) => {
    setModalConfig({
      isOpen: true,
      title: "Grant Administrator Privileges",
      description: `Are you sure you want to promote "${user.username}" (User ID: #${user.id}) to an Administrator? This grants full access to system entities and administration privileges.`,
      confirmText: "Make Administrator",
      confirmVariant: "success",
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isSubmitting: true }));
        try {
          const res = await dispatch(makeUserAdmin(user.id)).unwrap();
          showToast(res.message || `User "${user.username}" is now an admin!`, "success");
          closeModal();
        } catch (error) {
          showToast(`Error promoting user: ${error}`, "error");
          setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
        }
      },
    });
  };

  // --- ACTION: DELETE ENTITY ---
  const promptDeleteEntity = (type, item) => {
    let title = "";
    let description = "";
    let deleteThunkAction = null;
    let itemId = item.id;

    if (type === "site") {
      const siteName = item.core_site_name || item.name;
      title = "Delete Core Site";
      description = `Are you sure you want to delete core site "${siteName}"? This action is permanent and may affect linked topology devices.`;
      deleteThunkAction = () => dispatch(deleteCoreSite(itemId));
    } else if (type === "device") {
      const host = item.hostname || item.name;
      title = "Delete Core Device";
      description = `Are you sure you want to delete core device "${host}" (${item.ip || item.ip_address})? This action cannot be undone.`;
      deleteThunkAction = () => dispatch(deleteCoreDevice(itemId));
    } else if (type === "netType") {
      title = "Delete Network Type";
      description = `Are you sure you want to delete network type "${item.name}"?`;
      deleteThunkAction = () => dispatch(deleteNetType(itemId));
    }

    setModalConfig({
      isOpen: true,
      title,
      description,
      confirmText: "Delete",
      confirmVariant: "danger",
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isSubmitting: true }));
        try {
          await deleteThunkAction().unwrap();
          showToast(`${title.replace("Delete ", "")} deleted successfully.`, "success");
          closeModal();
        } catch (error) {
          showToast(`Deletion failed: ${error.message || error}`, "error");
          setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
        }
      },
    });
  };

  // --- FORM HANDLERS ---
  const handleAddSiteSubmit = async (e) => {
    e.preventDefault();
    if (!coreSiteData.name.trim()) return;
    setIsFormSubmitting(true);
    try {
      await dispatch(
        addCoreSite({
          name: coreSiteData.name.trim(),
          core_site_name: coreSiteData.name.trim(),
          type_id: parseInt(coreSiteData.type_id, 10),
        })
      ).unwrap();
      showToast(`Core Site "${coreSiteData.name}" created successfully!`, "success");
      setCoreSiteData({ name: "", type_id: "1" });
      setShowAddSite(false);
    } catch (err) {
      showToast(`Failed to add site: ${err.message || err}`, "error");
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleAddDeviceSubmit = async (e) => {
    e.preventDefault();
    if (!coreDeviceData.hostname.trim() || !coreDeviceData.ip_address.trim()) return;
    setIsFormSubmitting(true);
    try {
      await dispatch(
        addCoreDevice({
          name: coreDeviceData.hostname.trim(),
          hostname: coreDeviceData.hostname.trim(),
          ip: coreDeviceData.ip_address.trim(),
          ip_address: coreDeviceData.ip_address.trim(),
          coresite_id: parseInt(coreDeviceData.core_pikudim_site_id, 10),
          core_pikudim_site_id: parseInt(coreDeviceData.core_pikudim_site_id, 10),
          network_type_id: parseInt(coreDeviceData.network_type_id, 10),
        })
      ).unwrap();
      showToast(`Core Device "${coreDeviceData.hostname}" created successfully!`, "success");
      setCoreDeviceData({
        hostname: "",
        ip_address: "",
        core_pikudim_site_id: "",
        network_type_id: "",
      });
      setShowAddDevice(false);
    } catch (err) {
      showToast(`Failed to add device: ${err.message || err}`, "error");
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleAddNetTypeSubmit = async (e) => {
    e.preventDefault();
    if (!netTypeData.name.trim()) return;
    setIsFormSubmitting(true);
    try {
      await dispatch(addNetType({ name: netTypeData.name.trim() })).unwrap();
      showToast(`Network Type "${netTypeData.name}" created successfully!`, "success");
      setNetTypeData({ name: "" });
      setShowAddNetType(false);
    } catch (err) {
      showToast(`Failed to add network type: ${err.message || err}`, "error");
    } finally {
      setIsFormSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden p-6 sm:p-8 bg-gray-50 dark:bg-gray-900 transition-colors dark-scrollbar">
      {/* Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmText={modalConfig.confirmText}
        confirmVariant={modalConfig.confirmVariant}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeModal}
        isSubmitting={modalConfig.isSubmitting}
      />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* --- PAGE HEADER --- */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Admin Panel
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                Console
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage system access, assign administrator privileges, and configure core network infrastructure.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-500" : ""}`} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* --- KPI STAT CARDS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Users */}
          <div
            onClick={() => setActiveTab("users")}
            className="cursor-pointer group p-5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                User Accounts
              </span>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalUsers}
              </span>
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                {stats.adminUsersCount} Admins
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {stats.standardUsersCount} Standard Users
            </p>
          </div>

          {/* Network Types */}
          <div
            onClick={() => setActiveTab("netTypes")}
            className="cursor-pointer group p-5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-amber-500/50 dark:hover:border-amber-500/50 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Network Types
              </span>
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <Network className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalNetTypes}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Profiles</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Network class partitions
            </p>
          </div>

          {/* Core Sites */}
          <div
            onClick={() => setActiveTab("sites")}
            className="cursor-pointer group p-5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Core Sites
              </span>
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalSites}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Configured</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Topology regional nodes
            </p>
          </div>

          {/* Core Devices */}
          <div
            onClick={() => setActiveTab("devices")}
            className="cursor-pointer group p-5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-violet-500/50 dark:hover:border-violet-500/50 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Core Devices
              </span>
              <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 group-hover:scale-105 transition-transform">
                <Server className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalDevices}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Active</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Routers & gateway units
            </p>
          </div>
        </div>

        {/* --- TABS NAVIGATION --- */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-2 sm:space-x-6 overflow-x-auto" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === "users"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Users & Permissions</span>
              <span
                className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                  activeTab === "users"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {allUsers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("netTypes")}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === "netTypes"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Network className="w-4 h-4" />
              <span>Network Types</span>
              <span
                className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                  activeTab === "netTypes"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {allNetTypes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("sites")}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === "sites"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Core Sites</span>
              <span
                className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                  activeTab === "sites"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {allCoreSites.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("devices")}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === "devices"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Core Devices</span>
              <span
                className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                  activeTab === "devices"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {allDevices.length}
              </span>
            </button>
          </nav>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: USERS & PERMISSIONS                                    */}
        {/* ============================================================== */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Search & Role Filter Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Search by username or ID..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:inline">
                  Filter:
                </span>
                <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-900/80 p-1 text-xs">
                  <button
                    onClick={() => setUserRoleFilter("all")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      userRoleFilter === "all"
                        ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    All ({allUsers.length})
                  </button>
                  <button
                    onClick={() => setUserRoleFilter("admin")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      userRoleFilter === "admin"
                        ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Admins ({stats.adminUsersCount})
                  </button>
                  <button
                    onClick={() => setUserRoleFilter("user")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      userRoleFilter === "user"
                        ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Standard ({stats.standardUsersCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <tr>
                      <SortableHeader
                        label="User"
                        sortKey="username"
                        currentSort={userSort}
                        onSort={handleUserSort}
                        className="sm:px-6"
                      />
                      <SortableHeader
                        label="User ID"
                        sortKey="id"
                        currentSort={userSort}
                        onSort={handleUserSort}
                      />
                      <SortableHeader
                        label="Current Role"
                        sortKey="role"
                        currentSort={userSort}
                        onSort={handleUserSort}
                      />
                      <SortableHeader
                        label="Privilege Status"
                        sortKey="privilege"
                        currentSort={userSort}
                        onSort={handleUserSort}
                      />
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {usersStatus === "loading" && allUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-500 dark:text-gray-400">
                          <RefreshCw className="w-8 h-8 mx-auto text-blue-500 animate-spin mb-2" />
                          <p className="font-medium text-base">Loading users...</p>
                        </td>
                      </tr>
                    ) : sortedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-500 dark:text-gray-400">
                          <Users className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                          <p className="font-medium text-base">No users found</p>
                          <p className="text-xs mt-1">
                            {userSearchTerm
                              ? `No users match "${userSearchTerm}".`
                              : "No registered users in the database."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      sortedUsers.map((user) => {
                        const isAdmin = user.role === "admin";
                        const initialLetter = (user.username || "U").charAt(0).toUpperCase();

                        return (
                          <tr
                            key={user.id}
                            className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                          >
                            {/* User Avatar + Username */}
                            <td className="py-4 px-4 sm:px-6">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                                    isAdmin
                                      ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm ring-2 ring-indigo-400/30"
                                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                  }`}
                                >
                                  {initialLetter}
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                    <span>{user.username}</span>
                                    {isAdmin && (
                                      <ShieldCheck className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {isAdmin ? "Full Admin Access" : "Standard Operator"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* User ID */}
                            <td className="py-4 px-4">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                                #{user.id}
                              </span>
                            </td>

                            {/* Current Role Badge */}
                            <td className="py-4 px-4">
                              {isAdmin ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                  <User className="w-3.5 h-3.5 text-gray-500" />
                                  User
                                </span>
                              )}
                            </td>

                            {/* Privilege Description */}
                            <td className="py-4 px-4 text-xs text-gray-600 dark:text-gray-300">
                              {isAdmin ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                  Can manage users & entities
                                </span>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">
                                  Read-only dashboard permissions
                                </span>
                              )}
                            </td>

                            {/* Action Button */}
                            <td className="py-4 px-4 sm:px-6 text-right">
                              {isAdmin ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  <Check className="w-3.5 h-3.5" />
                                  Admin Active
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => promptMakeAdmin(user)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                >
                                  <Shield className="w-3.5 h-3.5" />
                                  Make Admin
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: NETWORK TYPES                                          */}
        {/* ============================================================== */}
        {activeTab === "netTypes" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Network profiles define operational partitions for infrastructure topology.
              </div>

              <button
                type="button"
                onClick={() => setShowAddNetType(!showAddNetType)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4" />
                <span>{showAddNetType ? "Close Form" : "Add Net Type"}</span>
              </button>
            </div>

            {/* Collapsible Add Net Type Card */}
            {showAddNetType && (
              <form
                onSubmit={handleAddNetTypeSubmit}
                className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-900/50 shadow-md space-y-4 animate-in fade-in duration-200"
              >
                <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Network className="w-5 h-5 text-blue-600" />
                    New Network Type
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddNetType(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="max-w-md">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Network Type Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Backbone WAN"
                    value={netTypeData.name}
                    onChange={(e) => setNetTypeData({ ...netTypeData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddNetType(false)}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isFormSubmitting}
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isFormSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>Save Net Type</span>
                  </button>
                </div>
              </form>
            )}

            {/* Net Types Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <tr>
                      <SortableHeader
                        label="Type ID"
                        sortKey="id"
                        currentSort={netTypeSort}
                        onSort={handleNetTypeSort}
                        className="sm:px-6"
                      />
                      <SortableHeader
                        label="Network Type Name"
                        sortKey="name"
                        currentSort={netTypeSort}
                        onSort={handleNetTypeSort}
                      />
                      <SortableHeader
                        label="Assigned Devices"
                        sortKey="devicesCount"
                        currentSort={netTypeSort}
                        onSort={handleNetTypeSort}
                      />
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedNetTypes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-gray-500 dark:text-gray-400">
                          <Network className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                          <p className="font-medium">No network types found</p>
                        </td>
                      </tr>
                    ) : (
                      sortedNetTypes.map((nt) => {
                        const assignedDevicesCount = allDevices.filter(
                          (d) => d.network_type_id === nt.id
                        ).length;

                        return (
                          <tr
                            key={nt.id}
                            className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                          >
                            <td className="py-4 px-4 sm:px-6">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                                #{nt.id}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-semibold text-gray-900 dark:text-gray-100">
                              {nt.name}
                            </td>
                            <td className="py-4 px-4 text-gray-600 dark:text-gray-300">
                              <span className="font-medium">{assignedDevicesCount}</span> device(s)
                            </td>
                            <td className="py-4 px-4 sm:px-6 text-right">
                              <button
                                type="button"
                                onClick={() => promptDeleteEntity("netType", nt)}
                                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                title="Delete Network Type"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: CORE SITES                                             */}
        {/* ============================================================== */}
        {activeTab === "sites" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={siteSearchTerm}
                  onChange={(e) => setSiteSearchTerm(e.target.value)}
                  placeholder="Filter core sites by name or ID..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAddSite(!showAddSite)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4" />
                <span>{showAddSite ? "Close Form" : "Add Core Site"}</span>
              </button>
            </div>

            {/* Collapsible Add Core Site Card */}
            {showAddSite && (
              <form
                onSubmit={handleAddSiteSubmit}
                className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-900/50 shadow-md space-y-4 animate-in fade-in duration-200"
              >
                <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    New Core Site
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddSite(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      Site Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pikud Center"
                      value={coreSiteData.name}
                      onChange={(e) => setCoreSiteData({ ...coreSiteData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      Chart Type / Group <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={coreSiteData.type_id}
                      onChange={(e) => setCoreSiteData({ ...coreSiteData, type_id: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1">L-Chart (Level 1 Topology)</option>
                      <option value="2">P-Chart (Level 2 Topology)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddSite(false)}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isFormSubmitting}
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isFormSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>Save Core Site</span>
                  </button>
                </div>
              </form>
            )}

            {/* Sites Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <tr>
                      <SortableHeader
                        label="Site ID"
                        sortKey="id"
                        currentSort={siteSort}
                        onSort={handleSiteSort}
                        className="sm:px-6"
                      />
                      <SortableHeader
                        label="Core Site Name"
                        sortKey="name"
                        currentSort={siteSort}
                        onSort={handleSiteSort}
                      />
                      <SortableHeader
                        label="Topology Type"
                        sortKey="type"
                        currentSort={siteSort}
                        onSort={handleSiteSort}
                      />
                      <SortableHeader
                        label="Devices Configured"
                        sortKey="devicesCount"
                        currentSort={siteSort}
                        onSort={handleSiteSort}
                      />
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedSites.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-500 dark:text-gray-400">
                          <Building2 className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                          <p className="font-medium">No core sites found</p>
                        </td>
                      </tr>
                    ) : (
                      sortedSites.map((site) => {
                        const siteDevicesCount = allDevices.filter(
                          (d) => d.coresite_id === site.id || d.core_pikudim_site_id === site.id
                        ).length;

                        return (
                          <tr
                            key={site.id}
                            className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                          >
                            <td className="py-4 px-4 sm:px-6">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                                #{site.id}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-semibold text-gray-900 dark:text-gray-100">
                              {site.core_site_name || site.name}
                            </td>
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {site.type_id === 2 ? "P-Chart" : "L-Chart"}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-gray-600 dark:text-gray-300">
                              <span className="font-medium">{siteDevicesCount}</span> device(s)
                            </td>
                            <td className="py-4 px-4 sm:px-6 text-right">
                              <button
                                type="button"
                                onClick={() => promptDeleteEntity("site", site)}
                                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                title="Delete Site"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: CORE DEVICES                                           */}
        {/* ============================================================== */}
        {activeTab === "devices" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={deviceSearchTerm}
                  onChange={(e) => setDeviceSearchTerm(e.target.value)}
                  placeholder="Filter by hostname, IP address, or ID..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAddDevice(!showAddDevice)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4" />
                <span>{showAddDevice ? "Close Form" : "Add Core Device"}</span>
              </button>
            </div>

            {/* Collapsible Add Core Device Card */}
            {showAddDevice && (
              <form
                onSubmit={handleAddDeviceSubmit}
                className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-900/50 shadow-md space-y-4 animate-in fade-in duration-200"
              >
                <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Server className="w-5 h-5 text-blue-600" />
                    New Core Device
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddDevice(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      Hostname <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. rtr-core-01"
                      value={coreDeviceData.hostname}
                      onChange={(e) => setCoreDeviceData({ ...coreDeviceData, hostname: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      IP Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 10.0.1.1"
                      value={coreDeviceData.ip_address}
                      onChange={(e) => setCoreDeviceData({ ...coreDeviceData, ip_address: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      Associated Core Site <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={coreDeviceData.core_pikudim_site_id}
                      onChange={(e) =>
                        setCoreDeviceData({ ...coreDeviceData, core_pikudim_site_id: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Core Site --</option>
                      {coreSiteOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      Network Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={coreDeviceData.network_type_id}
                      onChange={(e) =>
                        setCoreDeviceData({ ...coreDeviceData, network_type_id: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Network Type --</option>
                      {netTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddDevice(false)}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isFormSubmitting}
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isFormSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>Save Core Device</span>
                  </button>
                </div>
              </form>
            )}

            {/* Devices Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <tr>
                      <SortableHeader
                        label="Device ID"
                        sortKey="id"
                        currentSort={deviceSort}
                        onSort={handleDeviceSort}
                        className="sm:px-6"
                      />
                      <SortableHeader
                        label="Hostname"
                        sortKey="hostname"
                        currentSort={deviceSort}
                        onSort={handleDeviceSort}
                      />
                      <SortableHeader
                        label="IP Address"
                        sortKey="ip"
                        currentSort={deviceSort}
                        onSort={handleDeviceSort}
                      />
                      <SortableHeader
                        label="Associated Site"
                        sortKey="site"
                        currentSort={deviceSort}
                        onSort={handleDeviceSort}
                      />
                      <SortableHeader
                        label="Network Profile"
                        sortKey="network"
                        currentSort={deviceSort}
                        onSort={handleDeviceSort}
                      />
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedDevices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500 dark:text-gray-400">
                          <Server className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                          <p className="font-medium">No core devices found</p>
                        </td>
                      </tr>
                    ) : (
                      sortedDevices.map((device) => {
                        const siteId = device.coresite_id || device.core_pikudim_site_id;
                        const site = allCoreSites.find((s) => s.id === siteId);
                        const siteName = site ? site.core_site_name || site.name : `Site #${siteId || "?"}`;

                        const netType = allNetTypes.find((nt) => nt.id === device.network_type_id);
                        const netTypeName = netType ? netType.name : "Default";

                        return (
                          <tr
                            key={device.id}
                            className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                          >
                            <td className="py-4 px-4 sm:px-6">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                                #{device.id}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-semibold text-gray-900 dark:text-gray-100">
                              {device.hostname || device.name}
                            </td>
                            <td className="py-4 px-4">
                              <span className="font-mono text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                                {device.ip || device.ip_address || "N/A"}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-gray-600 dark:text-gray-300">
                              <span className="inline-flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                {siteName}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                {netTypeName}
                              </span>
                            </td>
                            <td className="py-4 px-4 sm:px-6 text-right">
                              <button
                                type="button"
                                onClick={() => promptDeleteEntity("device", device)}
                                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                title="Delete Device"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanelPage;
