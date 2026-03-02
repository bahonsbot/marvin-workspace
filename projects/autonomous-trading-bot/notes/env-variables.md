# Environment Variables - Autonomous Trading Bot

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `APP_ENV` | Application environment (development/production) | - | Yes |
| `PAPER_MODE` | Use paper trading (no real money) | `true` | Yes |
| `PAPER_EXECUTE` | Enable paper trade execution | `true` | Yes |
| `KILL_SWITCH` | Global kill switch to halt all trading | `true` | Yes |
| `DAILY_LOSS_CAP` | Maximum daily loss before stopping ($) | `100.0` | Yes |
| `MAX_POSITION_SIZE` | Maximum position size in shares | `1` | Yes |
| `MAX_OPEN_POSITIONS` | Maximum concurrent open positions | `3` | Yes |
| `ALPACA_API_KEY` | Alpaca API key for market data & orders | - | Yes |
| `ALPACA_API_SECRET` | Alpaca API secret | - | Yes |
| `ALPACA_BASE_URL` | Alpaca API endpoint | `https://paper-api.alpaca.markets` | Yes |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key (for route/geolocation features) | - | Optional |

## Notes

- Currently running in **paper-only** mode with placeholder API keys
- Kill switch is `true` by default — set to `false` to enable live trading
- All risk parameters have conservative defaults for safety
