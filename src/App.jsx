// src/App.jsx

import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "./redux/store";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Import your components
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AppInitializer } from "./components/auth/AppInitializer";
import { usePreventSelectAll } from "./hooks/usePreventSelectAll";

function PageTitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let page = "Dashboard";

    if (path.startsWith("/admin")) {
      page = "Admin Panel";
    } else if (path.startsWith("/alerts") || path.startsWith("/notifications")) {
      page = "Alerts";
    } else if (path.startsWith("/login")) {
      page = "Login";
    } else {
      page = "Dashboard";
    }

    document.title = `Spiderweb | ${page}`;
  }, [location.pathname]);

  return null;
}

function App() {
  usePreventSelectAll();

  return (
    <Provider store={store}>
      <BrowserRouter>
        <PageTitleUpdater />
        <Routes>
          {/* Public Route: Anyone can access the login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes: Only accessible if logged in */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                {/* The AppInitializer now wraps the main layout */}
                <AppInitializer>
                  <AppLayout />
                </AppInitializer>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

export default App;
