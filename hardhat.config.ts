import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-viem";
import "dotenv/config";

const somniaTestnetRpcUrl =
  process.env.SOMNIA_TESTNET_RPC_URL?.trim() ||
  process.env.SOMNIA_RPC_TESTNET?.trim() ||
  "https://api.infra.testnet.somnia.network";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    somnia: {
      url: somniaTestnetRpcUrl,
      chainId: 50312,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
  },
};

export default config;
