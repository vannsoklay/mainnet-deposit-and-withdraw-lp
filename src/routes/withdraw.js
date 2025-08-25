import express from "express";
import { parseUnits, formatUnits, encodeFunctionData, erc20Abi } from "viem";
import {
  destinationClient,
  walletGnosisClient,
  enso,
  account,
} from "../config/clients.js";
import { TOKEN_ADDRESSES } from "../config/chains.js";
import {
  withTimeout,
  getDynamicGasPrice,
  estimateGasWithBuffer,
} from "../utils/helpers.js";
import { gnosis, polygon } from "viem/chains";

const app = express();
const router = app.router;

// Execute approval with retry logic
const executeApproval = async (spender, amount, retries = 3) => {
  const gasPrice = await getDynamicGasPrice(destinationClient);

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`📝 Approval attempt ${i + 1}/${retries}...`);

      const approvalData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount],
      });

      const estimatedGas = await estimateGasWithBuffer(
        destinationClient,
        {
          to: TOKEN_ADDRESSES.LP_GNOSIS,
          data: approvalData,
          value: 0n,
        },
        account.address
      );

      const approvalHash = await walletGnosisClient.sendTransaction({
        to: TOKEN_ADDRESSES.LP_GNOSIS,
        data: approvalData,
        value: 0n,
        chainId: gnosis.id,
        gas: estimatedGas,
        gasPrice,
      });

      console.log(`📝 Approval hash (attempt ${i + 1}):`, approvalHash);

      await withTimeout(
        destinationClient.waitForTransactionReceipt({ hash: approvalHash }),
        240_000,
        "Approval confirmation"
      );

      console.log("✅ Approval confirmed");
      return approvalHash;
    } catch (error) {
      console.log(`❌ Approval attempt ${i + 1} failed:`, error.message);

      if (i === retries - 1) {
        throw new Error(
          `Approval failed after ${retries} attempts: ${error.message}`
        );
      }

      const waitTime = Math.pow(2, i) * 15000;
      console.log(`⏳ Waiting ${waitTime / 1000}s before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
};

// Withdraw (Gnosis LP → Polygon EURe)
// Route: POST /withdraw
router.post("/", async (req, res) => {
  try {
    const { amount } = req.body;

    // Validate input
    if (!amount) {
      return res.status(400).json({
        error: "Amount is required",
        example: { amount: "2.0" },
      });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: "Invalid amount provided. Must be a positive number",
        received: amount,
      });
    }

    const fromAddress = account.address;
    const lpTokenAddress = TOKEN_ADDRESSES.LP_GNOSIS;
    const tokenOutPolygon = TOKEN_ADDRESSES.EURe_POLYGON;

    console.log(`🔄 Starting withdrawal: ${amount} LP from Gnosis to Polygon`);
    console.log(`📍 From address: ${fromAddress}`);

    // Check balance
    const balance = await destinationClient.readContract({
      address: lpTokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [fromAddress],
    });

    const amountInWei = parseUnits(amount, 18);
    console.log(`💰 Current LP balance: ${formatUnits(balance, 18)} LP`);
    console.log(`💸 Requested amount: ${amount} LP`);

    if (BigInt(balance) < amountInWei) {
      return res.status(400).json({
        error: "Insufficient LP balance",
        required: formatUnits(amountInWei, 18),
        available: formatUnits(balance, 18),
      });
    }

    // Get route
    console.log("🔍 Getting withdraw route...");
    const route = await withTimeout(
      enso.getRouteData({
        chainId: gnosis.id, // Gnosis
        destinationChainId: polygon.id, // Polygon
        tokenIn: [lpTokenAddress],
        tokenOut: [tokenOutPolygon],
        amountIn: [amountInWei.toString()],
        fromAddress,
        receiver: fromAddress,
        routingStrategy: "router",
        slippage: 200,
      }),
      60_000,
      "Route fetching"
    );

    console.log("route", JSON.stringify(route, null, 2));

    if (!route || (!route.tx && !route.to)) {
      return res.status(400).json({
        error: "No route found. Check LP support or amount too small.",
      });
    }

    console.log("✅ Route found");

    const { to, data, value } = route.tx || route;

    if (!to || !data) {
      return res.status(400).json({ error: "Invalid route data received" });
    }

    // Check and handle approval
    console.log("🔍 Checking LP token allowance...");
    const allowance = await destinationClient.readContract({
      address: lpTokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [fromAddress, to],
    });

    let approvalTxHash = null;
    if (BigInt(allowance) < amountInWei) {
      console.log("📝 Insufficient allowance, approving LP token...");
      approvalTxHash = await executeApproval(to, amountInWei);
    } else {
      console.log("✅ Sufficient allowance already exists");
    }

    // Execute main transaction
    console.log("🚀 Executing withdraw transaction...");
    const gasPrice = await getDynamicGasPrice(destinationClient);
    const estimatedGas = await estimateGasWithBuffer(
      destinationClient,
      {
        to,
        data,
        value: BigInt(value || "0"),
      },
      fromAddress
    );

    const txHash = await walletGnosisClient.sendTransaction({
      to,
      data,
      value: BigInt(value || "0"),
      chainId: gnosis.id,
      gas: estimatedGas,
      gasPrice,
    });

    console.log(`🚀 Withdraw transaction sent: ${txHash}`);
    const receipt = await withTimeout(
      destinationClient.waitForTransactionReceipt({ hash: txHash }),
      300_000,
      "Transaction confirmation"
    );
    console.log("✅ Withdraw transaction confirmed on Gnosis");

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
          "Cross-chain withdrawal submitted. Monitor Polygon for EURe tokens.",
        gnosisTx: `https://gnosisscan.io/tx/${txHash}`,
        explorerUrls: {
          gnosis: `https://gnosisscan.io/tx/${txHash}`,
          ...(approvalTxHash && {
            approval: `https://gnosisscan.io/tx/${approvalTxHash}`,
          }),
        },
      },
      meta: {
        fromChain: "Gnosis",
        toChain: "Polygon",
        fromToken: "LP Token",
        toToken: "EURe",
        amount: amount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Withdraw error:", error);

    // Enhanced error handling
    let errorMessage = error.message;
    let errorType = "unknown";

    if (error.message.includes("timed out")) {
      errorType = "timeout";
      errorMessage = "Transaction timed out. It may still be processing.";
    } else if (error.message.includes("gas")) {
      errorType = "gas_error";
      errorMessage =
        "Transaction failed due to gas issues. Try again with higher gas.";
    } else if (error.message.includes("Insufficient")) {
      errorType = "insufficient_balance";
    } else if (error.message.includes("No route")) {
      errorType = "no_route";
      errorMessage =
        "No route found. Try reducing the amount or check LP token support.";
    }

    res.status(500).json({
      error: errorMessage,
      type: errorType,
      timestamp: new Date().toISOString(),
      suggestions: {
        timeout:
          "Check transaction status on block explorer. It may still succeed.",
        gas_error: "The script uses dynamic gas estimation. Try running again.",
        insufficient_balance: "Check your LP token balance.",
        no_route: "Try a smaller amount or verify LP token compatibility.",
      }[errorType],
    });
  }
});

