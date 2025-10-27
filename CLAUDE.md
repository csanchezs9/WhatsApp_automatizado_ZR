# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WhatsApp Business bot for an auto parts e-commerce platform (Zona Repuestera). The bot is built with Node.js/Express and integrates with a Django backend API at https://zonarepuestera.com.co.

**Critical Rule:** NEVER modify the Django e-commerce backend (`vehicles_parts_store-main/`). The bot MUST adapt to the e-commerce, not the other way around. The e-commerce is in production serving real customers.

### Advisor Web Panel

The bot includes a professional web panel for advisors to manage WhatsApp conversations in real-time without using the WhatsApp Business app. See `PANEL-ASESOR.md` for complete documentation.

**Panel URL:** `https://whatsapp-automatizado-zr-86dx.onrender.com/`
**Default Credentials:** admin / zonarepuestera2025 (change in production via environment variables)

## Development Commands

### Running the bot
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Testing
The bot uses manual testing via simulation scripts and real WhatsApp messages.

**Local webhook simulation:**
```bash
# Start the bot
npm run dev

# In another terminal, run test scripts
node test-bot.js           # Test basic menu flow
node test-finalizar.js     # Test advisor finalization
node test-casos-extremos.js # Test edge cases
node test-stress.js        # Stress testing
```

**End-to-end testing with ngrok:**
1. Running ngrok: `ngrok http 3000`
2. Configuring the ngrok URL in Meta's webhook settings
3. Sending messages to the WhatsApp number

See `INICIO-RAPIDO-NGROK.md` for detailed ngrok setup instructions.

## Architecture

### Core Service Flow
1. **Webhook Reception** (`src/routes/whatsapp.js:14`) → Receives WhatsApp messages
2. **Message Processing** (`src/controllers/webhookController.js:8`) → Validates and extracts message data
3. **Menu Navigation** (`src/services/menuService.js:437`) → Handles user state machine and menu flow via `handleMenuSelection()`
4. **Conversation Logging** (`src/services/conversationService.js`) → Records all messages to SQLite for advisor panel
5. **Real-time Updates** → WebSocket (Socket.io) notifies advisor panel of new messages
6. **API Communication** → Five service layers:
   - `ecommerceService.js` - Django API for categories/products/subcategories
   - `quoteService.js` - Quote flow for searching by car brand/model
   - `orderService.js` - Order status lookup by email
   - `whatsappService.js` - WhatsApp Business API message sending
   - `conversationService.js` - Conversation storage and retrieval for advisor panel

### State Management
User sessions are stored in-memory in `menuService.js:17` using the `userSessions` object. Key states:
- `MAIN_MENU` - Main menu selection
- `CATEGORY_LIST` - Browsing product categories
- `SUBCATEGORY_LIST` - Browsing subcategories
- `WITH_ADVISOR` - User connected to human advisor
- `WAITING_ADVISOR_QUERY` - Waiting for user's query before connecting to advisor
- `WAITING_EMAIL_FOR_ORDERS` - Waiting for email to look up orders
- `QUOTE_SELECT_BRAND/MODEL/CATEGORY/SUBCATEGORY` - Quote flow states
- `UPDATING_PROMO` - Advisor updating promotional message
- `VIEWING_INFO` - User viewing static information (rejects text input, only buttons)
- `VIEWING_ORDER_DETAILS` - User viewing order details, can select order by number

**Important:** State machine logic is in `handleMenuSelection()` switch statement at `menuService.js:842`

### Advisor Mode & Web Panel

The bot has a dual-mode system:
- **Bot mode** (default): Automated menu navigation with 20-minute inactivity timeout
- **Advisor mode**: User connected to human advisor with 24-hour session timeout

**IMPORTANT:** Advisors now use a web panel instead of WhatsApp. The same WhatsApp number cannot be used simultaneously with the WhatsApp Business API and the WhatsApp Business app.

**Advisor Web Panel Features:**
- Real-time conversation management via browser
- View all active conversations
- Respond to messages directly from panel
- Access 90-day conversation history
- Archive conversations with notes
- WebSocket-based live updates
- Basic Auth security (username/password)

**Panel Access:**
- URL: `https://whatsapp-automatizado-zr-86dx.onrender.com/`
- Credentials: Set via `PANEL_USERNAME` and `PANEL_PASSWORD` environment variables
- Default: admin / zonarepuestera2025

