import { useState } from "react";
import StatsBar from "./StatsBar.jsx";
import CampaignControl from "./CampaignControl.jsx";
import NGORegulator from "./NGORegulator.jsx";
import TransactionMonitor from "./TransactionMonitor.jsx";
import DataVisuals from "./DataVisuals.jsx";

function truncate(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function AdminDashboard({ contract, account, network }) {
  const [tab, setTab] = useState("Overview");

  return (
    <div className="dashboard-shell">
      <div className="dash-header">
        <div>
          <h2 className="dash-title">Admin Control Center</h2>
          <div className="dash-subtitle">AidChain Relief Management</div>
        </div>
        <div className="dash-badges">
          <span className="badge badge-gray">Wallet {truncate(account)}</span>
          <span
            className={
              network === "Local Hardhat"
                ? "badge badge-green"
                : network === "Sepolia"
                ? "badge badge-blue"
                : "badge badge-red"
            }
          >
            {network || "Unknown"}
          </span>
        </div>
      </div>

      <div className="dash-internal-tabs">
        {["Overview", "Campaigns", "NGOs", "Transactions"].map((t) => (
          <button
            key={t}
            type="button"
            className={`dash-internal-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <>
          <StatsBar contract={contract} />
          <DataVisuals contract={contract} />
        </>
      )}

      {tab === "Campaigns" && <CampaignControl contract={contract} account={account} />}

      {tab === "NGOs" && <NGORegulator contract={contract} account={account} />}

      {tab === "Transactions" && (
        <TransactionMonitor contract={contract} account={account} />
      )}
    </div>
  );
}

