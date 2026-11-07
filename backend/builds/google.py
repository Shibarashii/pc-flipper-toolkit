"""Sign in with Google: check Google's ID token, and pick a new account's username
(docs/specs/google-sign-in.md)."""

import re

from django.conf import settings
from django.contrib.auth import get_user_model
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request
from google.oauth2 import id_token

from .demo import PREFIX as DEMO_PREFIX

User = get_user_model()

# ponytail: fetches Google's public keys on every sign-in. Cache them (they rotate about
# daily) if sign-ins ever get frequent.
REQUEST = Request()

NOT_ALLOWED = re.compile(r"[^A-Za-z0-9@.+_-]")
LONGEST = 140  # leaves room for a number within the 150-character limit


class InvalidToken(Exception):
    """Not a valid Google ID token for this app."""


def verify(credential: str) -> tuple[str, str]:
    """The Google account's `sub` (who it is) and email, from an ID token signed by Google
    for our client id. Raises InvalidToken otherwise."""
    # An empty audience would skip the audience check: never verify without one.
    assert settings.GOOGLE_CLIENT_ID
    try:
        claims = id_token.verify_oauth2_token(
            credential, REQUEST, settings.GOOGLE_CLIENT_ID
        )
    except (ValueError, GoogleAuthError) as e:
        raise InvalidToken from e
    sub, email = claims.get("sub"), claims.get("email")
    if not (isinstance(sub, str) and sub and isinstance(email, str) and email):
        raise InvalidToken
    return sub, email


def username_for(email: str) -> str:
    """The part before the @, kept to what usernames allow, numbered if it's taken."""
    base = NOT_ALLOWED.sub("", email.split("@")[0]) or "user"
    # Reserved: demo cleanup deletes accounts by this prefix (and no password).
    if base.lower().startswith(DEMO_PREFIX):
        base = f"user-{base}"
    base = base[:LONGEST]
    name, n = base, 1
    while User.objects.filter(username__iexact=name).exists():
        n += 1
        name = f"{base}{n}"
    return name
