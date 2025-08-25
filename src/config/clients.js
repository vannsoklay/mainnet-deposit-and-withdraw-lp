import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EnsoClient } from "@ensofinance/sdk";
import {
  sourceChain,
  destinationChain,
  PRIVATE_KEY,
  ENSO_API_KEY,
} from "./chains.js";

// Account setup
export const account = privateKeyToAccount(PRIVATE_KEY);

// Wallet clients for each chain
export const walletPolygonClient = createWalletClient({
  account,
  chain: sourceChain,
  transport: http("https://polygon-rpc.com"),
});

export const walletGnosisClient = createWalletClient({
  account,
  chain: destinationChain,
  transport: http("https://rpc.gnosischain.com"),
});

// Public clients for reading blockchain data
export const sourceClient = createPublicClient({
  chain: sourceChain,
  transport: http("https://polygon-rpc.com"),
});

export const destinationClient = createPublicClient({
  chain: destinationChain,
  transport: http("https://rpc.gnosischain.com"),
});

// Initialize Enso client
export const enso = new EnsoClient({
  apiKey: ENSO_API_KEY,
});
