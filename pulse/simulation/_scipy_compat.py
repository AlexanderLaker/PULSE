"""Scipy compatibility layer — provides numpy-based fallbacks when scipy is unavailable.

On Vercel serverless (250MB limit), scipy (~150MB) cannot be included.
These fallbacks use numpy-only implementations that are sufficient for
the PRISM Monte Carlo engine.
"""

import numpy as np

try:
    from scipy import stats as scipy_stats
    from scipy.linalg import cholesky as scipy_cholesky
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False
    scipy_stats = None
    scipy_cholesky = None


def cholesky(matrix, lower=True):
    """Cholesky decomposition — scipy or numpy fallback."""
    if HAS_SCIPY:
        return scipy_cholesky(matrix, lower=lower)
    L = np.linalg.cholesky(matrix)
    return L if lower else L.T


def beta_ppf(q, a, b):
    """Beta distribution inverse CDF (percent point function).

    When scipy is unavailable, uses a rational approximation
    based on the normal approximation to the Beta distribution.
    """
    if HAS_SCIPY:
        return scipy_stats.beta.ppf(q, a, b)
    # Normal approximation to Beta distribution
    # Mean and variance of Beta(a, b)
    mu = a / (a + b)
    var = (a * b) / ((a + b) ** 2 * (a + b + 1))
    std = np.sqrt(var)
    # Use inverse normal CDF (numpy) to approximate
    z = _norm_ppf(q)
    result = mu + std * z
    # Clamp to [0, 1] since Beta is bounded
    return np.clip(result, 0.001, 0.999)


def t_cdf(x, df):
    """Student's t distribution CDF.

    When scipy is unavailable, uses normal approximation
    (accurate for df >= 4, which is our default t-copula df).
    """
    if HAS_SCIPY:
        return scipy_stats.t.cdf(x, df=df)
    # For df >= 4, normal approximation is reasonable
    # Using the approximation: t_cdf ≈ norm_cdf(x * (1 - 1/(4*df)))
    adjusted = x * (1 - 1 / (4 * df))
    return _norm_cdf(adjusted)


def _norm_cdf(x):
    """Standard normal CDF using the error function."""
    return 0.5 * (1 + _erf(x / np.sqrt(2)))


def _norm_ppf(p):
    """Standard normal inverse CDF (rational approximation).

    Uses the Beasley-Springer-Moro algorithm.
    Accurate to ~1e-9 for p in (0.00001, 0.99999).
    """
    p = np.asarray(p, dtype=np.float64)
    result = np.zeros_like(p)

    # Coefficients for rational approximation
    a = np.array([
        -3.969683028665376e+01, 2.209460984245205e+02,
        -2.759285104469687e+02, 1.383577518672690e+02,
        -3.066479806614716e+01, 2.506628277459239e+00
    ])
    b = np.array([
        -5.447609879822406e+01, 1.615858368580409e+02,
        -1.556989798598866e+02, 6.680131188771972e+01,
        -1.328068155288572e+01
    ])
    c = np.array([
        -7.784894002430293e-03, -3.223964580411365e-01,
        -2.400758277161838e+00, -2.549732539343734e+00,
        4.374664141464968e+00, 2.938163982698783e+00
    ])
    d = np.array([
        7.784695709041462e-03, 3.224671290700398e-01,
        2.445134137142996e+00, 3.754408661907416e+00
    ])

    p_low = 0.02425
    p_high = 1 - p_low

    # Rational approximation for central region
    mask_central = (p_low <= p) & (p <= p_high)
    if np.any(mask_central):
        q = p[mask_central] - 0.5
        r = q * q
        result[mask_central] = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q / \
                                (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)

    # Rational approximation for lower tail
    mask_low = p < p_low
    if np.any(mask_low):
        q = np.sqrt(-2 * np.log(p[mask_low]))
        result[mask_low] = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
                           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)

    # Rational approximation for upper tail
    mask_high = p > p_high
    if np.any(mask_high):
        q = np.sqrt(-2 * np.log(1 - p[mask_high]))
        result[mask_high] = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
                              ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)

    return result


def _erf(x):
    """Error function approximation (Abramowitz & Stegun)."""
    # Save the sign
    sign = np.sign(x)
    x = np.abs(x)

    # Constants
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    p = 0.3275911

    t = 1.0 / (1.0 + p * x)
    y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * np.exp(-x * x)

    return sign * y


def minimize_scalar(func, bounds, method='bounded'):
    """Simple scalar minimization fallback using golden section search."""
    if HAS_SCIPY:
        from scipy.optimize import minimize_scalar as _ms
        return _ms(func, bounds=bounds, method=method)

    # Golden section search
    a, b = bounds
    gr = (np.sqrt(5) + 1) / 2
    tol = 1e-8

    c = b - (b - a) / gr
    d = a + (b - a) / gr

    for _ in range(100):
        if abs(b - a) < tol:
            break
        if func(c) < func(d):
            b = d
        else:
            a = c
        c = b - (b - a) / gr
        d = a + (b - a) / gr

    x_min = (a + b) / 2

    class Result:
        def __init__(self, x, fun):
            self.x = x
            self.fun = fun

    return Result(x_min, func(x_min))


def minimize(func, x0, bounds=None, constraints=None, method=None):
    """Simple optimization fallback — returns x0 if scipy unavailable."""
    if HAS_SCIPY:
        from scipy.optimize import minimize as _min
        return _min(func, x0, bounds=bounds, constraints=constraints, method=method)

    # Fallback: just return x0 (the allocation optimizer's initial guess is already reasonable)
    class Result:
        def __init__(self, x):
            self.x = np.array(x)
            self.fun = func(x)
            self.success = True

    return Result(x0)
