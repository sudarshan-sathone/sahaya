import { useEffect, useMemo, useState } from "react";
import { NGO_STATUS } from "../../constants/index.js";

function truncate(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function rateInfo(registered, redeemed) {
  const reg = Number(registered);
  const red = Number(redeemed);
  const rate = reg > 0 ? Math.round((red / reg) * 100) : 0;
  let cls = "badge badge-red";
  let dot = "score-dot score-red";
  if (rate > 60) {
    cls = "badge badge-green";
    dot = "score-dot score-green";
  } else if (rate >= 30) {
    cls = "badge badge-amber";
    dot = "score-dot score-amber";
  }
  return { rate, cls, dot };
}

function statusBadge(statusIdx) {
  const s = NGO_STATUS[statusIdx] || "Unknown";
  if (s === "Active") return { label: s, cls: "badge badge-green" };
  if (s === "Pending") return { label: s, cls: "badge badge-amber" };
  if (s === "Suspended") return { label: s, cls: "badge badge-red" };
  return { label: s, cls: "badge badge-gray" };
}

export default function NGORegulator({ contract }) {
  const [registerForm, setRegisterForm] = useState({
    wallet: "",
    name: "",
    registrationNumber: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [ngos, setNgos] = useState([]);
  const [statusLoading, setStatusLoading] = useState({});

  const load = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const count = await contract.ngoCount();
      const total = Number(count);
      const list = [];
      for (let i = 1; i <= total; i++) {
        const ngo = await contract.ngoById(i);
        if (ngo.exists) {
          const activity = await contract.getNGOActivity(ngo.wallet);
          list.push({ ngo, activity });
        }
      }
      setNgos(list);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load NGOs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract]);

  const onRegister = async (e) => {
    e.preventDefault();
    if (!contract) return;
    try {
      setError(null);
      setSuccess(null);
      const tx = await contract.registerNGO(
        registerForm.wallet,
        registerForm.name,
        registerForm.registrationNumber
      );
      const receipt = await tx.wait();
      setSuccess(`NGO registered. Tx ${receipt.hash.slice(0, 10)}...`);
      setRegisterForm({ wallet: "", name: "", registrationNumber: "" });
      await load();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to register NGO");
    }
  };

  const updateStatus = async (wallet, status) => {
    if (!contract) return;
    try {
      setStatusLoading((m) => ({ ...m, [wallet]: true }));
      setError(null);
      const tx = await contract.updateNGOStatus(wallet, status);
      await tx.wait();
      await load();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to update NGO status");
    } finally {
      setStatusLoading((m) => ({ ...m, [wallet]: false }));
    }
  };

  const alerts = useMemo(() => {
    const res = [];
    for (const row of ngos) {
      const activity = row.activity;
      const registered = Number(activity[0]);
      const redeemed = Number(activity[2]);
      const statusIdx = Number(activity[3]);
      const { rate } = rateInfo(registered, redeemed);

      if (registered > 5 && rate < 20) {
        res.push({
          type: "red",
          title: `${row.ngo.name} suspicious redemption rate`,
          desc: `${row.ngo.name} has registered ${registered} victims but only ${rate}% redeemed. Possible fraudulent registrations. Consider suspending.`,
          wallet: row.ngo.wallet,
          action: "Suspend Now"
        });
      }

      if (statusIdx === 1 && registered === 0) {
        // contract doesn't expose NGO registeredAt in getNGOActivity; use NGO.registeredAt from ngo struct
        const registeredAt = Number(row.ngo.registeredAt);
        const nowSec = Math.floor(Date.now() / 1000);
        const days = registeredAt
          ? Math.floor((nowSec - registeredAt) / (24 * 60 * 60))
          : 0;
        if (days > 5) {
          res.push({
            type: "amber",
            title: `${row.ngo.name} has no registrations`,
            desc: `${row.ngo.name} has been active for 5+ days but registered no victims.`,
            wallet: row.ngo.wallet,
            action: null
          });
        }
      }
    }
    return res;
  }, [ngos]);

  const alertCount = alerts.filter((a) => a.type !== "green").length;

  return (
    <>
      <div className="dash-card">
        <div className="dash-card-header">
          <div className="dash-card-title">Register NGO</div>
          <button className="dash-card-action" onClick={load}>
            Refresh
          </button>
        </div>

        {error && (
          <div className="alert-card alert-card-amber">
            <div>
              <div className="alert-title">Action error</div>
              <div className="alert-desc">{error}</div>
            </div>
          </div>
        )}
        {success && (
          <div className="alert-card alert-card-green">
            <div>
              <div className="alert-title">Success</div>
              <div className="alert-desc">{success}</div>
            </div>
          </div>
        )}

        <form
          onSubmit={onRegister}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10 }}
        >
          <input
            value={registerForm.wallet}
            onChange={(e) =>
              setRegisterForm((f) => ({ ...f, wallet: e.target.value }))
            }
            placeholder="Wallet address"
            required
          />
          <input
            value={registerForm.name}
            onChange={(e) =>
              setRegisterForm((f) => ({ ...f, name: e.target.value }))
            }
            placeholder="NGO name"
            required
          />
          <input
            value={registerForm.registrationNumber}
            onChange={(e) =>
              setRegisterForm((f) => ({
                ...f,
                registrationNumber: e.target.value
              }))
            }
            placeholder="Registration number"
            required
          />
          <button className="btn-sm btn-primary" type="submit">
            Register
          </button>
        </form>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <div className="dash-card-title">NGO Regulatory Monitor</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {alertCount > 0 && (
              <span className="badge badge-red">{alertCount} alerts</span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 240 }} />
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>NGO Name</th>
                  <th>Reg. No.</th>
                  <th>Wallet</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Approved</th>
                  <th>Redeemed</th>
                  <th>Rate</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ngos.map(({ ngo, activity }) => {
                  const registered = Number(activity[0]);
                  const approved = Number(activity[1]);
                  const redeemed = Number(activity[2]);
                  const statusIdx = Number(activity[3]);
                  const st = statusBadge(statusIdx);
                  const { rate, cls, dot } = rateInfo(registered, redeemed);
                  const busy = !!statusLoading[ngo.wallet];

                  return (
                    <tr key={ngo.wallet}>
                      <td className="td-primary">{ngo.name}</td>
                      <td>{ngo.registrationNumber}</td>
                      <td>{truncate(ngo.wallet)}</td>
                      <td>
                        <span className={st.cls}>{st.label}</span>
                      </td>
                      <td>{registered}</td>
                      <td>{approved}</td>
                      <td>{redeemed}</td>
                      <td>
                        <span className={cls}>{rate}%</span>
                      </td>
                      <td>
                        <span className={dot} />
                        <span style={{ color: "var(--text-secondary)" }}>
                          {rate > 60 ? "Good" : rate >= 30 ? "Watch" : "Low"}
                        </span>
                      </td>
                      <td>
                        {statusIdx === 0 && (
                          <button
                            className="btn-sm btn-success"
                            disabled={busy}
                            onClick={() => updateStatus(ngo.wallet, 1)}
                          >
                            Activate
                          </button>
                        )}{" "}
                        {statusIdx === 1 && (
                          <button
                            className="btn-sm btn-danger"
                            disabled={busy}
                            onClick={() => updateStatus(ngo.wallet, 2)}
                          >
                            Suspend
                          </button>
                        )}{" "}
                        {statusIdx === 2 && (
                          <button
                            className="btn-sm btn-warning"
                            disabled={busy}
                            onClick={() => updateStatus(ngo.wallet, 1)}
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {ngos.length === 0 && (
                  <tr>
                    <td colSpan="10" style={{ color: "var(--text-muted)" }}>
                      No NGOs registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <div className="dash-card-title">Suspicious NGO Alerts</div>
        </div>

        {alerts.length === 0 ? (
          <div className="alert-card alert-card-green">
            <div>
              <div className="alert-title">All clear</div>
              <div className="alert-desc">
                All NGOs within normal activity parameters
              </div>
            </div>
          </div>
        ) : (
          alerts.map((a, idx) => (
            <div
              key={idx}
              className={`alert-card ${
                a.type === "red"
                  ? "alert-card-red"
                  : a.type === "amber"
                  ? "alert-card-amber"
                  : "alert-card-green"
              }`}
            >
              <div style={{ flex: 1 }}>
                <div className="alert-title">{a.title}</div>
                <div className="alert-desc">{a.desc}</div>
              </div>
              {a.action && (
                <button
                  className="btn-sm btn-danger"
                  onClick={() => updateStatus(a.wallet, 2)}
                  disabled={!!statusLoading[a.wallet]}
                >
                  {a.action}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}

