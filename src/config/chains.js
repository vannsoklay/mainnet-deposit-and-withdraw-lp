import { polygon, gnosis } from "viem/chains";

// Define chains with proper RPC URLs
export const sourceChain = {
  ...polygon,
  rpcUrls: {
    default: {
      http: ["https://polygon-rpc.com"],
    },
    public: {
      http: ["https://polygon-rpc.com"],
    },
  },
};

export const destinationChain = {
  ...gnosis,
  rpcUrls: {
    default: {
      http: ["https://rpc.gnosischain.com"],
    },
    public: {
      http: ["https://rpc.gnosischain.com"],
    },
  },
};

// Token addresses
export const TOKEN_ADDRESSES = {
  EURe_POLYGON: "0x18ec0A6E18E5bc3784fDd3a3634b31245ab704F6",
  LP_GNOSIS: "0xedbc7449a9b594ca4e053d9737ec5dc4cbccbfb2",
};

// API Configuration
export const ENSO_API_KEY =
  process.env.ENSO_API_KEY || "3c872f25-f2a0-4d02-9744-290e09494d5b";

// Validate environment variables
export const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY environment variable is required");
}
