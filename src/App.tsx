import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PetraWallet } from "petra-plugin-wallet-adapter";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import { AvailableWallets } from "@aptos-labs/wallet-adapter-core";
import Layout from "./components/Layout";
import LandingPage from "./components/LandingPage";
import Profile from "./components/Profile";
import Launch from "./components/Launch";
import TokenPage from "./components/TokenPage";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles/Landing.css";

const App: React.FC = () => {
  return (
    <AptosWalletAdapterProvider 
      autoConnect={true}
      dappConfig={{ network: Network.DEVNET }}
      optInWallets={["Petra", "Fewcha", "Rise"] as AvailableWallets[]}
      onError={(error: Error) => {
        console.log('Wallet Connection Error:', error);
      }}>
      <Router>
        <Routes>
          <Route path="/" element={
            <Layout>
              <LandingPage />
            </Layout>
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
            <Layout>
              <Launch />
            </Layout>
          } />
          <Route path="/token/:coinHash" element={
            <Layout>
              <ErrorBoundary>
                <TokenPage />
              </ErrorBoundary>
            </Layout>
          } />
          <Route path="*" element={
            <Layout>
              <div>404 - Page Not Found</div>
            </Layout>
          } />
        </Routes>
      </Router>
    </AptosWalletAdapterProvider>
  );
};

export default App;