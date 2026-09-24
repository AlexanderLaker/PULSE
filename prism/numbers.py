"""Checks for numbers that arrive from outside the code: a request body, a
stored run, a JSON file, a database row.

JSON gives Python ints of any size and floats that may be NaN or infinite, and
a bool is an int in Python, so every such number is checked here rather than
with a bare isinstance.
"""
import math


def finite_number(value) -> bool:
    """An int or float that is, or converts to, a finite float; never a bool."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:   # an int too large for a float
        return False


def whole_in_range(value, low: int, high: int) -> bool:
    """A whole number (an int, or a float without a fraction, never a bool) from low to high."""
    if not finite_number(value) or (isinstance(value, float) and not value.is_integer()):
        return False
    return low <= value <= high
