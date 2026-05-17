import { getAddress, isAddress } from "viem";

import deployment from "../deployments/playscript-v2-somnia.json";

export type V2DeployedContractEntry = {
  address: string;
  deploymentBlock: string;
};

export type PlayscriptV2KernelSettlementMeta = {
  /** `espn-v2` = scoreboard + summary URLs, `fetchUint` settlement (see `EspnJsonApiFetchMocks.sol`). */
  abi: "espn-v2";
  fetchCounts: { soccer: number; basketball: number; americanFootball: number; mlb: number };
};

export type PlayscriptV2SomniaDeploymentFile = {
  schemaVersion: number;
  /** Hardhat network key (`hardhat.config.ts` → `networks.somnia`). */
  network: string;
  /** The Graph manifest / graph-node chain slug (`subgraph.yaml` → `network`). */
  graphNetwork?: string;
  chainId: number;
  deployedAt: string | null;
  deployer: string | null;
  playToken: string | null;
  nativeHostDeployWei: string | null;
  nativeKernelFundWei: string | null;
  kernelFundTxBlock: string | null;
  kernelSettlement?: PlayscriptV2KernelSettlementMeta | null;
  contracts: Partial<Record<V2DeploymentContractName, V2DeployedContractEntry>>;
};

export type V2DeploymentContractName =
  | "PlayToken"
  | "PlayscriptKernel"
  | "PlayVault"
  | "PlayscriptReactivityHost"
  | "PlayscriptV2Positions"
  | "PlayscriptV2LockRegistry";

const file = deployment as PlayscriptV2SomniaDeploymentFile;

function parseAddrLoose(raw: string | null | undefined): `0x${string}` | null {
  const v = raw?.trim().replace(/^["']|["']$/g, "") ?? "";
  if (!v || !isAddress(v)) return null;
  return getAddress(v) as `0x${string}`;
}

/** Canonical PLAY from deployment record (after `npm run deploy:playscript-v2:somnia`). */
export function getV2DeploymentPlayToken(): `0x${string}` | null {
  return parseAddrLoose(file.playToken);
}

export function getV2DeploymentContract(name: V2DeploymentContractName): `0x${string}` | null {
  const row = file.contracts[name];
  return parseAddrLoose(row?.address);
}

export function getV2DeploymentBlock(name: V2DeploymentContractName): bigint | null {
  const row = file.contracts[name];
  if (!row?.deploymentBlock) return null;
  try {
    return BigInt(row.deploymentBlock);
  } catch {
    return null;
  }
}

export function getV2DeploymentMeta(): Pick<
  PlayscriptV2SomniaDeploymentFile,
  "schemaVersion" | "network" | "chainId" | "deployedAt" | "kernelFundTxBlock"
> {
  return {
    schemaVersion: file.schemaVersion,
    network: file.network,
    chainId: file.chainId,
    deployedAt: file.deployedAt,
    kernelFundTxBlock: file.kernelFundTxBlock,
  };
}

/** True when deployment record is schema v2+ with ESPN settlement kernel (not legacy TheSportsDB / 5-fetch). */
export function isEspnV2KernelDeployment(): boolean {
  return file.schemaVersion >= 2 && file.kernelSettlement?.abi === "espn-v2";
}
