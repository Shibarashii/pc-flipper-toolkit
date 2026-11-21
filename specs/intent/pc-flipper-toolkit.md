# Intent: PC Flipper Toolkit

Confirmed 2026-10-25.

- **Outcome:** A web app where each PC flip is a build, and each build lists its parts (name, shop, listed price, bought-for price) plus extra costs entered once per build (shipping, platform fees, paste and cables). It shows listed total, actual cost, selling price, profit, and how far below market you're selling.
- **User:** The author, a single user. No login in v1.
- **Currency:** PHP (₱).
- **Why now:** The author flips PCs and tracks this one row per part in a spreadsheet. They want true profit, extra costs included, and a market-based guide for setting the selling price.
- **Success:** A real flip is logged from start to finish in the app instead of the spreadsheet. The profit number includes every cost. It's deployed with a public link, works on a phone, and is clean enough to show as a portfolio piece.
- **Constraint:** Listed prices are entered by hand in v1. One person builds it.
- **Stack:** Django backend, React frontend, Tailwind CSS.
- **Out of scope (v1):** Price scraping, voucher detection, buyer-only build mode, multiple users or logins, and part compatibility checks. These come later, starting with scraping.
