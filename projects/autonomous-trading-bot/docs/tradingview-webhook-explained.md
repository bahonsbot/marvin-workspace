# TradingView Webhook Concept Explained

## What is a Webhook?

A webhook is like a **push notification** — instead of your bot constantly checking "is there a new signal?" (polling), TradingView **pushes** a message to your bot when your indicator triggers.

## How It Works

### 1. You Create an Indicator in TradingView
```pine
// Example: Simple EMA Crossover
ema20 = ta.ema(close, 20)
ema50 = ta.ema(close, 50)

longCondition = ta.crossover(ema20, ema50)
shortCondition = ta.crossunder(ema20, 50)

if (longCondition)
    alert("BUY {{ticker}} at {{close}}")

if (shortCondition)    
    alert("SELL {{ticker}} at {{close}}")
```

### 2. Configure Alert in TradingView
- Create alert based on indicator
- Set "Webhook URL" to your bot's endpoint
- Message: `{"action": "buy", "ticker": "AAPL", "price": 150.00}`

### 3. Your Bot Receives the Webhook
```
TradingView Server → Your VPS (webhook endpoint) → Parse JSON → Execute trade
```

## The Stack

| Component | What It Does |
|-----------|--------------|
| **Pine Script** | Indicator logic (EMA, RSI, etc.) |
| **TradingView** | Monitors charts, triggers alerts |
| **Webhook** | Sends JSON to your server |
| **Node.js/Python** | Receives webhook, decides to trade |
| **Alpaca API** | Actually buys/sells the stock |

## Simple Example

**TradingView Alert:**
```
Webhook URL: https://your-vps.com/webhook
Message: {"symbol": "AAPL", "action": "BUY", "price": "150.00"}
```

**Your Bot (Node.js):**
```javascript
app.post('/webhook', (req, res) => {
  const { symbol, action, price } = req.body;
  
  if (action === 'BUY') {
    alpaca.createOrder({
      symbol: symbol,
      qty: 10,
      side: 'buy',
      type: 'market'
    });
  }
});
```

## Why This Setup?

1. **TradingView** — Best charts, free indicators, web-based
2. **Webhooks** — Real-time, no polling needed
3. **Alpaca** — Free paper trading, easy API

## For This Project

We'll use:
- Custom Pine Script indicators (EMA ribbons, Stoch RSI, TTM Squeeze)
- Node.js webhook receiver on VPS
- Alpaca for execution (paper first)
