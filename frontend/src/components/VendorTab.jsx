import { useState } from "react";
import toast from "react-hot-toast";

export default function VendorTab({ contract, account }) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!contract) {
      toast.error("Please connect your wallet first");
      return;
    }
    try {
      setLoading(true);
      const toastId = toast.loading("Waiting for confirmation...");
      const tx = await contract.redeemOTP(Number(otp));
      await tx.wait();
      toast.success("OTP redeemed. Funds transferred to vendor wallet.", {
        id: toastId
      });
      setOtp("");
    } catch (e) {
      console.error(e);
      const message = e?.reason || e?.message || "Transaction failed";
      toast.error(
        message.length > 80 ? message.slice(0, 80) + "..." : message
      );
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

