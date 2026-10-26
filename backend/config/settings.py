import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
# Fills os.environ from backend/.env; real env vars (e.g. on Render) take precedence.
load_dotenv(BASE_DIR / ".env")

DEBUG = os.environ.get("DEBUG", "0") == "1"
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-insecure-key")
if not DEBUG and SECRET_KEY == "dev-only-insecure-key":
    raise RuntimeError("Set SECRET_KEY when DEBUG is off.")

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
CORS_ALLOWED_ORIGINS = [
    o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o
]

INSTALLED_APPS = [
    # Django admin at /admin/ and what it needs (users, sessions, its CSS/JS).
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "builds",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Only used by the admin and the API docs pages (Swagger UI at /api/docs/).
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

STATIC_URL = "static/"

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": dj_database_url.config(
        default="postgres:///pc_flipper_toolkit", conn_max_age=600
    ),
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Manila"
USE_I18N = False
USE_TZ = True

# JSON only. The API has no users or sessions (write protection comes from an access
# key); those exist only for logging in to the admin.
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# OpenAPI schema at /api/schema/, interactive docs at /api/docs/.
SPECTACULAR_SETTINGS = {
    "TITLE": "PC Flipper Toolkit API",
    "DESCRIPTION": (
        "Track the parts, extra costs and profit of each PC you build and resell.\n\n"
        '**Money** is always a decimal string with 2 places in PHP (`"12500.00"`), '
        "never a float.\n\n"
        "**Totals** are computed by the server and read-only. Fields that depend on "
        "the selling price are `null` until one is set.\n\n"
        "**Errors**: invalid input returns `400` with the problem fields as keys, "
        '`{"listed_price": ["Must be 0 or more."]}`. '
        "A missing id returns `404`."
    ),
    "VERSION": "1.0.0",
    # Separate request/response schemas, so read-only fields (id, totals) don't
    # show up as inputs.
    "COMPONENT_SPLIT_REQUEST": True,
    "SERVE_INCLUDE_SCHEMA": False,
}
