import "dotenv/config";
import express from "express";
import cors from "cors";
import { depositRouter } from "./src/routes/deposit.js";
import { withdrawRouter } from "./src/routes/withdraw.js";
import { accountRouter } from "./src/routes/account.js";
import { monitorRouter } from "./src/routes/monitor.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "1.0.0",
  });
});

// API documentation endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Cross-Chain Trading API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "GET /health",
      account: "GET /account",
      deposit: "POST /deposit",
      depositQuote: "POST /deposit/quote",
      withdraw: "POST /withdraw",
      withdrawQuote: "POST /withdraw/quote",
      monitor: "GET /monitor/:txHash",
      status: "GET /monitor/status/:chain/:txHash",
    },
    documentation: "Cross-chain trading between Polygon and Gnosis chains",
  });
});

// Mount routes with proper prefixes
app.use("/account", accountRouter);
app.use("/deposit", depositRouter);
app.use("/withdraw", withdrawRouter);
app.use("/monitor", monitorRouter);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({
    error: "Internal server error",
    timestamp: new Date().toISOString(),
    message: error.message,
  });
});

// 404 handler
// app.use("*", (req, res) => {
//   res.status(404).json({
//     error: "Route not found",
//     path: req.originalUrl,
//     method: req.method,
//     availableRoutes: [
//       "GET /health",
//       "GET /account",
//       "POST /deposit",
//       "POST /deposit/quote",
//       "POST /withdraw",
//       "POST /withdraw/quote",
//       "GET /monitor/:txHash",
//       "GET /monitor/status/:chain/:txHash",
//     ],
//     timestamp: new Date().toISOString(),
//   });
// });

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Cross-chain trading API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💰 Account info: http://localhost:${PORT}/account`);
  console.log(`📝 API Endpoints:`);
  console.log(`   POST /deposit - Deposit EURe (Polygon) → LP (Gnosis)`);
  console.log(`   POST /deposit/quote - Get deposit quote`);
  console.log(`   POST /withdraw - Withdraw LP (Gnosis) → EURe (Polygon)`);
  console.log(`   POST /withdraw/quote - Get withdraw quote`);
  console.log(`   GET /monitor/:txHash - Monitor cross-chain transaction`);
  console.log(`   GET /monitor/status/:chain/:txHash - Get transaction status`);
  console.log(`📖 Full API docs: http://localhost:${PORT}/`);
});

export default app;
