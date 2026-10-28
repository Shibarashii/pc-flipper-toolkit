"""Sign up, log in, log out, and who's logged in. Everything else needs the token."""

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

User = get_user_model()

TAKEN = "That username is taken."


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
        return username

    def validate(self, data):
        try:
            validate_password(data["password"], User(username=data["username"]))
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return data


class UserSerializer(serializers.Serializer):
    username = serializers.CharField(read_only=True)


class TokenSerializer(UserSerializer):
    token = serializers.CharField(
        read_only=True, help_text="Send as `Authorization: Token <token>`."
    )


def token_response(user, status_code=status.HTTP_200_OK) -> Response:
    token, _ = Token.objects.get_or_create(user=user)
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
        responses={200: UserSerializer},
        tags=["auth"],
    )
    def get(self, request):
        return Response({"username": request.user.username})
