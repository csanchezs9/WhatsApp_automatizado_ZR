# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WhatsApp Business bot for an auto parts e-commerce platform (Zona Repuestera). The bot is built with Node.js/Express and integrates with a Django backend API at https://zonarepuestera.com.co.

**Critical Rule:** NEVER modify the Django e-commerce backend (`vehicles_parts_store-main/`). The bot MUST adapt to the e-commerce, not the other way around. The e-commerce is in production serving real customers.

## Development Commands

### Running the bot
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Testing
The bot doesn't have automated tests. Test manually by:
1. Running ngrok: `ngrok http 3000`
2. Configuring the ngrok URL in Meta's webhook settings
3. Sending messages to the WhatsApp number

## Architecture

### Core Service Flow
1. **Webhook Reception** (`src/routes/whatsapp.js`) → Receives WhatsApp messages
2. **Message Processing** (`src/controllers/webhookController.js`) → Validates and extracts message data
3. **Menu Navigation** (`src/services/menuService.js`) → Handles user state machine and menu flow
4. **API Communication** → Three service layers:
   - `ecommerceService.js` - Django API for categories/products
   - `quoteService.js` - Quote flow for searching by car brand/model
   - `orderService.js` - Order status lookup
   - `whatsappService.js` - WhatsApp Business API sending

### State Management
User sessions are stored in-memory in `menuService.js` using the `userSessions` object. Key states:
- `MAIN_MENU` - Main menu selection
- `CATEGORY_LIST` - Browsing product categories
- `SUBCATEGORY_LIST` - Browsing subcategories
- `WITH_ADVISOR` - User connected to human advisor
- `WAITING_ADVISOR_QUERY` - Waiting for user's query before connecting to advisor
- `WAITING_EMAIL_FOR_ORDERS` - Waiting for email to look up orders
- `QUOTE_SELECT_BRAND/MODEL/CATEGORY/SUBCATEGORY` - Quote flow states
- `UPDATING_PROMO` - Advisor updating promotional message

### Advisor Mode
The bot has a dual-mode system:
- **Bot mode** (default): Automated menu navigation with 7-minute inactivity timeout
- **Advisor mode**: User connected to human advisor with 24-hour session timeout

When in advisor mode, the bot forwards messages to `ADVISOR_PHONE_NUMBER` and doesn't auto-respond. Users can exit by typing "menú" or "menu". Advisors can finalize conversations with `/finalizar` command.

Business hours for advisor connections (Colombia time):
- Monday-Friday: 7:00 AM - 5:00 PM
- Saturday: 8:00 AM - 1:00 PM
- Sunday: Closed

### API Integration Points

**Django E-commerce API** (`ECOMMERCE_API_URL`):
- `GET /catalog/categorias/` - Product categories
- `GET /catalog/sub-categorias/?category={id}` - Subcategories (filtered by stock>0, price>0)
- `GET /products/products/?subcategory={id}` - Products by subcategory
- `GET /catalog/marcas/` - Car brands
- `GET /catalog/modelos/?brand={id}` - Car models
- `GET /orders/?email={email}` - Orders by email

The API automatically filters subcategories to only show those with available products (stock > 0, base_price > 0). The bot must display exactly what the API returns - do not attempt to work around or modify this filtering.

### Session Cleanup
Automatic cleanup of old sessions (24h+) runs every 24 hours to prevent memory leaks. This is critical since sessions are in-memory.

### Promotional Messages
Stored in `src/data/promoMessage.json`. Advisors can update via `/actualizar_promo` command (max 4000 chars).

## Environment Variables

Required variables in `.env`:
- `WHATSAPP_TOKEN` - Meta access token for WhatsApp Business API
- `PHONE_NUMBER_ID` - WhatsApp Business phone number ID
- `WEBHOOK_VERIFY_TOKEN` - Webhook verification token (must match Meta config)
- `ECOMMERCE_API_URL` - Django backend URL (default: `http://localhost:8000/api/v1`)
- `ADVISOR_PHONE_NUMBER` - Phone number for advisor notifications (format: 573XXXXXXXXX)
- `INACTIVITY_TIMEOUT_MINUTES` - Session timeout in minutes (default: 7)
- `PORT` - Server port (default: 3000)

## Deployment

The bot is deployed to Render.com using the `render.yaml` configuration. Root directory is `wpp/`.

**Important:** Use the Starter plan ($7/month), not the Free plan, as the Free plan sleeps and breaks WhatsApp webhook delivery.

See `DEPLOY-CHECKLIST.md` for complete deployment instructions.

## Key Constraints and Patterns

1. **Never modify Django backend** - See `INSTRUCCIONES-IMPORTANTES.md` for full rationale
2. **Session-based navigation** - All user state lives in `userSessions[userPhone]`
3. **Timeout handling** - Two separate timeouts:
   - 7-minute inactivity for bot mode (resets session)
   - 24-hour maximum for advisor conversations (auto-closes)
4. **Advisor commands** (phone must match `ADVISOR_PHONE_NUMBER`):
   - `/finalizar` - Close client conversation(s)
   - `/actualizar_promo` - Update promotional message
   - `/comandos` - Show all admin commands
5. **WhatsApp limits** - Messages max 4096 chars, button text max 20 chars, lists max 10 items
6. **Product links** - Always generate web links: `https://zonarepuestera.com.co/products/?category={id}&subcategory={id}`
7. **Interactive elements** - Use `sendInteractiveButtons` (max 3 buttons) or `sendInteractiveList` (max 10 items)

## Contact Configuration

Test user: +57 317 374 5021
Advisor: +57 316 4088588
Test WhatsApp number: +1 555 166 6254

## Menu Structure

Main menu options (via interactive list):
1. 🔍 Cotizar autoparte - Search by car brand/model
2. 📦 Ver catálogo - Browse categories
3. 📦 Estado de pedido - Check order status
4. 🛡️ Garantías y devoluc. - Warranty info
5. 🔥 Promociones - Current promotions
6. 📮 Envío y pagos - Shipping/payment info
7. 📍 Puntos de entrega - Pickup locations
8. 💬 Hablar con asesor - Connect to human advisor
9. 🕒 Ver horarios - Business hours

## Common Issues

- **Subcategories returning empty** - This is expected behavior when no products have stock. Do not try to "fix" this.
- **Session memory leaks** - Automatic cleanup runs every 24h, but monitor `userSessions` size.
- **Webhook not responding** - Check `WEBHOOK_VERIFY_TOKEN` matches Meta configuration.
- **Messages not sending** - Verify `WHATSAPP_TOKEN` and `PHONE_NUMBER_ID` are current.
