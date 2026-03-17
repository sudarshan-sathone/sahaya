import { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  CAMPAIGN_STATUS,
  CAMPAIGN_STATUS_COLORS,
  DISASTER_TYPES,
  DISASTER_COLORS,
  INACTIVE_DAYS
} from "../constants/index.js";

export default function AdminDashboard({ contract }) {
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    if (!contract) {
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const [
        summary,
        allCampaigns,
        contractBalanceRaw
      ] = await Promise.all([
        contract.getAllCampaignStats(),
        contract.getAllCampaigns(),
        contract.getContractBalance()
      ]);

      const [
        totalCampaigns,
        activeCampaigns,
        totalRaised,
        totalBeneficiaries,
        totalRedeemed
      ] = summary;

      setStats({
        totalCampaigns: Number(totalCampaigns),
        activeCampaigns: Number(activeCampaigns),
        totalRaised: ethers.formatEther(totalRaised),
        totalBeneficiaries: Number(totalBeneficiaries),
        totalRedeemed: Number(totalRedeemed),
        contractBalance: ethers.formatEther(contractBalanceRaw)
      });

      setCampaigns(allCampaigns);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [contract]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, contract]);

  const handleFlagInactive = async (id) => {
    if (!contract) return;
    try {
      setLoading(true);
      const tx = await contract.flagInactiveCampaign(id);
      await tx.wait();
      await fetchData();
    } catch (e) {
      alert(e.message || "Failed to flag campaign");
    } finally {
      setLoading(false);
    }
  };

  const nowSec = Math.floor(Date.now() / 1000);

  return (
    <section className="card">
      <div className="card-header">
        <h2>Admin Dashboard</h2>
        <button
          className="secondary-button"
          onClick={() => setAutoRefresh((v) => !v)}
        >
          Auto-refresh: {autoRefresh ? "On" : "Off"}
        </button>
      </div>

      {!contract && (
        <div className="alert alert-warning">
          Connect wallet as admin to view stats.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Campaigns</div>
            <div className="stat-value">{stats.totalCampaigns}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Campaigns</div>
            <div className="stat-value">{stats.activeCampaigns}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Raised (ETH)</div>
            <div className="stat-value">{stats.totalRaised}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Beneficiaries</div>
            <div className="stat-value">{stats.totalBeneficiaries}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Redeemed</div>
            <div className="stat-value">{stats.totalRedeemed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Contract Balance (ETH)</div>
            <div className="stat-value">{stats.contractBalance}</div>
          </div>
        </div>
      )}

      <h3 className="section-title">Campaign Health</h3>
      <div className="campaign-list">
        {campaigns.map((c) => {
          const id = Number(c.id);
          const statusIndex = Number(c.status);
          const status = CAMPAIGN_STATUS[statusIndex] || "Unknown";
          const statusColor = CAMPAIGN_STATUS_COLORS[status] || "#888";
          const disaster =
            DISASTER_TYPES[Number(c.disasterType)] || "Unknown";
          const disasterColor = DISASTER_COLORS[disaster] || "#888";
          const target = Number(ethers.formatEther(c.targetAmount));
          const raised = Number(ethers.formatEther(c.raisedAmount));
          const pct =
            target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
          const lastActivity = Number(c.lastActivityAt);
          const daysSince =
            lastActivity > 0
              ? Math.floor((nowSec - lastActivity) / (24 * 60 * 60))
              : 0;
          const canFlag =
            status === "Active" && daysSince > INACTIVE_DAYS;

          return (
            <div key={id} className="campaign-card">
              <div className="campaign-header">
                <div>
                  <div className="campaign-name">
                    #{id} {c.name}
                  </div>
                  <div className="badge-row">
                    <span
                      className="pill"
                      style={{ backgroundColor: disasterColor }}
                    >
                      {disaster}
                    </span>
                    <span
                      className="pill"
                      style={{ backgroundColor: statusColor }}
                    >
                      {status}
                    </span>
                  </div>
                </div>
                <div className="campaign-meta">
                  <div>
                    {raised.toFixed(2)} / {target.toFixed(2)} ETH
                  </div>
                  <div>
                    Beneficiaries: {Number(c.beneficiaryCount)} | Redeemed:{" "}
                    {Number(c.redeemedCount)}
                  </div>
                  <div>
                    Last activity:{" "}
                    {lastActivity
                      ? new Date(lastActivity * 1000).toLocaleString()
                      : "N/A"}{" "}
                    ({daysSince} days ago)
                  </div>
                </div>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {daysSince > INACTIVE_DAYS && (
                <div className="alert alert-warning small">
                  No activity for {daysSince} days.
                </div>
              )}

              {canFlag && (
                <button
                  className="danger-button"
                  disabled={loading}
                  onClick={() => handleFlagInactive(id)}
                >
                  {loading ? "Processing..." : "Flag Inactive Campaign"}
                </button>
              )}
            </div>
          );
        })}
        {campaigns.length === 0 && (
          <div className="muted-text">No campaigns created yet.</div>
        )}
      </div>
    </section>
  );
}

