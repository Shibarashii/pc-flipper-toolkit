"""The app's emails, each with a text and an HTML version, sent in the background.

Both versions, because Brevo turns a text-only email into HTML with a tracking image, which
spam filters mark down (specs/account-management.md, S1's test).
"""

from threading import Thread

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import format_html
from django.utils.safestring import mark_safe

# A paragraph, or a link as (label, url): the text version shows the url on its own line.
Part = str | tuple[str, str]


def send(to: str, subject: str, parts: list[Part]) -> None:
    parts = [*parts, "PC Flipper Toolkit", ("Open the app", f"{settings.SITE_URL}/")]
    text = "\n\n".join(p if isinstance(p, str) else p[1] for p in parts) + "\n"
    # Each piece is escaped by format_html, so the joined whole is safe.
    body = mark_safe(
        "".join(
            format_html("<p>{}</p>", p)
            if isinstance(p, str)
            else format_html('<p><a href="{}">{}</a></p>', p[1], p[0])
            for p in parts
        )
    )
    html = format_html(
        '<!doctype html><html><body style="font-family: sans-serif; line-height: 1.5">'
        "{}</body></html>",
        body,
    )
    message = EmailMultiAlternatives(subject, text, to=[to])
    message.attach_alternative(html, "text/html")
    # In the background, so the answer doesn't wait on the mail server.
    # ponytail: lost if Render restarts mid-send (the user asks again); a task queue if
    # that's ever seen. A failure only shows in Render's log.
    Thread(target=message.send, daemon=True).start()


def confirm_email(email: str, token: str) -> None:
    # No username: the address isn't confirmed yet, so its owner may be a stranger.
    send(
        email,
        "Confirm your email for PC Flipper Toolkit",
        [
            "Hi,",
            (
                "Open this link to confirm this email for your PC Flipper Toolkit account, so "
                "you can get back in if you forget your password:"
            ),
            ("Confirm your email", f"{settings.SITE_URL}/verify-email?token={token}"),
            (
                "The link works for 24 hours. If this wasn’t you, you can ignore this email; "
                "nothing changes until the link is opened."
            ),
        ],
    )


def email_changed(username: str, old: str, new: str) -> None:
    send(
        old,
        "Your PC Flipper Toolkit email was changed",
        [
            f"Hi {username},",
            (
                f"The email on your PC Flipper Toolkit account is now {new}, so this address "
                "won’t get its emails any more."
            ),
            "If this wasn’t you, log in and change your password:",
            ("Log in", f"{settings.SITE_URL}/login"),
        ],
    )


def reset_password(username: str, email: str, uid: str, token: str) -> None:
    # Forgot your username is the same email: it names the username.
    send(
        email,
        "Your PC Flipper Toolkit username, and a link to set a new password",
        [
            f"Hi {username},",
            f"Your username is {username}.",
            "To set a new password, open this link:",
            (
                "Set a new password",
                f"{settings.SITE_URL}/reset-password?uid={uid}&token={token}",
            ),
            (
                "The link works once, for 1 hour. If you didn’t ask for this, you can "
                "ignore this email; nothing changes."
            ),
        ],
    )


def password_changed(username: str, email: str) -> None:
    send(
        email,
        "Your PC Flipper Toolkit password was changed",
        [
            f"Hi {username},",
            (
                "The password on your PC Flipper Toolkit account was just changed, and "
                "every device was logged out."
            ),
            "If this wasn’t you, set a new one from the log-in page right away:",
            ("Log in", f"{settings.SITE_URL}/login"),
        ],
    )
