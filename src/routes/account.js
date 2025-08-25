import express from "express";
import { formatUnits } from "viem";
import { sourceClient, destinationClient, account } from "../config/clients.js";
import { TOKEN_ADDRESSES } from "../config/chains.js";
import { getTokenInfo, safeBigIntToString } from "../utils/helpers.js";

const router = express.Router();

// Helper function to safely format token info
const formatTokenInfo = (tokenInfo) => {
  if (!tokenInfo) return null;

  return {
    name: tokenInfo.name,
    symbol: tokenInfo.symbol,
    decimals: tokenInfo.decimals,
    balance: safeBigIntToString(tokenInfo.balance),
  };
};

// Get account info and balances
router.get("/", async (req, res) => {
  try {
    const fromAddress = account.address;

    console.log(`📊 Fetching account info for: ${fromAddress}`);

    // Get balances from both chains
    const [polygonBalance, gnosisBalance] = await Promise.all([
      getTokenInfo(sourceClient, TOKEN_ADDRESSES.EURe_POLYGON, fromAddress),
      getTokenInfo(destinationClient, TOKEN_ADDRESSES.LP_GNOSIS, fromAddress),
    ]);

    // Get native token balances (MATIC and xDAI)
    const [maticBalance, xdaiBalance] = await Promise.all([
      sourceClient.getBalance({ address: fromAddress }),
      destinationClient.getBalance({ address: fromAddress }),
    ]);

    // Safely format all the data
    const responseData = {
      address: fromAddress,
      balances: {
        polygon: {
          native: {
            token: "MATIC",
            balance: formatUnits(maticBalance, 18),
            raw: safeBigIntToString(maticBalance),
          },
          EURe: {
            balance: polygonBalance
              ? formatUnits(polygonBalance.balance, polygonBalance.decimals)
              : "0",
            raw: polygonBalance
              ? safeBigIntToString(polygonBalance.balance)
              : "0",
            tokenInfo: formatTokenInfo(polygonBalance),
          },
        },
        gnosis: {
          native: {
            token: "xDAI",
            balance: formatUnits(xdaiBalance, 18),
            raw: safeBigIntToString(xdaiBalance),
          },
          LP: {
            balance: gnosisBalance
              ? formatUnits(gnosisBalance.balance, gnosisBalance.decimals)
              : "0",
            raw: gnosisBalance
              ? safeBigIntToString(gnosisBalance.balance)
              : "0",
            tokenInfo: formatTokenInfo(gnosisBalance),
          },
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        chains: {
          polygon: {
            id: 137,
            name: "Polygon",
            nativeCurrency: "MATIC",
          },
          gnosis: {
            id: 100,
            name: "Gnosis Chain",
            nativeCurrency: "xDAI",
          },
        },
      },
    };

    res.json(responseData);
  } catch (error) {
    console.error("❌ Account info error:", error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get balance for specific token
router.get("/balance/:chain/:token", async (req, res) => {
  try {
    const chain = req.params.chain;
    const token = req.params.token;
    const fromAddress = account.address;

    // Validate parameters
    if (!chain || !token) {
      return res.status(400).json({
        error: "Both chain and token parameters are required",
        example: "/account/balance/polygon/eure",
      });
    }

    let client, tokenAddress;

    // Determine client and token address based on parameters
    if (chain.toLowerCase() === "polygon") {
      client = sourceClient;
      if (token.toLowerCase() === "eure") {
        tokenAddress = TOKEN_ADDRESSES.EURe_POLYGON;
      } else {
        return res.status(400).json({
          error: "Unsupported token for Polygon. Use 'eure'",
          received: token,
          supportedTokens: ["eure"],
        });
      }
    } else if (chain.toLowerCase() === "gnosis") {
      client = destinationClient;
      if (token.toLowerCase() === "lp") {
        tokenAddress = TOKEN_ADDRESSES.LP_GNOSIS;
      } else {
        return res.status(400).json({
          error: "Unsupported token for Gnosis. Use 'lp'",
          received: token,
          supportedTokens: ["lp"],
        });
      }
    } else {
      return res.status(400).json({
        error: "Unsupported chain. Use 'polygon' or 'gnosis'",
        received: chain,
        supportedChains: ["polygon", "gnosis"],
      });
    }

    const tokenInfo = await getTokenInfo(client, tokenAddress, fromAddress);

    if (!tokenInfo) {
      return res
        .status(500)
        .json({ error: "Failed to fetch token information" });
    }

    res.json({
      address: fromAddress,
      chain: chain.toLowerCase(),
      token: token.toLowerCase(),
      balance: formatUnits(tokenInfo.balance, tokenInfo.decimals),
      raw: safeBigIntToString(tokenInfo.balance),
      tokenInfo: {
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        address: tokenAddress,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Balance check error:", error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as accountRouter };