**Panel Architecture:**
- Frontend: HTML/CSS/JS vanilla (served from `src/public/`)
- Backend API: Express routes in `src/routes/panel.js`
- Real-time: Socket.io WebSocket
- Storage: SQLite on Render Disk (1GB at `/opt/render/project/src/data/persistent/`)
- History: 90 days, auto-rotation every 24 hours

See `PANEL-ASESOR.md` for complete panel documentation.

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

**Cleanup mechanism** (`menuService.js:78-98`):
- `cleanupOldSessions()` runs every 24 hours via `setInterval`
- Initial cleanup runs 10 seconds after server start
- Deletes sessions with `lastActivity` older than 24 hours
- Logs cleanup count and active session count

### Promotional Messages
Stored in `src/data/promoMessage.json`. Advisors can update via `/actualizar_promo` command (max 4000 chars).

## Environment Variables

Required variables in `.env`:
- `WHATSAPP_TOKEN` - Meta access token for WhatsApp Business API
- `PHONE_NUMBER_ID` - WhatsApp Business phone number ID
- `WEBHOOK_VERIFY_TOKEN` - Webhook verification token (must match Meta config)
- `ECOMMERCE_API_URL` - Django backend URL (default: `http://localhost:8000/api/v1`)
- `ADVISOR_PHONE_NUMBER` - Phone number for advisor notifications (format: 573XXXXXXXXX) - NO longer used for direct WhatsApp messaging, kept for reference only
- `INACTIVITY_TIMEOUT_MINUTES` - Session timeout in minutes (default: 20)
- `PORT` - Server port (default: 3000)
- `PANEL_USERNAME` - Username for advisor web panel (default: admin)
- `PANEL_PASSWORD` - Password for advisor web panel (default: zonarepuestera2025)
- `NODE_ENV` - Environment (development/production)

## Deployment

The bot is deployed to Render.com using the `render.yaml` configuration.

**Render.yaml configuration:**
- Service type: `web`
- Runtime: Node.js
- Region: Oregon
- Plan: `starter` (required - Free plan sleeps and breaks webhooks)
- Root directory: `wpp/`
- Build command: `npm install`
- Start command: `npm start`
- Health check: `/webhook`

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

## Key Functions and Locations

**Main entry points:**
- `handleMenuSelection()` - `menuService.js:429` - Main message router and state machine
- `showMainMenu()` - `menuService.js:1084` - Display main interactive menu
- `activateAdvisorMode()` - `menuService.js:204` - Connect user to human advisor
- `finalizeAdvisorConversation()` - `menuService.js:285` - Advisor closes conversation

**Category/Product navigation:**
- `showCategories()` - `menuService.js:1288` - Display product categories
- `showSubCategories()` - `menuService.js:1366` - Display subcategories
- `showProducts()` - `menuService.js:1456` - Display products in subcategory

**Quote flow (search by car):**
- `startQuoteFlow()` - `menuService.js:1721` - Initiate quote by brand/model
- `showCarBrands()` - `menuService.js:1749` - Display car brands
- `showCarModels()` - `menuService.js:1784` - Display car models
- `searchQuoteProducts()` - `menuService.js:1898` - Search products by filters

**Orders:**
- `handleOrdersEmailInput()` - `menuService.js:1550` - Process email for order lookup
- `handleOrderSelection()` - `menuService.js:1655` - Show order details

**Session management:**
- `isSessionExpired()` - `menuService.js:106` - Check 7-minute inactivity timeout
- `updateLastActivity()` - `menuService.js:130` - Update session timestamp
- `cleanupOldSessions()` - `menuService.js:78` - Remove 24h+ old sessions

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

- **Subcategories returning empty** - This is expected behavior when no products have stock. Do not try to "fix" this. The Django API filters by `stock > 0` and `base_price > 0`.
- **Session memory leaks** - Automatic cleanup runs every 24h, but monitor `userSessions` size in logs.
- **Webhook not responding** - Check `WEBHOOK_VERIFY_TOKEN` matches Meta configuration exactly.
- **Messages not sending** - Verify `WHATSAPP_TOKEN` and `PHONE_NUMBER_ID` are current and valid.
- **User stuck in a state** - Check session state in `userSessions[userPhone].state`. States like `VIEWING_INFO` reject text input and only accept button presses.
- **Advisor commands not working** - Verify the sender's phone matches `ADVISOR_PHONE_NUMBER` environment variable exactly.
- **Timeout not working** - Inactivity timeout (7min) only applies in bot mode, NOT when user is with advisor. Advisor conversations have 24h timeout.
