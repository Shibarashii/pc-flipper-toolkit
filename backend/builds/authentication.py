"""How each request's token is checked. Kept apart from auth.py's views: DRF imports
this while it loads its own views, so importing rest_framework.views here would loop."""

from datetime import timedelta

from django.utils import timezone
from rest_framework import exceptions
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token

from .demo import is_expired_demo

# Counted from when the token was made, not from its last use: a stolen token stops
# working within this long even if it's being used.
TOKEN_LIFETIME = timedelta(days=30)


def expired(token: Token) -> bool:
    return token.created < timezone.now() - TOKEN_LIFETIME


class ExpiringTokenAuthentication(TokenAuthentication):
    """DRF's token auth, but a token older than TOKEN_LIFETIME, or a demo account older
    than its 24 hours, is refused (and the token deleted)."""

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        if expired(token) or is_expired_demo(user):
            token.delete()
            raise exceptions.AuthenticationFailed("Token expired. Log in again.")
        return user, token
