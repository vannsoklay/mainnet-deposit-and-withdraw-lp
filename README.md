# Cross-Chain Trading API - Modular Structure

A modular Express.js API for cross-chain trading between Polygon and Gnosis chains using the Enso SDK.

## 📁 Project Structure

```
cross-chain-trading-api/
├── app.js                 # Main Express application
├── config/
│   ├── chains.js         # Chain configurations and constants
│   └── clients.js        # Blockchain clients setup
├── routes/
│   ├── account.js        # Account and balance routes
│   ├── deposit.js        # Deposit functionality (Polygon → Gnosis)
│   ├── withdraw.js       # Withdraw functionality (Gnosis → Polygon)
│   └── monitor.js        # Transaction monitoring routes
├── utils/
│   └── helpers.js        # Utility functions and helpers
├── package.json
├── .env.example
└── README.md
```

## 🚀 Quick Start

### 1. Installation

```bash
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env`:

```env
PRIVATE_KEY=your_private_key_here
ENSO_API_KEY=your_enso_api_key_here  # Optional
PORT=3000  # Optional
```

### 3. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## 📚 API Documentation

### Base URL: `http://localhost:3000`

### Core Endpoints

| Method | Endpoint    | Description                           |
| ------ | ----------- | ------------------------------------- |
| GET    | `/health`   | Health check                          |
| GET    | `/`         | API documentation                     |
| GET    | `/account`  | Get account info and balances         |
| POST   | `/deposit`  | Deposit EURe (Polygon) → LP (Gnosis)  |
| POST   | `/withdraw` | Withdraw LP (Gnosis) → EURe (Polygon) |

### Account Routes

| Method | Endpoint                         | Description                |
| ------ | -------------------------------- | -------------------------- |
| GET    | `/account`                       | Get all balances           |
| GET    | `/account/balance/:chain/:token` | Get specific token balance |

### Deposit Routes

| Method | Endpoint         | Description       |
| ------ | ---------------- | ----------------- |
| POST   | `/deposit`       | Execute deposit   |
| POST   | `/deposit/quote` | Get deposit quote |

### Withdraw Routes

| Method | Endpoint          | Description          |
| ------ | ----------------- | -------------------- |
| POST   | `/withdraw`       | Execute withdrawal   |
| POST   | `/withdraw/quote` | Get withdrawal quote |

### Monitor Routes

| Method | Endpoint                         | Description                     |
| ------ | -------------------------------- | ------------------------------- |
| GET    | `/monitor/:txHash`               | Monitor cross-chain transaction |
| GET    | `/monitor/status/:chain/:txHash` | Get transaction status          |
| GET    | `/monitor/history/:chain`        | Get transaction history info    |

## 🔧 Module Details

### `config/chains.js`

- Chain configurations (Polygon, Gnosis)
- Token addresses
- Environment validation

### `config/clients.js`

- Blockchain client setup
- Wallet and public clients
- Enso SDK initialization

### `utils/helpers.js`

- Gas estimation and pricing
- Token information retrieval
- Cross-chain monitoring
- Timeout handling

### `routes/deposit.js`

- Deposit logic (Polygon → Gnosis)
- Token approval handling
- Quote generation

### `routes/withdraw.js`

- Withdrawal logic (Gnosis → Polygon)
- Enhanced gas handling
- Retry mechanisms

### `routes/account.js`

- Balance checking
- Account information
- Multi-chain support

### `routes/monitor.js`

- Transaction monitoring
- Status checking
- History endpoints

## 💡 Usage Examples

### Check Account Balances

```bash
curl http://localhost:3000/account
```

### Get Deposit Quote

```bash
curl -X POST http://localhost:3000/deposit/quote \
  -H "Content-Type: application/json" \
  -d '{"amount": "1.0"}'
```

### Execute Deposit

```bash
curl -X POST http://localhost:3000/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount": "1.0"}'
```

### Execute Withdrawal

```bash
curl -X POST http://localhost:3000/withdraw \
  -H "Content-Type: application/json" \
  -d '{"amount": "2.0"}'
```

### Monitor Transaction

```bash
curl "http://localhost:3000/monitor/0x123...?tokenAddress=0xabc...&maxWaitMinutes=30"
```

### Check Transaction Status

```bash
curl http://localhost:3000/monitor/status/polygon/0x123...
```

## 🔒 Security Features

- Environment variable configuration
- CORS support
- Request validation
- Error handling
- Gas optimization

## 🛠 Development

### Adding New Routes

1. Create a new file in `routes/`
2. Import required dependencies
3. Create Express router
4. Export the router
5. Import and use in `app.js`

### Adding New Chains

1. Update `config/chains.js` with new chain config
2. Add corresponding clients in `config/clients.js`
3. Update token addresses
4. Modify routes as needed

### Error Handling

Each route includes comprehensive error handling with:

- Proper HTTP status codes
- Detailed error messages
- Error categorization
- Helpful suggestions

## 📊 Response Formats

### Success Response

```json
{
  "success": true,
  "txHash": "0x...",
  "receipt": {
    "status": "success",
    "gasUsed": "234567",
    "blockNumber": "12345678"
  },
  "meta": {
    "fromChain": "Polygon",
    "toChain": "Gnosis",
    "timestamp": "2025-08-25T06:24:20.000Z"
  }
}
```

### Error Response

```json
{
  "error": "Insufficient balance",
  "type": "insufficient_balance",
  "timestamp": "2025-08-25T06:24:20.000Z",
  "suggestions": "Check your token balance"
}
```

## 🔍 Monitoring

The API provides extensive logging and monitoring:

- Transaction progress tracking
- Gas estimation details
- Cross-chain settlement monitoring
- Error categorization and suggestions

## 🚨 Troubleshooting

### Common Issues

1. **Environment Variables**: Ensure `PRIVATE_KEY` is set
2. **Network Issues**: Check RPC endpoints are accessible
3. **Gas Errors**: The API handles dynamic gas pricing
4. **Balance Issues**: Use `/account` endpoint to verify balances

### Debug Mode

Start with additional logging:

```bash
DEBUG=* npm run dev
```

## 📝 Contributing

1. Follow the modular structure
2. Add comprehensive error handling
3. Include logging for debugging
4. Update documentation
5. Test all endpoints

## 📄 License

MIT License - see LICENSE file for details
