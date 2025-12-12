import secrets
import string


def generate_verification_code(length: int = 6) -> str:
    """Generate an alphanumeric verification code for tenants."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

