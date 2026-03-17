import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import {
  CAMPAIGN_STATUS,
  CAMPAIGN_STATUS_COLORS,
  DISASTER_COLORS,
  DISASTER_TYPES
} from "../../constants/index.js";

function fmtDayLabel(sec) {
  const n = Number(sec);
  if (!n) return null;
  const d = new Date(n * 1000);
  return d.toLocaleString(undefined, { month: "short", day: "2-digit" });
}

export default function DataVisuals({ contract }) {
  const [campaigns, setCampaigns] = useState([]);
  const [txs, setTxs] = useState([]);
  const [stats, setStats] = useState(null);

  const normalizeTx = (t) => ({
    id: Number(t?.id?.toString?.() ?? t?.id ?? 0),
    actor: t?.actor ?? "",
    actionType: t?.actionType ?? "",
    campaignId: Number(t?.campaignId?.toString?.() ?? t?.campaignId ?? 0),
    amount: t?.amount ?? 0n,
    timestamp: Number(t?.timestamp?.toString?.() ?? t?.timestamp ?? 0)
  });

  const loadCampaigns = async () => {
    if (!contract) return;
    try {
      const all = await contract.getAllCampaigns();
      setCampaigns(all);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load campaign data");
    }
  };

  const loadTx = async () => {
    if (!contract) return;
    try {
      const all = await contract.getAllTransactions();
      setTxs(all);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load transaction data");
    }
  };

  const loadStats = async () => {
    if (!contract) return;
    try {
      const s = await contract.getAllCampaignStats();
      setStats({
        totalBeneficiaries: Number(s[3]?.toString?.() || 0),
        totalRedeemed: Number(s[4]?.toString?.() || 0)
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCampaigns();
    loadTx();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract]);

  const campaignsByDisaster = useMemo(() => {
    const counts = new Map();
    for (const c of campaigns) {
      const name = DISASTER_TYPES[Number(c.disasterType)] || "Other";
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    const arr = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .filter((x) => x.count > 0);
    return arr;
  }, [campaigns]);

  const donationTimeData = useMemo(() => {
    const donations = Array.from(txs || [])
      .map(normalizeTx)
      .filter((t) => (t.actionType || "").toLowerCase().includes("donation"))
      .sort((a, b) => a.timestamp - b.timestamp);

    const byDay = new Map();
    for (const t of donations) {
      const ts = t.timestamp;
      if (!ts) continue;
      const d = new Date(ts * 1000);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const eth = Number(ethers.formatEther(t.amount));
      byDay.set(key, (byDay.get(key) || 0) + eth);
    }

    const keys = Array.from(byDay.keys()).sort((a, b) => (a < b ? -1 : 1));
    let running = 0;
    const out = [];
    for (const k of keys) {
      running += byDay.get(k) || 0;
      const anyTs = donations.find((t) => {
        const ts = t.timestamp;
        if (!ts) return false;
        const d = new Date(ts * 1000);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        return key === k;
      })?.timestamp;
      out.push({ date: fmtDayLabel(anyTs) || k, total: Number(running.toFixed(4)) });
    }
    return out;
  }, [txs]);

  const statusDist = useMemo(() => {
    const counts = new Map();
    for (const c of campaigns) {
      const label = CAMPAIGN_STATUS[Number(c.status)] || "Unknown";
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    const total = campaigns.length || 1;
    return Array.from(counts.entries()).map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
      color: CAMPAIGN_STATUS_COLORS[label] || "#888780"
    }));
  }, [campaigns]);

  const redemptionOverview = useMemo(() => {
    const totalBeneficiaries = stats?.totalBeneficiaries ?? 0;
    const totalRedeemed = stats?.totalRedeemed ?? 0;
    const pct = totalBeneficiaries > 0 ? Math.round((totalRedeemed / totalBeneficiaries) * 100) : 0;
    const color = pct > 60 ? "var(--green)" : pct >= 30 ? "var(--amber)" : "var(--red)";
    return { totalBeneficiaries, totalRedeemed, pct, color };
  }, [stats]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      <div className="dash-card" style={{ marginBottom: 0 }}>
        <div className="dash-card-header">
          <div className="dash-card-title">Campaigns by Disaster Type</div>
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={campaignsByDisaster}>
              <XAxis dataKey="name" tick={{ fill: "#9a9a9a", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9a9a9a", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid rgba(255,255,255,0.1)"
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {campaignsByDisaster.map((entry, i) => (
                  <Cell key={i} fill={DISASTER_COLORS[entry.name] || "#888"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dash-card" style={{ marginBottom: 0 }}>
        <div className="dash-card-header">
          <div className="dash-card-title">Cumulative Donations Over Time</div>
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={donationTimeData}>
              <XAxis dataKey="date" tick={{ fill: "#9a9a9a", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9a9a9a", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid rgba(255,255,255,0.1)"
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#1D9E75"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dash-card" style={{ marginBottom: 0 }}>
        <div className="dash-card-header">
          <div className="dash-card-title">Campaign Status Distribution</div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {statusDist.map((s) => (
            <div key={s.label} style={{ display: "grid", gridTemplateColumns: "140px 1fr 44px", gap: 10, alignItems: "center" }}>
              <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{s.label}</div>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden", height: 10 }}>
                <div style={{ width: `${s.pct}%`, height: "100%", background: s.color }} />
              </div>
              <div style={{ color: "var(--text-primary)", fontSize: 12, textAlign: "right" }}>
                {s.count}
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No campaigns yet.</div>
          )}
        </div>
      </div>

      <div className="dash-card" style={{ marginBottom: 0 }}>
        <div className="dash-card-header">
          <div className="dash-card-title">Redemption Overview</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Total Beneficiaries</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: "var(--text-primary)" }}>
              {redemptionOverview.totalBeneficiaries}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Redeemed %</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: redemptionOverview.color }}>
              {redemptionOverview.pct}%
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Total Redeemed</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: "var(--text-primary)" }}>
              {redemptionOverview.totalRedeemed}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

