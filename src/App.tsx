import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PetraWallet } from "petra-plugin-wallet-adapter";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import { AvailableWallets } from "@aptos-labs/wallet-adapter-core";
import Layout from "./components/Layout";
import LandingPage from "./components/LandingPage";
import HomePage from "./components/HomePage";
import Marketplace from "./components/Marketplace";
import Profile from "./components/Profile";
import Launch from "./components/Launch";
import TokenPage from "./components/TokenPage";
import NEWtokenpage from "./components/NEWtokenpage";
import NEWLaunch from "./components/NEWLaunch";
import Boost from "./components/Boost";
import ErrorBoundary from "./components/ErrorBoundary";
import { GraduationListener } from "./components/GraduationListener";
import { BalanceProvider } from "./contexts/BalanceContext";
import "./styles/Landing.css";

// Placeholder components for missing routes
const Trending: React.FC = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <h1>Trending</h1>
    <p>Trending tokens and market movements will be displayed here.</p>
  </div>
);

const Communities: React.FC = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <h1>Communities</h1>
    <p>Token communities and social features will be displayed here.</p>
  </div>
);

const About: React.FC = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <h1>About</h1>
    <p>Information about MoveMint and the platform will be displayed here.</p>
  </div>
);

const App: React.FC = () => {
  return (
    <AptosWalletAdapterProvider 
      autoConnect={true}
      dappConfig={{ network: Network.DEVNET }}
      optInWallets={["Petra", "Fewcha", "Rise"] as AvailableWallets[]}
      onError={(error: Error) => {
        console.log('Wallet Connection Error:', error);
      }}>
      <BalanceProvider>
        <GraduationListener />
        <Router>
          <Routes>
          <Route path="/" element={
            <Layout>
              <LandingPage />
            </Layout>
          } />
          <Route path="/homepage" element={
            <HomePage />
          } />
          <Route path="/marketplace" element={
            <Marketplace />
          } />
          <Route path="/marketplace/:metadataAddress" element={
            <Marketplace />
          } />
          <Route path="/boost" element={
            <Boost />
          } />
          <Route path="/trending" element={
            <Trending />
          } />
          <Route path="/communities" element={
            <Communities />
          } />
          <Route path="/about" element={
            <About />
          } />
          <Route path="/tokenpage" element={
            <TokenPage />
          } />
          <Route path="/launchpage" element={
            <NEWLaunch />
          } />
          <Route path="/profile" element={
            <Layout>
              <Profile />
            </Layout>
          } />
          <Route path="/profile/:address" element={
            <Layout>
              <Profile />
            </Layout>
          } />
          <Route path="/launch" element={
            <NEWLaunch />
          } />
          <Route path="/token/:coinHash" element={
            <Layout>
              <ErrorBoundary>
                <TokenPage />
              </ErrorBoundary>
            </Layout>
          } />
          <Route path="/newtoken/:coinHash" element={
            <ErrorBoundary>
              <NEWtokenpage />
            </ErrorBoundary>
          } />
          <Route path="*" element={
            <Layout>
              <div>404 - Page Not Found</div>
            </Layout>
          } />
                  </Routes>
        </Router>
        </BalanceProvider>
      </AptosWalletAdapterProvider>
    );
  };

export default App;