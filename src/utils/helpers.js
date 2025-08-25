import { formatUnits, erc20Abi, parseGwei } from "viem";

// Helper function to safely convert BigInt to string
export const safeBigIntToString = (value) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

// Helper function to check if an address is a valid contract
export const isValidContract = async (client, address) => {
  try {
    const code = await client.getBytecode({ address });
    return code && code !== "0x";
  } catch {
    return false;
  }
};

// Helper function to get token info
export const getTokenInfo = async (client, tokenAddress, userAddress) => {
  try {
    const [name, symbol, decimals, balance] = await Promise.all([
      client
        .readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "name",
        })
        .catch(() => "Unknown"),
      client
        .readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "symbol",
        })
        .catch(() => "Unknown"),
      client
        .readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "decimals",
        })
        .catch(() => 18),
      client
        .readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [userAddress],
        })
        .catch(() => 0n),
    ]);

    return { name, symbol, decimals, balance };
  } catch (error) {
    console.error(
      `Error getting token info for ${tokenAddress}:`,
      error.message
    );
    return null;
  }
};

// Timeout wrapper
export const withTimeout = (promise, ms, label = "Operation") =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ]);

// Dynamic gas price calculation
export const getDynamicGasPrice = async (client) => {
  try {
    const gasPrice = await client.getGasPrice();
    console.log(`📊 Current gas price: ${formatUnits(gasPrice, 9)} gwei`);
    const bufferedGasPrice = (gasPrice * 150n) / 100n;
    console.log(`📊 Using gas price: ${formatUnits(bufferedGasPrice, 9)} gwei`);
    return bufferedGasPrice;
  } catch (error) {
    console.log("Failed to get gas price, using fallback:", error.message);
    return parseGwei("5");
  }
};

// Gas estimation with buffer
export const estimateGasWithBuffer = async (client, txParams, fromAddress) => {
  try {
    const estimatedGas = await client.estimateGas({
      ...txParams,
      account: fromAddress,
    });
    const bufferedGas = (estimatedGas * 150n) / 100n;
    console.log(`⛽ Estimated gas: ${estimatedGas}, Using: ${bufferedGas}`);
    return bufferedGas;
  } catch (error) {
    console.log("Gas estimation failed, using fallback:", error.message);
    return 800000n;
  }
};

// Monitor cross-chain transaction
export const monitorCrossChainTransaction = async (
  txHash,
  expectedTokenAddress,
  fromAddress,
  destinationClient,
  maxWaitMinutes = 30
) => {
  const startTime = Date.now();
  const maxWaitTime = maxWaitMinutes * 60 * 1000;

  console.log(`🔍 Monitoring cross-chain transaction: ${txHash}`);

  const contractExists = await isValidContract(
    destinationClient,
    expectedTokenAddress
  );
  if (!contractExists) {
    console.log(
      `❌ Token contract ${expectedTokenAddress} does not exist on destination chain`
    );
    return false;
  }

  const tokenInfo = await getTokenInfo(
    destinationClient,
    expectedTokenAddress,
    fromAddress
  );
  if (tokenInfo) {
    console.log(`📊 Token Info: ${tokenInfo.name} (${tokenInfo.symbol})`);
    console.log(
      `💰 Initial balance: ${formatUnits(
        tokenInfo.balance,
        tokenInfo.decimals
      )}`
    );
  }

  let attempts = 0;
  while (Date.now() - startTime < maxWaitTime) {
    attempts++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    try {
      const currentBalance = await destinationClient.readContract({
        address: expectedTokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [fromAddress],
      });

      console.log(
        `⏳ Check ${attempts} (${elapsed}s elapsed): Balance = ${formatUnits(
          currentBalance,
          tokenInfo?.decimals || 18
        )}`
      );

      if (currentBalance > 0n) {
        console.log(
          `✅ Success! Received ${formatUnits(
            currentBalance,
            tokenInfo?.decimals || 18
          )} tokens`
        );
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 30000));
    } catch (error) {
      console.log(`❌ Error checking balance: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }

  console.log(`⏱️ Timeout reached after ${maxWaitMinutes} minutes`);
  return false;
};
