from slowapi import Limiter
from slowapi.util import get_remote_address

# Local-development rate limiter, keyed by client IP.
limiter = Limiter(key_func=get_remote_address)