import { useState, useEffect } from "react";
import { useContract } from "./hooks/useContract.js";
import AdminDashboard from "./components/AdminDashboard.jsx";
import CampaignManager from "./components/CampaignManager.jsx";
import NGOManager from "./components/NGOManager.jsx";
import BeneficiaryManager from "./components/BeneficiaryManager.jsx";
import TransactionMonitor from "./components/TransactionMonitor.jsx";
import DonorTab from "./components/DonorTab.jsx";
import NGOWorkerTab from "./components/NGOWorkerTab.jsx";
import VendorTab from "./components/VendorTab.jsx";
import TransparencyTab from "./components/TransparencyTab.jsx";
import CollapsibleSection from "./components/CollapsibleSection.jsx";

const TABS = ["Admin", "Donor", "NGO Worker", "Vendor", "Transparency"];

export default function App() {
  const [activeTab, setActiveTab] = useState("Admin");
  const { account, contract, network, connectWallet, error, loading } =
    useContract();

  useEffect(() => {
    // Optional: auto-connect if already authorized
  }, []);

  const truncatedAccount =
    account && `${account.slice(0, 6)}...${account.slice(-4)}`;

  let networkClass = "badge-grey";
  if (network === "Local Hardhat") networkClass = "badge-green";
  else if (network === "Sepolia") networkClass = "badge-blue";
  else if (network === "Unknown Network") networkClass = "badge-red";

  const showNetworkWarning =
    network && network !== "Local Hardhat" && network !== "Sepolia";

  return (
    <div className="app-root">
      <header className="app-header">
        <div>
          <h1 className="app-title">AidChain</h1>
          <p className="app-subtitle">
            Disaster relief on-chain — transparent, accountable, fast.
          </p>
        </div>
        <div className="header-right">
          {network && <span className={`network-badge ${networkClass}`}>{network}</span>}
          <button
            className="primary-button"
            onClick={connectWallet}
            disabled={loading}
          >
            {loading
              ? "Connecting..."
              : account
              ? `Connected: ${truncatedAccount}`
              : "Connect Wallet"}
          </button>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {showNetworkWarning && (
        <div className="alert alert-warning">
          Please switch to Local Hardhat or Sepolia in MetaMask.
        </div>
      )}

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab-button ${
              activeTab === tab ? "tab-button-active" : ""
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {activeTab === "Admin" && (
          <>
            <CollapsibleSection
              title="Admin Dashboard"
              subtitle="Live stats + campaign health"
              defaultOpen={true}
            >
              <AdminDashboard contract={contract} account={account} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Campaign Management"
              subtitle="Create, verify, and close campaigns"
            >
              <CampaignManager contract={contract} account={account} />
            </CollapsibleSection>

            <CollapsibleSection
              title="NGO Management"
              subtitle="Register, activate/suspend, and monitor NGOs"
            >
              <NGOManager contract={contract} account={account} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Beneficiary + OTP"
              subtitle="Register, approve, issue OTP, whitelist vendor"
            >
              <BeneficiaryManager contract={contract} account={account} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Transaction Monitor"
              subtitle="Auto-refresh monitoring + suspicious flags"
            >
              <TransactionMonitor contract={contract} account={account} />
            </CollapsibleSection>
          </>
        )}
        {activeTab === "Donor" && (
          <DonorTab contract={contract} account={account} />
        )}
        {activeTab === "NGO Worker" && (
          <NGOWorkerTab contract={contract} account={account} />
        )}
        {activeTab === "Vendor" && (
          <VendorTab contract={contract} account={account} />
        )}
        {activeTab === "Transparency" && (
          <TransparencyTab contract={contract} account={account} />
        )}
      </main>
    </div>
  );
}

