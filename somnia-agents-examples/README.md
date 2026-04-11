# Somnia Agents — Example Projects

Hands-on examples for building with Somnia AI Agents. Each project demonstrates a different agent type with a minimal smart contract and invocation script.

> **Explore agents interactively:** [agents.testnet.somnia.network](https://agents.testnet.somnia.network/)
> **Full documentation:** [Somnia Agents Docs](https://metaversal.gitbook.io/agents/s8KLL5NzoS6LwJVIQCiT)

## Projects

| # | Project | Agent | What You'll Learn |
|---|---------|-------|-------------------|
| 01 | [**Price Oracle**](./01-price-oracle/) | JSON API Request | Fetch API data on-chain, decimal scaling, basic callback pattern |
| 02 | [**Sentiment Analyzer**](./02-sentiment-analyzer/) | LLM Inference | On-chain AI, constrained outputs, numeric inference |
| 03 | [**Web Data Extractor**](./03-web-data-extractor/) | LLM Parse Website | AI-powered web scraping, search vs direct scrape |

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A wallet with STT (Somnia Testnet Token)
### Setup

```bash
# Clone and install
git clone https://github.com/SomniaDevs/somnia-agents-examples.git
cd somnia-agents-examples
npm install

# Configure your wallet
cp .env.example .env
# Edit .env and add your private key

# Compile all contracts
npm run compile
```

### Run an Example

```bash
# Deploy the Price Oracle
npm run deploy:oracle

# Update the contract address in 01-price-oracle/scripts/invoke.ts, then:
npm run invoke:oracle
```

## How Somnia Agents Work

```
┌─────────────┐       ┌──────────────────┐       ┌────────────────┐
│ Your Smart  │       │  Somnia Agents   │       │   Validator    │
│  Contract   │──────►│    Platform      │──────►│    Network     │
│             │       │                  │       │                │
│             │◄──────│  (consensus +    │◄──────│  (execute +    │
│             │       │   callback)      │       │   agree)       │
└─────────────┘       └──────────────────┘       └────────────────┘
```

1. Your contract sends a **request** with an ABI-encoded payload + deposit (STT)
2. The platform distributes the request to **validators**
3. Validators execute the agent independently and reach **consensus**
4. The platform calls your contract's **callback** with the result
5. Unused deposit is **rebated** to your contract

## Available Agents

| Agent | ID | Methods | Use Case |
|-------|----|---------|----------|
| **JSON API Request** | `13174292974160097713` | 6 (`fetchString`, `fetchUint`, `fetchInt`, `fetchBool`, `fetchStringArray`, `fetchUintArray`) | Fetch data from any REST API |
| **LLM Inference** | `12847293847561029384` | 4 (`inferString`, `inferNumber`, `inferChat`, `inferToolsChat`) | On-chain AI reasoning and decisions |
| **LLM Parse Website** | `12875401142070969085` | 2 (`ExtractString`, `ExtractANumber`) | Scrape and extract data from any website |

## Network Info

| Property | Value |
|----------|-------|
| Network | Somnia Testnet |
| Chain ID | `50312` |
| RPC | `https://api.infra.testnet.somnia.network` |
| Explorer | [shannon-explorer.somnia.network](https://shannon-explorer.somnia.network) |
| Platform Contract | `0x7407cb35a17D511D1Bd32dD726ADb8D5344ECbE3` |
| Agent Registry | `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` |

> **Note:** The **Platform Contract** is where you send requests (`createRequest`). The **Agent Registry** stores agent metadata (names, methods, ABIs) — useful for discovery but not required if you already know the agent ID.

## Project Structure

```
somnia-agents-examples/
├── contracts/
│   ├── interfaces/
│   │   └── ISomniaAgents.sol      # Shared platform interface + agent ABIs
│   ├── PriceOracle.sol            # Example 01
│   ├── SentimentAnalyzer.sol      # Example 02
│   └── WebDataExtractor.sol       # Example 03
├── 01-price-oracle/
│   ├── scripts/                   # Deploy & invoke scripts
│   └── README.md                  # Detailed walkthrough
├── 02-sentiment-analyzer/
│   ├── scripts/
│   └── README.md
├── 03-web-data-extractor/
│   ├── scripts/
│   └── README.md
├── hardhat.config.ts
└── package.json
```

