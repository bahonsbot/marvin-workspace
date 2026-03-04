# Webhook HTTPS Setup (Hostinger VPS)

Target:
- Public URL: `https://tradehook.motiondisplay.cloud/webhook`
- Local bot receiver: `http://127.0.0.1:8000/webhook`

## 1) Install Nginx + Certbot (on VPS host as root)

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

## 2) Create Nginx site

```bash
sudo tee /etc/nginx/sites-available/tradehook.motiondisplay.cloud >/dev/null <<'EOF'
server {
    listen 80;
    server_name tradehook.motiondisplay.cloud;

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /webhook {
        proxy_pass http://127.0.0.1:8000/webhook;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/tradehook.motiondisplay.cloud /etc/nginx/sites-enabled/tradehook.motiondisplay.cloud
sudo nginx -t
sudo systemctl reload nginx
```

## 3) Issue HTTPS certificate

```bash
sudo certbot --nginx -d tradehook.motiondisplay.cloud --redirect -m you@example.com --agree-tos --no-eff-email
```

## 4) Firewall

Open 80/443 to internet on VPS firewall/security group.

## 5) Verify

```bash
curl -s https://tradehook.motiondisplay.cloud/health
```

Expected:
```json
{"ok": true, "paper_only": true}
```

## TradingView Alert payload

Use this JSON body:

```json
{
  "symbol": "AAPL",
  "side": "buy",
  "qty": 1,
  "timestamp": "{{timenow}}",
  "secret": "<WEBHOOK_SHARED_SECRET>"
}
```

Webhook URL:
`https://tradehook.motiondisplay.cloud/webhook`

## Notes
- Receiver currently runs local-only (`127.0.0.1:8000`) by design.
- Shared secret is required (payload field `secret`).
- Do not expose port 8000 publicly.
