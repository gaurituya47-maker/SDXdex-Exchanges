# Flash Arb Bot

Flash Arb Bot — A flash loan arbitrage scaffold (Aave V3 flash loans, multi-DEX swaps), with a Node scanner and React frontend.

## What this repo contains
- `contracts/` — Solidity contracts and interfaces
- `scripts/` — deployment and verification scripts
- `test/` — Hardhat tests
- `bot/` — Node.js arbitrage scanner and executor
- `frontend/` — Vite + React frontend
- `.github/workflows/` — CI and CD workflows

## Local development

1. Install dependencies

```bash
npm ci
cd frontend && npm ci
```

2. Compile contracts

```bash
npm run compile
```

3. Start a Hardhat fork (requires `MAINNET_RPC_URL` in env)

```bash
export MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
npx hardhat node --fork $MAINNET_RPC_URL --fork-block-number 19000000
```

4. Run tests against the fork

```bash
npx hardhat test --network localhost
```

5. Run the bot locally (requires `.env` with `MAINNET_RPC_URL`, `PRIVATE_KEY`, `CONTRACT_ADDRESS`)

```bash
npm run bot
```

## CI / CD

Two workflows are included:

- `.github/workflows/ci.yml` — runs on push/PR to `main` and `develop`, compiles and runs tests. Deploys frontend to Vercel on `main`.
- `.github/workflows/deploy-bot.yml` — runs tests on push to `main` then:
  - deploys frontend to Vercel (requires `VERCEL_TOKEN`, `ORG_ID`, `PROJECT_ID` secrets)
  - deploys the Node bot to Render (requires `RENDER_SERVICE_ID`, `RENDER_API_KEY` secrets)
  - optionally deploys contracts to mainnet if `MAINNET_RPC_URL` and `PRIVATE_KEY` secrets are provided

Add these repository secrets in GitHub (Settings → Secrets):

- `MAINNET_RPC_URL` — RPC endpoint for Ethereum mainnet
- `PRIVATE_KEY` — deployer's private key (used for contract deploys)
- `ETHERSCAN_API_KEY` — to verify contracts
- `VERCEL_TOKEN`, `ORG_ID`, `PROJECT_ID` — for frontend deployment
- `RENDER_API_KEY`, `RENDER_SERVICE_ID` — for bot deployment

## Notes & Safety

- Deploying contracts to mainnet via CI will spend real ETH; ensure secrets and approvals are correct before enabling.
- This repository is a scaffold for educational purposes. Running a real arbitrage bot or flash loans on mainnet carries financial and technical risk. Audit and test thoroughly.
# SDXdex-Exchanges