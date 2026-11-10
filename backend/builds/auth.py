"""Sign up, log in, log out, and who's logged in. Everything else needs the token."""

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import google
from .authentication import expired
from .demo import PREFIX as DEMO_PREFIX
from .demo import create_demo_user, is_demo
from .models import GoogleAccount

User = get_user_model()

TAKEN = "That username is taken."
GOOGLE_FAILED = "Google sign-in didn't work. Try again."
CONNECTED_ELSEWHERE = "This Google account is connected to another account."


class CredentialsSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )


class SignupSerializer(CredentialsSerializer):
    username = serializers.CharField(
        max_length=150,
        validators=User._meta.get_field("username").validators,
        help_text="Letters, digits and @/./+/-/_ only.",
    )

    def validate_username(self, username):
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError(TAKEN)
        # Reserved: cleanup deletes demo accounts by this prefix (and no password).
        if username.lower().startswith(DEMO_PREFIX):
            raise serializers.ValidationError(
                f'Usernames can\'t start with "{DEMO_PREFIX}".'
            )
        return username

    def validate(self, data):
        try:
            validate_password(data["password"], User(username=data["username"]))
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return data


class UserSerializer(serializers.Serializer):
    username = serializers.CharField(read_only=True)


class ConnectedGoogleSerializer(serializers.Serializer):
    email = serializers.EmailField(read_only=True)


class ConnectSerializer(serializers.Serializer):
    google = ConnectedGoogleSerializer(read_only=True)


class MeSerializer(UserSerializer):
    google = ConnectedGoogleSerializer(
        read_only=True,
        allow_null=True,
        help_text="The connected Google account, if any.",
    )
    has_password = serializers.BooleanField(
        read_only=True, help_text="False for Google-only and demo accounts."
    )
    is_demo = serializers.BooleanField(read_only=True)


def connected_google(user) -> dict | None:
    account = GoogleAccount.objects.filter(user=user).first()
    return {"email": account.email} if account else None


class TokenSerializer(UserSerializer):
    token = serializers.CharField(
        read_only=True, help_text="Send as `Authorization: Token <token>`."
    )


def token_response(user, status_code=status.HTTP_200_OK) -> Response:
    token, _ = Token.objects.get_or_create(user=user)
    if expired(token):
        # ponytail: two log-ins at the same moment on an expired token can 500 the second
        # (one token per user); retrying works. Catch IntegrityError if it ever shows up.
        token.delete()
        token = Token.objects.create(user=user)
    return Response({"token": token.key, "username": user.username}, status_code)


class PublicAuthView(APIView):
    """No token needed; rate-limited per IP so passwords can't be guessed quickly."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class SignupView(PublicAuthView):
    @extend_schema(
        summary="Sign up",
        description="Creates an account and logs it in. Passwords must pass Django's "
        "password validators; their messages come back under `password`.",
        request=SignupSerializer,
        responses={201: TokenSerializer},
        tags=["auth"],
    )
    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = User.objects.create_user(**serializer.validated_data)
        except IntegrityError:
            # Someone took the name between the check above and now.
            raise serializers.ValidationError({"username": [TAKEN]})
        return token_response(user, status.HTTP_201_CREATED)


class LoginView(PublicAuthView):
    @extend_schema(
        summary="Log in",
        description="Returns the user's token. A wrong username or password is a 400 "
        "with the message under `non_field_errors`.",
        request=CredentialsSerializer,
        responses={200: TokenSerializer},
        tags=["auth"],
    )
    def post(self, request):
        serializer = CredentialsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        # Sign-up treats "Carol" and "carol" as one name, so log-in does too. An exact
        # match still wins, in case two older accounts differ only by case.
        if not User.objects.filter(username=username).exists():
            match = User.objects.filter(username__iexact=username).first()
            username = match.username if match else username
        user = authenticate(
            request,
            username=username,
            password=serializer.validated_data["password"],
        )
        if user is None:
            raise serializers.ValidationError(
                {"non_field_errors": ["Wrong username or password."]}
            )
        return token_response(user)


class GoogleCredentialSerializer(serializers.Serializer):
    credential = serializers.CharField(
        write_only=True,
        help_text="The ID token Google's sign-in button gives the page.",
    )


def google_account(request) -> tuple[str, str]:
    """The `sub` and email of the Google account in the request's credential, checked."""
    if not settings.GOOGLE_CLIENT_ID:
        raise serializers.ValidationError(
            {"credential": ["Google sign-in isn't set up."]}
        )
    serializer = GoogleCredentialSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        return google.verify(serializer.validated_data["credential"])
    except google.InvalidToken:
        raise serializers.ValidationError({"credential": [GOOGLE_FAILED]})


