import express from "express";
import { parseUnits, formatUnits, encodeFunctionData, erc20Abi } from "viem";
import {
  polygonClient,
  walletPolygonClient,
  enso,
  account,
} from "../config/clients.js";
import { TOKEN_ADDRESSES } from "../config/chains.js";
import { gnosis, polygon } from "viem/chains";

const app = express();
const router = app.router;

// Deposit (Polygon EURe → Gnosis LP)
// Route: POST /deposit
router.post("/", async (req, res) => {
  try {
    const { amount } = req.body;

    // Validate input
    if (!amount) {
      return res.status(400).json({
        error: "Amount is required",
        example: { amount: "1.0" },
      });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: "Invalid amount provided. Must be a positive number",
        received: amount,
      });
    }

    const fromAddress = account.address;
    const tokenInAddress = TOKEN_ADDRESSES.EURe_POLYGON;
    const lpTokenAddress = TOKEN_ADDRESSES.LP_GNOSIS;

    console.log(`🔄 Starting deposit: ${amount} EURe from Polygon to Gnosis`);
    console.log(`📍 From address: ${fromAddress}`);

    // Check balance
    const balance = await sourceClient.readContract({
      address: tokenInAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [fromAddress],
    });

    const amountInWei = parseUnits(amount, 18);
    console.log(`💰 Current balance: ${formatUnits(balance, 18)} EURe`);
    console.log(`💸 Requested amount: ${amount} EURe`);

    if (BigInt(balance) < amountInWei) {
      return res.status(400).json({
        error: "Insufficient balance",
        required: formatUnits(amountInWei, 18),
        available: formatUnits(balance, 18),
      });
    }

    // Get route
    console.log("🔍 Getting route data...");
    const route = await enso.getRouteData({
      chainId: polygon.id,
      destinationChainId: gnosis.id,
      tokenIn: [tokenInAddress],
      tokenOut: [lpTokenAddress],
      amountIn: [amountInWei.toString()],
      fromAddress,
      receiver: fromAddress,
      routingStrategy: "router",
      slippage: 200,
    });

    if (!route || (!route.tx && !route.to)) {
      return res
        .status(400)
        .json({ error: "No route found for this transaction" });
    }

    console.log("✅ Route found");

    const { to, data, value } = route.tx || route;

    if (!to || !data) {
      return res.status(400).json({ error: "Invalid route data received" });
    }

    // Check and handle approval
    console.log("🔍 Checking token allowance...");
    const allowance = await polygonClient.readContract({
      address: tokenInAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [fromAddress, to],
    });

    let approvalTxHash = null;
    if (BigInt(allowance) < amountInWei) {
      console.log("📝 Insufficient allowance, approving token transfer...");

      const approvalData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [to, amountInWei],
      });

      approvalTxHash = await walletPolygonClient.sendTransaction({
        to: tokenInAddress,
        data: approvalData,
        value: BigInt(0),
        chainId: sourceChain.id,
      });

      console.log(`📝 Approval transaction sent: ${approvalTxHash}`);
      await sourceClient.waitForTransactionReceipt({ hash: approvalTxHash });
      console.log("✅ Approval confirmed");
    } else {
      console.log("✅ Sufficient allowance already exists");
    }

    // Execute main transaction
    console.log("🚀 Executing deposit transaction...");
    const txHash = await walletPolygonClient.sendTransaction({
      to,
      value: BigInt(value || "0"),
      data,
      chainId: sourceChain.id,
    });

    console.log(`🚀 Deposit transaction sent: ${txHash}`);
    const receipt = await polygonClient.waitForTransactionReceipt({
      hash: txHash,
    });
    console.log("✅ Deposit transaction confirmed on Polygon");

    res.json({
      success: true,
      txHash,
      approvalTxHash,
      receipt: {
        status: receipt.status,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber.toString(),
      },
      monitoring: {
        message:
          "Cross-chain transaction submitted. Monitor the destination chain for settlement.",
        polygonTx: `https://polygonscan.com/tx/${txHash}`,
        explorerUrls: {
          polygon: `https://polygonscan.com/tx/${txHash}`,
          ...(approvalTxHash && {
            approval: `https://polygonscan.com/tx/${approvalTxHash}`,
          }),
        },
      },
      meta: {
        fromChain: "Polygon",
        toChain: "Gnosis",
        fromToken: "EURe",
        toToken: "LP Token",
        amount: amount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Deposit error:", error);

    // Enhanced error response
    let errorMessage = error.message;
    let errorType = "unknown";

    if (error.message.includes("insufficient funds")) {
      errorType = "insufficient_funds";
      errorMessage = "Insufficient funds for gas or token amount";
    } else if (error.message.includes("gas")) {
      errorType = "gas_error";
      errorMessage = "Transaction failed due to gas issues";
    } else if (error.message.includes("revert")) {
      errorType = "transaction_revert";
      errorMessage = "Transaction was reverted by the contract";
    }

    res.status(500).json({
      error: errorMessage,
      type: errorType,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get deposit quote (for estimation without executing)
// Route: POST /deposit/quote
router.post("/quote", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({
        error: "Amount is required",
        example: { amount: "1.0" },
      });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: "Invalid amount provided. Must be a positive number",
        received: amount,
      });
    }

    const fromAddress = account.address;
    const tokenInAddress = TOKEN_ADDRESSES.EURe_POLYGON;
    const lpTokenAddress = TOKEN_ADDRESSES.LP_GNOSIS;
    const amountInWei = parseUnits(amount, 18);

    // Get route for quote
    const route = await enso.getRouteData({
      chainId: polygon.id,
      destinationChainId: gnosis.id,
      tokenIn: [tokenInAddress],
      tokenOut: [lpTokenAddress],
      amountIn: [amountInWei.toString()],
      fromAddress,
      receiver: fromAddress,
      routingStrategy: "router",
    });

    if (!route) {
      return res.status(400).json({ error: "No route found for this amount" });
    }

    res.json({
      quote: {
        inputAmount: amount,
        inputToken: "EURe",
        outputToken: "LP Token",
        fromChain: "Polygon",
        toChain: "Gnosis",
        route: route,
        estimatedGas: route.gas || "Unknown",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Quote error:", error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as depositRouter };
