import { useEffect, useState } from "react";
import { NGO_STATUS } from "../constants/index.js";

export default function NGOManager({ contract }) {
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [ngos, setNgos] = useState([]);

  const loadNgos = async () => {
    if (!contract) return;
    try {
      setError(null);

      // Read all NGOs from contract using ngoCount / ngoById
      const count = await contract.ngoCount();
      const total = Number(count);
      const list = [];

      for (let i = 1; i <= total; i++) {
        const ngo = await contract.ngoById(i);
        if (ngo.exists) {
          const addr = ngo.wallet;
          const activity = await contract.getNGOActivity(addr);
          list.push({
            wallet: addr,
            ngo,
            activity
          });
        }
      }

      setNgos(list);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load NGOs");
    }
  };

  useEffect(() => {
    loadNgos();
  }, [contract]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError("Connect as admin first.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const tx = await contract.registerNGO(wallet, name, regNo);
      const receipt = await tx.wait();
      const txHash = receipt.hash;
      setMessage(
        `NGO registered. Tx ${txHash.slice(0, 10)}... (refresh list after activity starts)`
      );
      setWallet("");
      setName("");
      setRegNo("");
      await loadNgos();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to register NGO");
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (addr, status) => {
    if (!contract) return;
    try {
      setLoading(true);
      setError(null);
      const tx = await contract.updateNGOStatus(addr, status);
      const receipt = await tx.wait();
      setMessage(
        `NGO status updated. Tx ${receipt.hash.slice(0, 10)}...`
      );
      await loadNgos();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to update NGO status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h2>NGO Management</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form className="form-grid" onSubmit={handleRegister}>
        <div className="form-row">
          <label>NGO Wallet Address</label>
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label>NGO Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label>Registration Number</label>
          <input
            value={regNo}
            onChange={(e) => setRegNo(e.target.value)}
            required
          />
        </div>
        <button className="primary-button" disabled={loading}>
          {loading ? "Submitting..." : "Register NGO"}
        </button>
      </form>

      <h3 className="section-title">NGO Activity</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Wallet</th>
              <th>Reg. No.</th>
              <th>Status</th>
              <th>Registered</th>
              <th>Approved</th>
              <th>Redeemed</th>
              <th>Redemption Rate</th>
              <th>Activity Score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ngos.map(({ wallet: addr, ngo, activity }) => {
              const [totalRegistered, totalApproved, totalRedeemed, status] =
                activity;
              const reg = Number(totalRegistered);
              const red = Number(totalRedeemed);
              const rate = reg > 0 ? Math.round((red / reg) * 100) : 0;
              let scoreColor = "muted-text";
              if (rate > 60) scoreColor = "text-green";
              else if (rate >= 30) scoreColor = "text-amber";
              else scoreColor = "text-red";

              const statusLabel = NGO_STATUS[Number(status)] || "Unknown";

              return (
                <tr key={addr}>
                  <td>{ngo.name}</td>
                  <td>{addr.slice(0, 6)}...{addr.slice(-4)}</td>
                  <td>{ngo.registrationNumber}</td>
                  <td>{statusLabel}</td>
                  <td>{reg}</td>
                  <td>{Number(totalApproved)}</td>
                  <td>{red}</td>
                  <td>{rate}%</td>
                  <td className={scoreColor}>{rate}%</td>
                  <td>
                    <button
                      className="small-button"
                      disabled={loading}
                      onClick={() => handleStatus(addr, 1)}
                    >
                      Activate
                    </button>
                    <button
                      className="small-button danger"
                      disabled={loading}
                      onClick={() => handleStatus(addr, 2)}
                    >
                      Suspend
                    </button>
                  </td>
                </tr>
              );
            })}
            {ngos.length === 0 && (
              <tr>
                <td colSpan="10" className="muted-text">
                  NGOs will appear here once they register beneficiaries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {ngos.some(({ activity }) => {
        const [totalRegistered, , totalRedeemed] = activity;
        const reg = Number(totalRegistered);
        const red = Number(totalRedeemed);
        const rate = reg > 0 ? (red / reg) * 100 : 0;
        return reg > 10 && rate < 20;
      }) && (
        <div className="alert alert-error">
          Suspicious NGO activity detected — some NGOs have registered many
          victims but very few redeemed.
        </div>
      )}
    </section>
  );
}