class GoogleView(PublicAuthView):
    @extend_schema(
        summary="Sign in with Google",
        description="Checks the ID token from Google's sign-in button. A Google account "
        "connected to a user logs that user in (200); a new one creates an account named "
        "after its email, with no password, and logs it in (201). A bad token is a 400 on "
        "`credential`. Shares the sign-up/log-in rate limit.",
        request=GoogleCredentialSerializer,
        responses={200: TokenSerializer, 201: TokenSerializer},
        tags=["auth"],
    )
    def post(self, request):
        sub, email = google_account(request)
        # A few tries: two first sign-ins at once can race for the same sub or username.
        for _ in range(3):
            account = (
                GoogleAccount.objects.select_related("user").filter(sub=sub).first()
            )
            if account:
                # Password log-in refuses inactive users too (Django's authenticate).
                if not account.user.is_active:
                    break
                if account.email != email:  # shown on Account; Google's can change
                    account.email = email
                    account.save(update_fields=["email"])
                return token_response(account.user)
            try:
                with transaction.atomic():
                    user = User.objects.create_user(google.username_for(email))
                    GoogleAccount.objects.create(user=user, sub=sub, email=email)
            except IntegrityError:
                continue
            return token_response(user, status.HTTP_201_CREATED)
        raise serializers.ValidationError({"credential": [GOOGLE_FAILED]})


class DemoView(PublicAuthView):
    @extend_schema(
        summary="Try the demo",
        description="Creates a throwaway account with two sample builds (one sold, one in "
        "progress) and logs it in. It works for 24 hours, then its token returns `401` "
        "and it's deleted. Shares the sign-up/log-in rate limit.",
        request=None,
        responses={201: TokenSerializer},
        tags=["auth"],
    )
    def post(self, request):
        return token_response(create_demo_user(), status.HTTP_201_CREATED)


class LogoutView(APIView):
    @extend_schema(
        summary="Log out",
        description="Deletes the token, so it stops working everywhere.",
        request=None,
        responses={204: None},
        tags=["auth"],
    )
    def post(self, request):
        request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    @extend_schema(
        summary="Who's logged in",
        responses={200: MeSerializer},
        tags=["auth"],
    )
    def get(self, request):
        user = request.user
        return Response(
            {
                "username": user.username,
                "google": connected_google(user),
                "has_password": user.has_usable_password(),
                "is_demo": is_demo(user),
            }
        )


def refuse(message: str):
    raise serializers.ValidationError({"non_field_errors": [message]})


class GoogleConnectView(APIView):
    """The Account page: link the logged-in user to a Google account, or unlink it."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(
        summary="Connect Google",
        description="Links the Google account in the ID token to the logged-in user, so "
        "signing in with Google opens this account. Refused (400) for a demo, an account "
        "that already has one, and a Google account connected to someone else.",
        request=GoogleCredentialSerializer,
        responses={200: ConnectSerializer},
        tags=["auth"],
    )
    def post(self, request):
        user = request.user
        if is_demo(user):
            refuse(
                "Demo accounts can't connect Google. Sign up for your own account first."
            )
        if GoogleAccount.objects.filter(user=user).exists():
            refuse("Disconnect Google first.")
        sub, email = google_account(request)
        try:
            with transaction.atomic():
                GoogleAccount.objects.create(user=user, sub=sub, email=email)
        except IntegrityError:
            # Taken: by another user, or by this one meanwhile (a second request).
            account = GoogleAccount.objects.filter(sub=sub).first()
            if account and account.user_id == user.pk:
                return Response({"google": {"email": account.email}})
            refuse(CONNECTED_ELSEWHERE if account else "Disconnect Google first.")
        return Response({"google": {"email": email}})

    @extend_schema(
        summary="Disconnect Google",
        description="Unlinks the Google account. Refused (400) without a password, the "
        "only other way in, or when none is connected.",
        request=None,
        responses={204: None},
        tags=["auth"],
    )
    def delete(self, request):
        user = request.user
        if not user.has_usable_password():
            refuse("Set up a password first; it's the only other way in.")
        if not GoogleAccount.objects.filter(user=user).delete()[0]:
            refuse("No Google account is connected.")
        return Response(status=status.HTTP_204_NO_CONTENT)
