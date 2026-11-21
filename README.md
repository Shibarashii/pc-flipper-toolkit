<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="frontend/public/logo-dark.png">
    <img src="frontend/public/logo-light.png" alt="" width="96" height="96">
  </picture>
</p>

<h1 align="center">PC Flipper Toolkit</h1>

<p align="center">
  <strong>Track your profit on every PC you flip.</strong><br>
  For people who flip PCs. Log each part, bundle and extra cost, and the app does the math.
</p>

<p align="center">
  <a href="https://github.com/Shibarashii/pc-flipper-toolkit/actions/workflows/ci.yml"><img src="https://github.com/Shibarashii/pc-flipper-toolkit/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4">
  <img src="https://img.shields.io/badge/Django-6-092E20?logo=django&logoColor=white" alt="Django 6">
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://pc-flipper-toolkit.vercel.app"><strong>Open the app</strong></a> ·
  <a href="https://pc-flipper-toolkit.vercel.app"><strong>Try the demo</strong></a>, no sign-up needed ·
  <a href="https://pc-flipper-toolkit.onrender.com/api/docs/">API docs</a>
</p>

<p align="center">
  <img src="docs/images/build-page.png" alt="A sold build's page: its parts in the case, the checklist and the profit">
  <br>
  <sub>A sold build: ₱4,200 profit on a Ryzen 5 5600 and RX 6600, from the demo.</sub>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="docs/getting-started.md">Getting started</a> ·
  <a href="docs/testing.md">Testing</a> ·
  <a href="docs/deployment.md">Deployment</a> ·
  <a href="#license">License</a>
</p>

> The API runs on Render's free tier, which sleeps after 15 minutes idle. The first visit
> after that takes up to a minute.

## Features

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/images/diagram.png" alt="The Build section: a case filling up with parts beside the checklist">
      <br><sub>The case fills in as you add parts.</sub>
      <h3>Every flip, part by part</h3>
      <p>Each build shows its parts, what's still missing, and the profit as it adds up, with the margin and what you saved.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/images/parts.png" alt="The parts table: a bundle and its parts, each with its shop price and what was paid">
      <br><sub>Shop price and what you paid, part by part.</sub>
      <h3>What it tracks</h3>
      <p>Parts with their shop price and what you paid; a bundle counts once. Extra costs like shipping, platform fees and thermal paste.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/images/builds-list.png" alt="The builds list with each build's status, total cost, selling price and profit">
      <br><sub>Every build at a glance.</sub>
      <h3>See where each PC is</h3>
      <p>Planning, building, listed or sold, with each build's cost, price and profit.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/images/price-lookup.png" alt="Find prices: shop listings for an RX 6600 while editing a part">
      <br><sub>Prices from EasyPC and PC Express.</sub>
      <h3>Find prices</h3>
      <p>Search the shops' catalogues while you edit a part, and pick one to fill in its price and shop.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/images/listing.png" alt="Copy listing: the build written as a Facebook Marketplace post">
      <br><sub>Ready for Facebook Marketplace.</sub>
      <h3>Copy the listing</h3>
      <p>The build as a Marketplace post, with each part, its condition and the price.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/images/light-and-dark.png" alt="The build page split down the middle, light on the left and dark on the right">
      <br><sub>Follows your system, or pick one.</sub>
      <h3>Light and dark</h3>
      <p>Warm paper by day, ink by night, on desktop and phone.</p>
    </td>
  </tr>
</table>

## Built with

React 19, TypeScript, Vite and Tailwind CSS on Vercel; Django 6 and Django REST Framework on
Render; PostgreSQL on Neon. Money is stored as `Decimal` and travels as strings, so totals are
exact to the centavo.

To run it yourself, see [Getting started](docs/getting-started.md), then
[Testing](docs/testing.md) and [Deployment](docs/deployment.md).

## License

[MIT](LICENSE)
