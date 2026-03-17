import StatsBar from "./StatsBar.jsx";
import CampaignControl from "./CampaignControl.jsx";
import NGORegulator from "./NGORegulator.jsx";
import TransactionMonitor from "./TransactionMonitor.jsx";

function truncate(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function AdminDashboard({ contract, account, network }) {
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

      <StatsBar contract={contract} />

      <div className="dash-two-col">
        <div>
          <CampaignControl contract={contract} account={account} />
        </div>
        <div>
          <NGORegulator contract={contract} account={account} />
        </div>
      </div>

      <TransactionMonitor contract={contract} account={account} />
    </div>
  );
}

