import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchAggregatedAlerts } from "../../services/alertsService";

// --- ASYNC THUNKS for Alerts ---
export const fetchAlerts = createAsyncThunk(
  "alerts/fetchAlerts",
  async (args = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const period = args.period || state.alerts.selectedPeriod || "1w";
      const alerts = await fetchAggregatedAlerts(period);
      return { alerts, period, silent: Boolean(args.silent) };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch alerts");
    }
  }
);

// Backward-compatible alias
export const fetchAllAlerts = fetchAlerts;

export const deleteAlert = createAsyncThunk(
  "alerts/delete",
  async (alertId) => alertId
);

export const favoriteAlert = createAsyncThunk(
  "alerts/favorite",
  async (alertId) => alertId
);

const loadIgnoreAlertsFromStorage = () => {
  try {
    return localStorage.getItem("spiderweb_ignore_alerts") === "true";
  } catch {
    return false;
  }
};

const loadDismissedAlertsFromStorage = () => {
  try {
    const raw = localStorage.getItem("spiderweb_dismissed_alerts");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const alertsSlice = createSlice({
  name: "alerts",
  initialState: {
    items: [],
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    selectedPeriod: "1w", // '24h' | '1w' | '2w' | '1m'
    sidebarToasts: [],
    seenAlertIds: [],
    hasInitialLoaded: false,
    ignoreAlerts: loadIgnoreAlertsFromStorage(),
    dismissedAlertIds: loadDismissedAlertsFromStorage(),
  },
  reducers: {
    setSelectedPeriod: (state, action) => {
      state.selectedPeriod = action.payload;
    },
    dismissToast: (state, action) => {
      const toastId = action.payload;
      const toast = state.sidebarToasts.find(
        (t) => t.id === toastId || t.alertId === toastId
      );
      const targetAlertId =
        toast?.alertId ||
        (typeof toastId === "string" && !toastId.startsWith("toast-")
          ? toastId
          : null);

      if (targetAlertId && !state.dismissedAlertIds.includes(targetAlertId)) {
        state.dismissedAlertIds.push(targetAlertId);
        try {
          localStorage.setItem(
            "spiderweb_dismissed_alerts",
            JSON.stringify(state.dismissedAlertIds.slice(-200))
          );
        } catch {
          // Ignore localStorage error
        }
      }

      state.sidebarToasts = state.sidebarToasts.filter(
        (t) => t.id !== toastId && t.alertId !== toastId
      );
    },
    clearToasts: (state) => {
      state.sidebarToasts = [];
    },
    setIgnoreAlerts: (state, action) => {
      state.ignoreAlerts = Boolean(action.payload);
      try {
        localStorage.setItem("spiderweb_ignore_alerts", String(state.ignoreAlerts));
      } catch {
        // Ignore localStorage error
      }
      if (state.ignoreAlerts) {
        state.sidebarToasts = [];
      }
    },
    toggleIgnoreAlerts: (state) => {
      state.ignoreAlerts = !state.ignoreAlerts;
      try {
        localStorage.setItem("spiderweb_ignore_alerts", String(state.ignoreAlerts));
      } catch {
        // Ignore localStorage error
      }
      if (state.ignoreAlerts) {
        state.sidebarToasts = [];
      } else {
        // Populate toasts with current active errors/warnings up to 3 when unignoring,
        // excluding alerts that the user already closed/dismissed
        const dismissedSet = new Set(state.dismissedAlertIds || []);
        const activeToasts = state.items
          .filter(
            (a) =>
              (a.type === "error" || a.type === "warning") &&
              !dismissedSet.has(a.id)
          )
          .slice(0, 3)
          .map((a) => ({
            id: `toast-${a.id}-${Date.now()}`,
            alertId: a.id,
            canonicalKey: a.canonicalKey,
            type: a.type,
            message: a.message,
            networkLine: a.networkLine,
            source: a.source,
            timestamp: a.timestamp,
            timestampMs: a.timestampMs,
            createdAt: Date.now(),
            link: a.link,
            navigationTarget: a.navigationTarget,
          }));
        state.sidebarToasts = activeToasts;
      }
    },
    addToast: (state, action) => {
      const toast = action.payload;
      if (state.ignoreAlerts) return;
      if (toast?.alertId && state.dismissedAlertIds?.includes(toast.alertId)) return;
      if (toast && !state.sidebarToasts.some((t) => t.id === toast.id)) {
        state.sidebarToasts.push({
          ...toast,
          createdAt: toast.createdAt || Date.now(),
        });
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetching alerts
      .addCase(fetchAlerts.pending, (state, action) => {
        if (!action.meta.arg?.silent && state.items.length === 0) {
          state.status = "loading";
        }
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        const { alerts, period, silent } = action.payload;
        if (!silent) {
          state.status = "succeeded";
        }
        state.selectedPeriod = period;

        const prevItemsMap = new Map(state.items.map((i) => [i.id, i]));
        const seenIdsSet = new Set(state.seenAlertIds);

        // Find newly arrived alerts
        const newAlerts = [];
        alerts.forEach((alert) => {
          if (!seenIdsSet.has(alert.id)) {
            newAlerts.push(alert);
            seenIdsSet.add(alert.id);
          }
        });

        // Delta sync items: update to current active alerts, preserving isFavorite
        state.items = alerts.map((incoming) => {
          const existing = prevItemsMap.get(incoming.id);
          if (existing) {
            return {
              ...incoming,
              isFavorite: existing.isFavorite ?? false,
            };
          }
          return incoming;
        });

        state.seenAlertIds = Array.from(seenIdsSet);

        // Clear stale error toasts for lines that have returned to service
        const resolvedLines = new Set(
          alerts
            .filter((a) => a.type === "info" && a.canonicalKey)
            .map((a) => a.canonicalKey)
        );
        if (resolvedLines.size > 0) {
          state.sidebarToasts = state.sidebarToasts.filter(
            (t) => !(t.canonicalKey && resolvedLines.has(t.canonicalKey) && t.type === "error")
          );
        }

        // If ignoreAlerts is active, suppress toasts on initial load and incoming alerts
        if (state.ignoreAlerts) {
          state.hasInitialLoaded = true;
          return;
        }

        const dismissedSet = new Set(state.dismissedAlertIds || []);

        // Queue sidebar toasts for new alerts (or initial errors/warnings on first load)
        if (!state.hasInitialLoaded) {
          state.hasInitialLoaded = true;
          // On first load, queue initial error/warning alerts up to 3 that are not dismissed
          const initialToasts = alerts
            .filter(
              (a) =>
                (a.type === "error" || a.type === "warning") &&
                !dismissedSet.has(a.id)
            )
            .slice(0, 3)
            .map((a) => ({
              id: `toast-${a.id}-${Date.now()}`,
              alertId: a.id,
              canonicalKey: a.canonicalKey,
              type: a.type,
              message: a.message,
              networkLine: a.networkLine,
              source: a.source,
              timestamp: a.timestamp,
              timestampMs: a.timestampMs,
              createdAt: Date.now(),
              link: a.link,
              navigationTarget: a.navigationTarget,
            }));
          state.sidebarToasts.push(...initialToasts);
        } else if (newAlerts.length > 0) {
          const incomingToasts = newAlerts
            .filter((a) => !dismissedSet.has(a.id))
            .map((a) => ({
              id: `toast-${a.id}-${Date.now()}`,
              alertId: a.id,
              canonicalKey: a.canonicalKey,
              type: a.type,
              message: a.message,
              networkLine: a.networkLine,
              source: a.source,
              timestamp: a.timestamp,
              timestampMs: a.timestampMs,
              createdAt: Date.now(),
              link: a.link,
              navigationTarget: a.navigationTarget,
            }));
          state.sidebarToasts.push(...incomingToasts);
          // Keep toasts list bounded to prevent infinite growth
          if (state.sidebarToasts.length > 20) {
            state.sidebarToasts = state.sidebarToasts.slice(-20);
          }
        }
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      // Deleting an alert
      .addCase(deleteAlert.fulfilled, (state, action) => {
        const alertIdToRemove = action.payload;
        if (alertIdToRemove && !state.dismissedAlertIds.includes(alertIdToRemove)) {
          state.dismissedAlertIds.push(alertIdToRemove);
          try {
            localStorage.setItem(
              "spiderweb_dismissed_alerts",
              JSON.stringify(state.dismissedAlertIds.slice(-200))
            );
          } catch {
            // Ignore localStorage error
          }
        }
        state.items = state.items.filter(
          (alert) => alert.id !== alertIdToRemove
        );
        state.sidebarToasts = state.sidebarToasts.filter(
          (t) => t.alertId !== alertIdToRemove && t.id !== alertIdToRemove
        );
      })
      // Favoriting an alert
      .addCase(favoriteAlert.fulfilled, (state, action) => {
        const alertIdToFavorite = action.payload;
        const alert = state.items.find((a) => a.id === alertIdToFavorite);
        if (alert) {
          alert.isFavorite = !alert.isFavorite;
        }
      });
  },
});

export const {
  setSelectedPeriod,
  dismissToast,
  clearToasts,
  addToast,
  setIgnoreAlerts,
  toggleIgnoreAlerts,
} = alertsSlice.actions;

export const selectAllAlerts = (state) => state.alerts.items;
export const selectAlertsStatus = (state) => state.alerts.status;
export const selectAlertsError = (state) => state.alerts.error;
export const selectSelectedPeriod = (state) => state.alerts.selectedPeriod;
export const selectSidebarToasts = (state) => state.alerts.sidebarToasts;
export const selectIgnoreAlerts = (state) => state.alerts.ignoreAlerts;

export default alertsSlice.reducer;
