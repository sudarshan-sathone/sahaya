import deployed from "../../deployedAddress.json";
import abiJson from "../../../artifacts/contracts/ReliefPool.sol/ReliefPool.json";

export const contractAddress = deployed.address;
export const abi = abiJson.abi;

export const DISASTER_TYPES = [
  "Flood",
  "Earthquake",
  "Cyclone",
  "Drought",
  "Fire",
  "Pandemic",
  "Other"
];

export const DISASTER_COLORS = {
  Flood: "#3B8BD4",
  Earthquake: "#E24B4A",
  Cyclone: "#7F77DD",
  Drought: "#EF9F27",
  Fire: "#D85A30",
  Pandemic: "#1D9E75",
  Other: "#888780"
};

export const CAMPAIGN_STATUS = [
  "Pending",
  "Verified",
  "Active",
  "Flagged",
  "Closed"
];

export const CAMPAIGN_STATUS_COLORS = {
  Pending: "#EF9F27",
  Verified: "#1D9E75",
  Active: "#1D9E75",
  Flagged: "#E24B4A",
  Closed: "#888780"
};

export const NGO_STATUS = ["Pending", "Active", "Suspended"];

export const INACTIVE_DAYS = 7;

