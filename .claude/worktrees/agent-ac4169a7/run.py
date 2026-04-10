#!/usr/bin/env python3
"""
PRISM Quick Launcher — run this from the PROFIT_POOL_ENGINE folder.

Usage:
    python run.py                           # Auto-find V12 Excel and launch dashboard
    python run.py --input path/to/v12.xlsx  # Specify Excel path
    python run.py --no-dashboard            # CLI only, no dashboard
"""

import sys
import os
import argparse
from pathlib import Path

# Ensure pulse package is importable
sys.path.insert(0, str(Path(__file__).parent))


def find_v12():
    """Auto-find V12 Excel file in current or parent directory."""
    patterns = ["*v12*.xlsx", "*V12*.xlsx", "*Profit*pool*.xlsx", "*profit*pool*.xlsx"]
    search_dirs = [Path("."), Path("..")]
    for d in search_dirs:
        for pattern in patterns:
            matches = list(d.glob(pattern))
            if matches:
                return str(matches[0])
    return None


def check_deps():
    """Check required dependencies and install if missing."""
    missing = []
    for pkg, import_name in [
        ("openpyxl", "openpyxl"),
        ("scipy", "scipy"),
        ("numpy", "numpy"),
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
    ]:
        try:
            __import__(import_name)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"Installing missing packages: {', '.join(missing)}")
        os.system(f"{sys.executable} -m pip install {' '.join(missing)} --break-system-packages -q")


def main():
    parser = argparse.ArgumentParser(description="PRISM Quick Launcher")
    parser.add_argument("--input", "-i", help="Path to V12 Excel file (auto-detected if omitted)")
    parser.add_argument("--port", "-p", type=int, default=8000, help="Server port (default: 8000)")
    parser.add_argument("--no-dashboard", action="store_true", help="Run simulation only, no dashboard")
    parser.add_argument("--output", "-o", default="shift_matrix.xlsx", help="Output Excel path")
    args = parser.parse_args()

    check_deps()

    # Find V12
    excel_path = args.input or find_v12()
    if not excel_path or not Path(excel_path).exists():
        print("\n  ERROR: V12 Excel file not found.")
        print("  Either place it next to this script or specify with --input:")
        print("    python run.py --input path/to/v12.xlsx")
        print()
        # List xlsx files nearby
        for f in Path(".").glob("*.xlsx"):
            print(f"    Found: {f}")
        for f in Path("..").glob("*.xlsx"):
            print(f"    Found: {f}")
        sys.exit(1)

    print(f"\n{'═' * 60}")
    print(f"  PRISM — Profit Pool Simulation Engine")
    print(f"  V12 Input: {excel_path}")
    print(f"{'═' * 60}\n")

    if args.no_dashboard:
        # CLI mode
        sys.argv = ["pulse", "--input", excel_path, "--output", args.output]
        from pulse.main import main as pulse_main
        pulse_main()
    else:
        # Dashboard mode
        import uvicorn
        from pulse.api.app import create_app

        # Create a namespace mimicking argparse for create_app
        class Args:
            input = excel_path

        app = create_app(Args())

        print(f"  Dashboard: http://localhost:{args.port}")
        print(f"  API docs:  http://localhost:{args.port}/docs")
        print(f"  Press Ctrl+C to stop.\n")

        uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="info")


if __name__ == "__main__":
    main()
