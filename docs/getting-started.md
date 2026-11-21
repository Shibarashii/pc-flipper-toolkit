# Getting started

How to run PC Flipper Toolkit on your own computer. To just try it, use the
[live app](https://pc-flipper-toolkit.vercel.app) and press **Try the demo**.

## What you need

Python 3.14, Node 24 and a local PostgreSQL server.

```sh
git clone https://github.com/Shibarashii/pc-flipper-toolkit.git
cd pc-flipper-toolkit
createdb pc_flipper_toolkit
```

## The API

It runs on http://localhost:8000, with its docs at http://localhost:8000/api/docs/.

```sh
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

[`backend/.env.example`](../backend/.env.example) says what each setting does.

## The frontend

In a second terminal. It runs on http://localhost:5173, and Vite forwards `/api` to the API.

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173 and sign up, or press **Try the demo**.

## Shop prices

"Find prices" searches a copy of EasyPC's and PC Express's public catalogues. To fill your
own database (about 90 s and 50 MB, so at most once a day):

```sh
cd backend && .venv/bin/python manage.py refresh_shop_prices
```

## Sign in with Google

Optional locally. Without a client id, there's no Google button. To try it, make an OAuth
client as in [the spec's setup](../specs/google-sign-in.md#setup-outside-the-code-the-author-does-these)
and put its id in `backend/.env` (`GOOGLE_CLIENT_ID`) and `frontend/.env`
(`VITE_GOOGLE_CLIENT_ID`).

## Known limits

- Amounts are in pesos (₱) only.
- The log-in rate limit (10 a minute per IP, shared by sign-up, log-in and Try the demo) is
  counted in each server process's memory, and it finds the visitor's IP by counting proxies
  (`NUM_PROXIES`). That's right for one free Render instance; more servers would need a
  shared store like Redis.
- The live API runs on Render's free tier, which sleeps after 15 minutes idle. The first
  request after that takes up to a minute.