// Get withdrawal quote
// Route: POST /withdraw/quote
router.post("/quote", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({
        error: "Amount is required",
        example: { amount: "2.0" },
      });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: "Invalid amount provided. Must be a positive number",
        received: amount,
      });
    }

    const fromAddress = account.address;
    const lpTokenAddress = TOKEN_ADDRESSES.LP_GNOSIS;
    const tokenOutPolygon = TOKEN_ADDRESSES.EURe_POLYGON;
    const amountInWei = parseUnits(amount, 18);

    // Get route for quote
    const route = await withTimeout(
      enso.getRouteData({
        chainId: 100, // Gnosis
        destinationChainId: 137, // Polygon
        tokenIn: [lpTokenAddress],
        tokenOut: [tokenOutPolygon],
        amountIn: [amountInWei.toString()],
        fromAddress,
        receiver: fromAddress,
        routingStrategy: "router",
        slippage: 200,
      }),
      30_000,
      "Quote fetching"
    );

    if (!route) {
      return res.status(400).json({ error: "No route found for this amount" });
    }

    res.json({
      quote: {
        inputAmount: amount,
        inputToken: "LP Token",
        outputToken: "EURe",
        fromChain: "Gnosis",
        toChain: "Polygon",
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

export { router as withdrawRouter };
