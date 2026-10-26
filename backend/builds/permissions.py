import secrets

from django.conf import settings
from rest_framework.permissions import SAFE_METHODS, BasePermission


class HasAccessKey(BasePermission):
    """Anyone can read. Writes need the X-Access-Key header to match ACCESS_KEY;
    with no ACCESS_KEY set, every write is refused."""

    message = "Writes need a valid X-Access-Key header."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        key = settings.ACCESS_KEY
        given = request.headers.get("X-Access-Key", "")
        # Bytes, because compare_digest raises on non-ASCII str.
        return bool(key) and secrets.compare_digest(given.encode(), key.encode())
