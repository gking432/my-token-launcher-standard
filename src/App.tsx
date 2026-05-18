import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";

import HomePage from "./components/HomePage";
import Marketplace from "./components/Marketplace";
import Profile from "./components/Profile";

import NEWtokenpage from "./components/NEWtokenpage";
import NEWLaunch from "./components/NEWLaunch";
import Boost from "./components/Boost";
import About from "./components/About";
import NotFound from "./components/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { GraduationListener } from "./components/GraduationListener";
import { BalanceProvider } from "./contexts/BalanceContext";
import { AptPriceProvider } from "./contexts/AptPriceContext";
import { WatchlistProvider } from "./contexts/WatchlistContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./styles/Landing.css";

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AptosWalletAdapterProvider
        autoConnect={true}
        dappConfig={{ network: Network.TESTNET }}
        optInWallets={["Petra"]}
        onError={(error: Error) => { console.log('Wallet Connection Error:', error); }}>
        <AptPriceProvider>
          <BalanceProvider>
            <WatchlistProvider>
              <GraduationListener />
              <Router>
                <Routes>
                  <Route path="/"                  element={<HomePage />} />
                  <Route path="/homepage"          element={<HomePage />} />
                  <Route path="/marketplace"       element={<Marketplace />} />
                  <Route path="/marketplace/:metadataAddress" element={<Marketplace />} />
                  <Route path="/boost"             element={<Boost />} />
                  <Route path="/about"             element={<About />} />
                  <Route path="/tokenpage"         element={<NEWtokenpage />} />
                  <Route path="/launchpage"        element={<NEWLaunch />} />
                  <Route path="/launch"            element={<NEWLaunch />} />
                  <Route path="/profile"           element={<Profile />} />
                  <Route path="/profile/:address"  element={<Profile />} />
                  <Route path="/token/:coinHash"   element={<ErrorBoundary><NEWtokenpage /></ErrorBoundary>} />
                  <Route path="/newtoken/:coinHash" element={<ErrorBoundary><NEWtokenpage /></ErrorBoundary>} />
                  <Route path="*"                  element={<NotFound />} />
                </Routes>
              </Router>
            </WatchlistProvider>
          </BalanceProvider>
        </AptPriceProvider>
      </AptosWalletAdapterProvider>
    </ThemeProvider>
  );
};

export default App;
