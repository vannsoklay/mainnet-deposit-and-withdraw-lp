import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EnsoClient } from "@ensofinance/sdk";
import {
  polygonChain,
  gnosisChain,
  PRIVATE_KEY,
  ENSO_API_KEY,
} from "./chains.js";

// Account setup
export const account = privateKeyToAccount(PRIVATE_KEY);

// Wallet clients for each chain
export const walletPolygonClient = createWalletClient({
  account,
  chain: polygonChain,
  transport: http("https://polygon-rpc.com"),
});

export const walletGnosisClient = createWalletClient({
  account,
  chain: gnosisChain,
  transport: http("https://rpc.gnosischain.com"),
});

// Public clients for reading blockchain data
export const sourceClient = createPublicClient({
  chain: polygonChain,
  transport: http("https://polygon-rpc.com"),
});

export const destinationClient = createPublicClient({
  chain: gnosisChain,
  transport: http("https://rpc.gnosischain.com"),
});

// Initialize Enso client
export const enso = new EnsoClient({
  apiKey: ENSO_API_KEY,
});
