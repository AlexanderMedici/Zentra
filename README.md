Finsage is a Next.js app that helps retail investors research, track, and optimize their portfolios. It combines a clean UI, real‑time market data, daily news summaries, proactive price alerts, and quantitative portfolio tools (Markowitz MVO, Sharpe, CAPM, and a simplified Black–Litterman model).
Note most features that use cron jobs via inngest daily news and or alert ai agent  have been disabled as it is free tier and has limits as to how much it can be used.. App will allow  user acount creation logout add stocks from trading view portfoilio analysis is disabled. This is an example not a fully fucntional app as the costs do add up.   


## Project-Website 
[Project-Website-Link]
<a href="https://finsage-rose.vercel.app/">Finsage Link</a>

Why this app? (Practical use case)
----------------------------------

You track a handful of stocks and don’t want to miss major moves or news. Zentra lets you:

*   Search tickers, add them to a watchlist, and see live prices and metrics.
    
*   Get daily news summaries tailored to your watchlist, directly in your inbox.
    
*   Set price alerts (e.g., “AAPL ≥ $220”) and receive emails when they trigger.
    
*   Analyze your portfolio with risk/return tools and suggested rebalance targets.
    

This reduces noise and makes rebalancing decisions more systematic.

Features
--------

*   Watchlist management
    
    *   Add/remove stocks, round‑robin curated news (max 6 articles).
        
    *   Server‑safe DB operations via Mongoose.
        
*   Stock search and details
    
    *   Symbol search powered by Finnhub.
        
    *   Detail pages with price, change, P/E, market cap, and TradingView widgets.
        
*   Market news
    
    *   Company and general news via Finnhub.
        
    *   Daily news summary emails (Inngest cron at 12:00 UTC) with AI summarization.
        
*   Alerts (email notifications)
    
    *   Create price alerts per symbol, delivered via email (Nodemailer).
        
    *   Alert de‑duplication: once an alert triggers it’s deactivated to prevent spam.
        
    *   Notification preferences (email/SMS placeholder; SMS provider not yet wired).
        
*   Portfolio & performance optimization
    
    *   Computes daily returns from candles, annualizes mean/volatility.
        
    *   Markowitz Mean‑Variance Optimization (long‑only; Σ⁻¹μ heuristic).
        
    *   Sharpe ratio, CAPM expected returns vs proxy (SPY/QQQ/VOO or composite).
        
    *   Simplified Black–Litterman weights (equal‑weight prior, no views input yet).
        
    *   Rebalance suggestions (equal/current → MVO/BL targets) + CSV export.
        
*   In‑app chat assistant (Inngest AI)
    
    *   Uses OpenAI or Gemini depending on env.
        
    *   Stores chat threads/messages in MongoDB.
        

Tech stack
----------

*   App: Next.js 15, React 19, TypeScript, Tailwind CSS
    
*   Data + Auth: MongoDB (Mongoose), Better Auth
    
*   Jobs + AI: Inngest (cron + event), OpenAI/Gemini for summaries/chat
    
*   Email: Nodemailer (Gmail transport by default), HTML templates
    
*   Market data: Finnhub API
    
*   UI: Radix primitives (customized), TradingView widgets, Lucide icons
    

Project structure
-----------------

*   app/ — Next.js routes (pages for dashboard, watchlist, alerts, portfolio, APIs)
    
*   components/ — UI components (Watchlist, SearchCommand, Alerts, etc.)
    
*   database/models/ — Mongoose models (watchlist, chat, alerts, notification prefs)
    
*   hooks/ — Reusable hooks (e.g., useDebounce with unmount cleanup)
    
*   lib/actions/ — Server actions (finnhub, watchlist, alerts, users, portfolio)
    
*   lib/inngest/ — Inngest client, functions, and prompts
    
*   lib/nodemailer/ — Mailer and HTML templates (welcome, news, alerts)
    
*   types/ — Global TypeScript types
    

Environment variables
---------------------

Create a .env with the following (only those you need):

*   MongoDB
    
    *   MONGODB\_URI=...
        
*   Finnhub
    
    *   FINNHUB\_API\_KEY=... (or NEXT\_PUBLIC\_FINNHUB\_API\_KEY=...)
        
    *   Optional: FINNHUB\_MARKET\_PROXY=SPY (fallbacks to QQQ/VOO or composite)
        
*   Inngest
    
    *   INNGEST\_EVENT\_KEY=... or INNGEST\_SIGNING\_KEY=...
        
*   Email (Nodemailer)
    
    *   NODEMAILER\_EMAIL=you@example.com
        
    *   NODEMAILER\_PASSWORD=...
        
*   App base URL (for absolute email image links)
    
    *   NEXT\_PUBLIC\_APP\_URL=https://yourdomain.com (or APP\_BASE\_URL=...)
        
*   AI providers (optional)
    
    *   OPENAI\_API\_KEY=...
        
    *   GEMINI\_API\_KEY=...
        

Development
-----------

\# Installnpm install# Run dev server (http://localhost:3000)npm run dev# Build productionnpm run buildnpm run start# Lint & formatnpm run lintnpm run format

Inngest jobs
------------

This app defines several Inngest functions, including:

*   sendDailyNewsSummary — cron “0 12 \* \* \*” and app/send.daily.news
    
*   processPriceAlerts — cron “\*/10 \* \* \* \*” and app/alerts.process
    

Use the Inngest Dev Server or Dashboard to dispatch test events:

*   app/send.daily.news — triggers daily news summary email flow.
    
*   app/alerts.process — evaluates active alerts and emails any that trigger.
    

Notes & design choices
----------------------

*   Alerts are deactivated after the first trigger to avoid repeated email sends while price stays beyond the threshold. Users can re‑enable or recreate alerts.
    
*   Market proxy for CAPM/beta defaults to SPY but falls back to a composite of watchlist assets if the proxy is unavailable (e.g., free API 403).
    
*   Candle requests have a small in‑memory cache to reduce API calls during a single server runtime.
    
*   Email templates use absolute logo URLs computed from NEXT\_PUBLIC\_APP\_URL/APP\_BASE\_URL.
    
*   Host validation in API routes allows multi‑value x-forwarded-host entries.
    

Roadmap
-------

*   Persist user views and implement full Black–Litterman (P, Q, Ω inputs) in UI.
    
*   Wire SMS via Twilio (or similar) using phoneAllowed and phoneNumber prefs.
    
*   Efficient frontier visualization and multi‑objective optimization (risk target).
    
*   Persist custom portfolio weights per user.
    

Disclaimer
----------

This project is for educational and informational purposes only and does not constitute financial advice. Always do your own research.
