# AidChain — Build Progress Tracker (Updated)

---

## BEFORE YOU START — Manual Setup
- [ ] MetaMask installed, Sepolia network added (Chain ID 11155111)
- [ ] Alchemy account created, Sepolia API URL copied
- [ ] .env file created with PRIVATE_KEY and ALCHEMY_API_URL
- [ ] Test ETH from cloud.google.com/application/web3/faucet
- [ ] Node.js 18+ installed — verify: node --version
- [ ] Git initialized, GitHub repo created

---

## Phase 1 — Smart Contract (Do First)

- [x] Hardhat project initialized — verify: package.json exists
- [x] npm install completed — verify: node_modules/@openzeppelin exists
- [x] ReliefPool.sol written with all enums, structs, functions
- [x] hardhat.config.js has localhost and sepolia networks
- [x] npx hardhat compile — verify: zero errors
- [x] npx hardhat test — verify: all tests green
- [x] npx hardhat node running in terminal 1
- [x] npx hardhat run scripts/deploy.js --network localhost
- [x] deployedAddress.json created with local address
- [ ] Full contract flow tested manually on local network
- [ ] npx hardhat run scripts/deploy.js --network sepolia
- [ ] Contract visible on sepolia.etherscan.io

Contract Address (local):    ____________________________
Contract Address (Sepolia):  ____________________________
Sepolia Etherscan Link:      ____________________________

---

## Phase 2 — Frontend (Do After Phase 1)

- [ ] React + Vite created in /frontend
- [ ] npm install in /frontend completed
- [ ] constants/index.js reads address and ABI correctly
- [ ] useContract hook connects MetaMask on localhost:8545
- [ ] AdminDashboard shows real stats from contract
- [ ] CampaignManager creates and verifies campaigns
- [ ] NGOManager registers and monitors NGOs
- [ ] BeneficiaryManager registers, approves, issues OTP
- [ ] TransactionMonitor shows all transactions with auto-refresh
- [ ] DonorTab shows active campaigns and accepts donations
- [ ] NGOWorkerTab registers beneficiaries
- [ ] VendorTab redeems OTPs
- [ ] TransparencyTab shows all data without wallet
- [ ] Full demo flow tested end to end on local network
- [ ] npm run build — verify: no build errors
- [ ] Deployed to Vercel

Vercel URL: ____________________________

---

## Phase 3 — Analytics and ML (Do After Phase 2)

- [ ] dataProcessor.js utility functions written and tested
- [ ] AnalyticsDashboard shows charts from real contract data
- [ ] Bar chart for campaigns by disaster type working
- [ ] Line chart for funds over time working
- [ ] NGO performance table populated
- [ ] Export Training Data button downloads valid JSON
- [ ] PredictionPanel shows mock predictions in demo mode
- [ ] ML teammate API URL integrated (or mock confirmed for demo)
- [ ] MonitoringAlerts shows inactive campaign detection
- [ ] Suspicious transaction flags working
- [ ] Auto-monitoring toggle working
- [ ] Analytics tab added to App.jsx
- [ ] Full Phase 3 tested with Phase 1 and 2

ML API URL (from teammate): ____________________________

---

## Multiple Laptop Workflow

After every session:
  git add .
  git commit -m "describe progress"
  git push

On new laptop:
  git clone your-repo-url
  npm install
  cd frontend && npm install
  Manually copy .env file (never in git)
  MetaMask: import same wallet via seed phrase

If contract already deployed, just update deployedAddress.json.
No need to redeploy.

---

## Common Errors and Fixes

nonce too high
  MetaMask → Settings → Advanced → Reset Account

insufficient funds
  Use local hardhat node for all testing and demo

contract not deployed
  Check deployedAddress.json matches current network

ABI mismatch
  npx hardhat compile then restart frontend

MetaMask wrong network
  Switch to localhost:8545 Chain ID 31337 for demo

BigInt render error in React
  Wrap all contract values: Number(value.toString())
  or use ethers.formatEther for ETH amounts

recharts not rendering
  Check data array has no BigInt values — all must be numbers

---

## Demo Day Checklist

- [ ] Terminal 1: npx hardhat node running
- [ ] Fresh deploy: npx hardhat run scripts/deploy.js --network localhost
- [ ] Update deployedAddress.json with new local address
- [ ] Terminal 2: cd frontend && npm run dev
- [ ] MetaMask: switch to localhost:8545
- [ ] MetaMask: import Account 1 from Hardhat terminal output
- [ ] MetaMask: import Account 2 as donor wallet
- [ ] MetaMask: import Account 3 as vendor wallet
- [ ] Sepolia Etherscan link open in separate tab
- [ ] Demo flow rehearsed at least twice end to end
- [ ] Analytics charts loading with sample data
- [ ] Prediction panel showing mock results
- [ ] Monitoring alerts section visible
