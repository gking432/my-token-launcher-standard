import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./MoveMint.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LandingPage from "./components/LandingPage";
import Profile from "./components/Profile";
import Launch from "./components/Launch";
import TokenPage from "./components/TokenPage";
import ErrorBoundary from "./components/ErrorBoundary"; // Import ErrorBoundary

function App() {
  return (
    <Router>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/launch" element={<Launch />} />
          <Route
            path="/token/:coinHash"
            element={
              <ErrorBoundary>
                <TokenPage />
              </ErrorBoundary>
            }
          />
          <Route path="*" element={<div>404 - Page Not Found</div>} />
        </Routes>
      </main>
      <Footer />
    </Router>
  );
}

export default App;