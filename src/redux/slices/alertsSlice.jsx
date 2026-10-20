import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchAggregatedAlerts } from "../../services/alertsService";

// --- ASYNC THUNKS for Alerts ---
export const fetchAlerts = createAsyncThunk(
  "alerts/fetchAlerts",
  async (args = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const period = args.period || state.alerts.selectedPeriod || "24h";
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

const alertsSlice = createSlice({
  name: "alerts",
  initialState: {
    items: [],
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    selectedPeriod: "24h", // '24h' | '1w' | '2w' | '1m'
    sidebarToasts: [],
    seenAlertIds: [],
    hasInitialLoaded: false,
  },
  reducers: {
    setSelectedPeriod: (state, action) => {
      state.selectedPeriod = action.payload;
    },
    dismissToast: (state, action) => {
      const toastId = action.payload;
      state.sidebarToasts = state.sidebarToasts.filter(
        (t) => t.id !== toastId && t.alertId !== toastId
      );
    },
    clearToasts: (state) => {
      state.sidebarToasts = [];
    },
    addToast: (state, action) => {
      const toast = action.payload;
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

        // Queue sidebar toasts for new alerts (or initial errors/warnings on first load)
        if (!state.hasInitialLoaded) {
          state.hasInitialLoaded = true;
          // On first load, queue initial error/warning alerts up to 3
          const initialToasts = alerts
            .filter((a) => a.type === "error" || a.type === "warning")
            .slice(0, 3)
            .map((a) => ({
              id: `toast-${a.id}-${Date.now()}`,
              alertId: a.id,
              type: a.type,
              message: a.message,
              networkLine: a.networkLine,
              source: a.source,
              timestamp: a.timestamp,
              createdAt: Date.now(),
              link: a.link,
              navigationTarget: a.navigationTarget,
            }));
          state.sidebarToasts.push(...initialToasts);
        } else if (newAlerts.length > 0) {
          const incomingToasts = newAlerts.map((a) => ({
            id: `toast-${a.id}-${Date.now()}`,
            alertId: a.id,
            type: a.type,
            message: a.message,
            networkLine: a.networkLine,
            source: a.source,
            timestamp: a.timestamp,
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
} = alertsSlice.actions;

export const selectAllAlerts = (state) => state.alerts.items;
export const selectAlertsStatus = (state) => state.alerts.status;
export const selectAlertsError = (state) => state.alerts.error;
export const selectSelectedPeriod = (state) => state.alerts.selectedPeriod;
export const selectSidebarToasts = (state) => state.alerts.sidebarToasts;

export default alertsSlice.reducer;
