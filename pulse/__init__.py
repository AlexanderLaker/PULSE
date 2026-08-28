"""PRISM — Profit Pool Risk & Intelligence Simulation Model.

M15 (July 2026 review): one authoritative version. This string is the
package/API version and MUST equal ``BayesianMonteCarloEngine.MODEL_VERSION``
and the ``version`` field in package.json — ``tests/test_golden_pipeline.py``
asserts all three agree. (It is duplicated as a literal here, rather than
imported from the engine, because importing the engine pulls in scipy and the
read-only serverless runtime deliberately has no scipy — D13/F2.)
"""
__version__ = "2.10.0"
