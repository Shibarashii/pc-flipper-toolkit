from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError

from builds.prices import SHOPS, RefreshError, refresh

# Network/HTTP errors are OSError, bad JSON is ValueError, a missing field KeyError or
# TypeError, a bad price decimal.InvalidOperation (an ArithmeticError), and a price
# that doesn't fit the column a DatabaseError.
FAILURES = (
    RefreshError,
    OSError,
    ValueError,
    KeyError,
    TypeError,
    ArithmeticError,
    DatabaseError,
)


class Command(BaseCommand):
    help = (
        "Download each shop's public catalogue and replace its copy for the price "
        "lookup. A shop that fails keeps its previous copy, and the command exits 1."
    )

    def add_arguments(self, parser):
        parser.add_argument("--shop", choices=list(SHOPS), help="Only this shop.")

    def handle(self, *args, shop=None, **options):
        failed = []
        for name in [shop] if shop else SHOPS:
            try:
                count = refresh(name)
            except FAILURES as e:  # keep the old copy, try the next shop
                failed.append(name)
                self.stderr.write(f"{name}: failed, kept the previous copy ({e!r})")
            else:
                self.stdout.write(f"{name}: {count} products")
        if failed:
            raise CommandError(f"Refresh failed for {', '.join(failed)}")
