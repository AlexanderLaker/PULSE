"""PRISM: Profit Pool Risk & Intelligence Simulation Model.

``__version__`` is the single version of the package, the API and the engine.
It must equal ``MonteCarloEngine.MODEL_VERSION`` and the ``version`` in
package.json; tests/test_golden_pipeline.py checks that all three agree. It is
a literal here rather than imported from the engine because the engine needs
scipy, and the API runtime, which never simulates, does not install scipy.
"""
__version__ = "2.12.0"
