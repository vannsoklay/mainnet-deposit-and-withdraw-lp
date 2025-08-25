import express from "express";
import { sourceClient, destinationClient, account } from "../config/clients.js";
import { monitorCrossChainTransaction } from "../utils/helpers.js";

const app = express();
const router = app.router;

// Monitor cross-chain transaction
// Route: GET /monitor/:txHash
router.get("/:txHash", async (req, res) => {
  try {
    const { txHash } = req.params;
    const { tokenAddress, maxWaitMinutes = 30 } = req.query;

    // Validate txHash parameter
    if (!txHash || txHash.length < 10) {
      return res.status(400).json({
        error: "Valid transaction hash is required",
        example: "/monitor/0x1234567890abcdef...",
      });
    }

    // if (!tokenAddress) {
    //   return res.status(400).json({
    //     error: "tokenAddress query parameter is required",
    //     example: "/monitor/0x123...?tokenAddress=0xabc...&maxWaitMinutes=30",
    //   });
    // }

    const fromAddress = account.address;

    console.log(`🔍 Starting monitoring for transaction: ${txHash}`);
    console.log(`📍 Token address: ${tokenAddress}`);
    console.log(`⏰ Max wait time: ${maxWaitMinutes} minutes`);

    // Start monitoring (this is async and might take a while)
    const success = await monitorCrossChainTransaction(
      txHash,
      tokenAddress,
      fromAddress,
      destinationClient,
      parseInt(maxWaitMinutes)
    );

    res.json({
      txHash,
      tokenAddress,
      success,
      message: success
        ? "Cross-chain transaction completed successfully"
        : `Transaction monitoring timed out after ${maxWaitMinutes} minutes`,
      timestamp: new Date().toISOString(),
      monitoring: {
        duration: `${maxWaitMinutes} minutes`,
        address: fromAddress,
        result: success ? "completed" : "timeout",
      },
    });
  } catch (error) {
    console.error("❌ Monitor error:", error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get transaction status
// Route: GET /monitor/status/:chain/:txHash
router.get("/status/:chain/:txHash", async (req, res) => {
  try {
    const { chain, txHash } = req.params;

    // Validate parameters
    if (!chain || !txHash) {
      return res.status(400).json({
        error: "Both chain and txHash parameters are required",
        example: "/monitor/status/polygon/0x123...",
      });
    }

    if (txHash.length < 10) {
      return res.status(400).json({
        error: "Invalid transaction hash format",
        received: txHash,
      });
    }

    let client, explorerUrl;

    if (chain.toLowerCase() === "polygon") {
      client = sourceClient;
      explorerUrl = `https://polygonscan.com/tx/${txHash}`;
    } else if (chain.toLowerCase() === "gnosis") {
      client = destinationClient;
      explorerUrl = `https://gnosisscan.io/tx/${txHash}`;
    } else {
      return res.status(400).json({
        error: "Unsupported chain. Use 'polygon' or 'gnosis'",
        received: chain,
        supportedChains: ["polygon", "gnosis"],
      });
    }

    try {
      // Try to get transaction receipt first
      const receipt = await client.getTransactionReceipt({ hash: txHash });

      res.json({
        txHash,
        chain: chain.toLowerCase(),
        status: receipt.status === "success" ? "success" : "failed",
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        logs: receipt.logs.length,
        explorerUrl,
        receipt: {
          blockHash: receipt.blockHash,
          cumulativeGasUsed: receipt.cumulativeGasUsed.toString(),
          effectiveGasPrice: receipt.effectiveGasPrice?.toString() || "0",
          from: receipt.from,
          to: receipt.to,
          type: receipt.type,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (txError) {
      // Transaction might be pending
      try {
        const tx = await client.getTransaction({ hash: txHash });
        res.json({
          txHash,
          chain: chain.toLowerCase(),
          status: "pending",
          explorerUrl,
          transaction: {
            blockNumber: tx.blockNumber?.toString() || null,
            from: tx.from,
            to: tx.to,
            value: tx.value.toString(),
            gas: tx.gas.toString(),
            gasPrice: tx.gasPrice.toString(),
            nonce: tx.nonce,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (pendingError) {
        res.status(404).json({
          error: "Transaction not found",
          txHash,
          chain: chain.toLowerCase(),
          explorerUrl,
          message: "Transaction may not exist or is not yet propagated",
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error("❌ Status check error:", error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get recent transactions info (provides explorer URLs)
// Route: GET /monitor/history/:chain
router.get("/history/:chain", async (req, res) => {
  try {
    const { chain } = req.params;
    const { limit = 10 } = req.query;

    if (!chain) {
      return res.status(400).json({
        error: "Chain parameter is required",
        example: "/monitor/history/polygon",
      });
    }

    let explorerApiUrl, explorerUrl;

    if (chain.toLowerCase() === "polygon") {
      explorerApiUrl = `https://api.polygonscan.com/api?module=account&action=txlist&address=${account.address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc`;
      explorerUrl = `https://polygonscan.com/address/${account.address}`;
    } else if (chain.toLowerCase() === "gnosis") {
      explorerApiUrl = `https://api.gnosisscan.io/api?module=account&action=txlist&address=${account.address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc`;
      explorerUrl = `https://gnosisscan.io/address/${account.address}`;
    } else {
      return res.status(400).json({
        error: "Unsupported chain. Use 'polygon' or 'gnosis'",
        received: chain,
        supportedChains: ["polygon", "gnosis"],
      });
    }

    res.json({
      message: "Transaction history endpoint",
      chain: chain.toLowerCase(),
      address: account.address,
      explorerUrl,
      explorerApiUrl,
      instructions: "Use the explorer URLs to fetch transaction history",
      note: "This endpoint provides URLs for fetching transaction history from block explorers",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ History error:", error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as monitorRouter };
