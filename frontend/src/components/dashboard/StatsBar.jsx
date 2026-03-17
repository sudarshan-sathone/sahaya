import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

function rateColor(rate) {
  if (rate > 60) return "var(--green)";
  if (rate >= 30) return "var(--amber)";
  return "var(--red)";
}

export default function StatsBar({ contract }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchStats = async () => {
    if (!contract) return;
    try {
      setError(null);
      const [stats, balance] = await Promise.all([
        contract.getAllCampaignStats(),
        contract.getContractBalance()
      ]);

      const [
        totalCampaigns,
        activeCampaigns,
        totalRaised,
        totalBeneficiaries,
        totalRedeemed
      ] = stats;

      setData({
        totalCampaigns: Number(totalCampaigns),
        activeCampaigns: Number(activeCampaigns),
        totalRaised,
        totalBeneficiaries: Number(totalBeneficiaries),
        totalRedeemed: Number(totalRedeemed),
        balance
      });
      setLastRefreshed(new Date());
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStats();
    if (!contract) return;
    const id = setInterval(fetchStats, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract]);

  const redemptionRate = useMemo(() => {
    if (!data) return { label: "0%", rate: 0 };
    if (data.totalBeneficiaries === 0) return { label: "0%", rate: 0 };
    const rate = Math.round(
      (data.totalRedeemed / data.totalBeneficiaries) * 100
    );
    return { label: `${rate}%`, rate };
  }, [data]);

  if (!contract) {
    return (
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-label">Connect Wallet</div>
          <div className="stat-value">—</div>
          <div className="stat-sub">Connect to view stats</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="stats-bar">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton" style={{ width: 110, height: 12 }} />
            <div
              className="skeleton"
              style={{ width: "60%", height: 26, marginTop: 12 }}
            />
            <div
              className="skeleton"
              style={{ width: "80%", height: 12, marginTop: 10 }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="stats-bar">
      {error && (
        <div className="alert-card alert-card-amber" style={{ width: "100%" }}>
          <div>
            <div className="alert-title">Stats unavailable</div>
            <div className="alert-desc">{error}</div>
          </div>
        </div>
      )}

      <div className="stat-card">
        <div className="stat-label">Contract Balance</div>
        <div className="stat-value">
          {data ? `${ethers.formatEther(data.balance)} ETH` : "—"}
        </div>
        <div className="stat-sub">Funds held in contract</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Campaigns</div>
        <div className="stat-value">{data ? data.totalCampaigns : "—"}</div>
        <div className="stat-sub">{data ? `${data.activeCampaigns} active` : ""}</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Total Raised</div>
        <div className="stat-value">
          {data ? `${ethers.formatEther(data.totalRaised)} ETH` : "—"}
        </div>
        <div className="stat-sub">Across all campaigns</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Beneficiaries</div>
        <div className="stat-value">
          {data ? data.totalBeneficiaries : "—"}
        </div>
        <div className="stat-sub">
          {data ? `${data.totalRedeemed} redeemed` : ""}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Redemption Rate</div>
        <div
          className="stat-value"
          style={{ color: rateColor(redemptionRate.rate) }}
        >
          {redemptionRate.label}
        </div>
        <div className="stat-sub">Overall success rate</div>
      </div>

      <div className="stats-refreshed">
        {lastRefreshed ? `Refreshed: ${lastRefreshed.toLocaleTimeString()}` : ""}
      </div>
    </div>
  );
}

