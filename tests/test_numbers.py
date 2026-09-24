"""The checks for numbers that arrive from outside the code (prism/numbers.py)."""
import math

import pytest

from prism.numbers import finite_number, whole_in_range

TOO_LARGE_FOR_A_FLOAT = 10**400


@pytest.mark.parametrize("value, expected", [
    (0, True), (-3, True), (0.25, True), (10**300, True),
    (True, False), (False, False), (math.nan, False), (math.inf, False), (-math.inf, False),
    (TOO_LARGE_FOR_A_FLOAT, False), ("1", False), (None, False),
])
def test_a_finite_number(value, expected):
    assert finite_number(value) is expected


@pytest.mark.parametrize("value, expected", [
    (0, True), (5, True), (3.0, True),
    (6, False), (-1, False), (2.5, False), (True, False), (math.nan, False), (math.inf, False),
    (TOO_LARGE_FOR_A_FLOAT, False), ("3", False),
])
def test_a_whole_number_in_range(value, expected):
    assert whole_in_range(value, 0, 5) is expected
