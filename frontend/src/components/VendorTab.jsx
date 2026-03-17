import { useState } from "react";
import { ethers } from "ethers";

export default function VendorTab({ contract, account }) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError("Connect as vendor wallet first.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const tx = await contract.redeemOTP(Number(otp));
      const receipt = await tx.wait();
      setMessage(
        `OTP redeemed. Tx ${receipt.hash.slice(
          0,
          10
        )}... Check wallet balance for received ETH.`
      );
      setOtp("");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to redeem OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h2>Vendor</h2>
      {account && (
        <p className="muted-text">
          Vendor wallet: {account.slice(0, 6)}...{account.slice(-4)}
        </p>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form onSubmit={handleRedeem} className="form-grid">
        <div className="form-row">
          <label>OTP Number</label>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit OTP"
            required
          />
        </div>
        <button className="primary-button" disabled={loading}>
          {loading ? "Redeeming..." : "Redeem OTP"}
        </button>
      </form>

      <p className="muted-text">
        After redemption, convert ETH to INR via WazirX or CoinDCX (demo
        explanation for judges).
      </p>
    </section>
  );
}

