import { updateTenGigLink } from "../redux/slices/tenGigLinksSlice";
import { connectionEstablished } from "../redux/slices/realtimeSlice";

// This service simulates a persistent connection to a server.
const realtimeService = {
  intervalId: null,

  /**
   * Starts the mock real-time update service.
   * @param {function} dispatch - The Redux store's dispatch function.
   * @param {function} getState - The Redux store's getState function.
   */
  start(dispatch, getState) {
    // Prevent multiple intervals from running
    if (this.intervalId) {
      this.stop();
    }

    // Immediately dispatch that the connection is live.
    dispatch(connectionEstablished());

    this.intervalId = setInterval(() => {
      const { items: allLinks } = getState().tenGigLinks;

      if (allLinks && allLinks.length > 0) {
        // 1. Pick a random link to update
        const randomLink =
          allLinks[Math.floor(Math.random() * allLinks.length)];

        // 2. Determine a new status for it
        const statuses = ["up", "down", "issue"];
        const currentStatusIndex = statuses.indexOf(randomLink.status);
        const nextStatus = statuses[(currentStatusIndex + 1) % statuses.length]; // Cycle through statuses

        // 3. Create the payload for the update action
        const updatePayload = {
          id: randomLink.id,
          status: nextStatus,
          statusChangedAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        };

        // 4. Dispatch a standard Redux action, as if this came from a WebSocket.
        // The middleware has passed the store's dispatch function to this service.
        dispatch(updateTenGigLink(updatePayload));
      }
    }, 3500); // Fire an update every 3.5 seconds
  },

  /**
   * Stops the real-time update service.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },
};

export default realtimeService;

/*
const realtimeService = {
  socket: null,
  reconnectInterval: 5000, // Try to reconnect every 5 seconds


   //Starts the real-time WebSocket connection.
   //@param {function} dispatch - The Redux store's dispatch function.
   //@param {function} getState - The Redux store's getState function.
   
  start(dispatch, getState) {
    // Prevent multiple connections
    if (this.socket && this.socket.readyState < 2) {
      console.log("[RealtimeService] Connection already open or connecting.");
      return;
    }

    // Configure the WebSocket URL. Use wss for secure connections.
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const API_BASE_URL = import.meta.env.VITE_API_URL || "localhost:8000";
    const wsUrl = `${protocol}//${API_BASE_URL.replace(/https?:\/\//, '')}/ws/updates`;
    
    console.log(`[RealtimeService] Connecting to ${wsUrl}...`);
    this.socket = new WebSocket(wsUrl);

    // --- Event Listeners for the WebSocket ---

    // 1. On successfully opening a connection
    this.socket.onopen = () => {
      console.log("[RealtimeService] WebSocket connection established.");
      // Dispatch the action to update the slice's status to 'connected'
      dispatch(connectionEstablished());
    };

    // 2. On receiving a message from the server
    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("[RealtimeService] Received message:", message);

        // Here, you would check the message type and dispatch the correct action.
        // For this example, we assume all messages are link status updates.
        // A real implementation might have a switch statement: switch(message.type)
        if (message.type === 'link_update' && message.payload) {
          // The payload should match the expected format for the updateTenGigLink action
          // e.g., { id: 'link-10g-xyz', status: 'down' }
          dispatch(updateTenGigLink(message.payload));
        } else if (message.type === 'new_alert' && message.payload) {
          // You could even have real-time alerts!
          // dispatch(addNewAlert(message.payload));
        }

      } catch (error) {
        console.error("[RealtimeService] Error parsing message:", error);
      }
    };

    // 3. On the connection closing
    this.socket.onclose = () => {
      console.log("[RealtimeService] WebSocket connection closed.");
      // Update the slice's status to 'disconnected'
      dispatch(disconnect());

      // Optional: Attempt to reconnect after a delay
      setTimeout(() => {
          console.log("[RealtimeService] Attempting to reconnect...");
          this.start(dispatch, getState); // Recursively call start to reconnect
      }, this.reconnectInterval);
    };

    // 4. On a connection error
    this.socket.onerror = (error) => {
      console.error("[RealtimeService] WebSocket error:", error);
      // The `onclose` event will usually fire immediately after an error.
      this.socket.close();
    };
  },


   //Gracefully closes the WebSocket connection.
   
  stop() {
    if (this.socket) {
      // Set reconnect interval to a very high number to prevent auto-reconnect on manual stop
      this.reconnectInterval = 1e9;
      this.socket.close();
      this.socket = null;
      console.log("[RealtimeService] Stopped and closed WebSocket connection.");
    }
  },
};*/
