"""Power BI export module — exports PRISM results to flat JSON and CSV.

Produces flat table format optimized for Power BI import. Each row represents
one category × scenario × time horizon combination.

All values are percentages — no financial data is included.
"""

import json
import csv
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Any

from pulse.config import ModelConfig, FORCES
from pulse.ingestion.firewall import FinancialDataFirewall

logger = logging.getLogger(__name__)


class PowerBIExporter:
    """Exports PRISM simulation results to flat JSON and CSV formats for Power BI."""

    def __init__(self, config: ModelConfig):
        """Initialize the Power BI exporter.

        Args:
            config: ModelConfig instance with model parameters and category names
        """
        self.config = config
        self.firewall = FinancialDataFirewall()
        self.export_timestamp = datetime.now().isoformat()

    def export_shift_matrix(
        self,
        mc_result: Dict[str, Any],
        output_path: str = None,
        auto_push_path: Optional[str] = None,
    ) -> str:
        """Export shift matrix results to flat JSON format for Power BI.

        Creates a flat table where each row is one category × year combination.
        Includes percentile distributions, velocity, and force attribution.

        Args:
            mc_result: Monte Carlo simulation result dict with 'shift_matrix' key
            output_path: Path to write JSON file. If None, uses default naming.
            auto_push_path: Optional path to copy file to (e.g., SharePoint sync folder)

        Returns:
            Path to the exported JSON file
        """
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = f"shift_matrix_powerbi_{timestamp}.json"

        output_path = Path(output_path)

        # Extract shift matrix
        shift_matrix = mc_result.get("shift_matrix", {})

        # Build flat table
        flat_data = []

        for category in self.config.category_names:
            cat_data = shift_matrix.get(category, {})
            path = cat_data.get("path", {})
            velocity = cat_data.get("velocity", {})
            force_attribution = cat_data.get("force_attribution", {})

            for year in self.config.path_years:
                    year_data = path.get(year, {})

                year_data = path.get(year, {})

                # Build row
                row = {
                    "category": category,
                    "time_horizon": year,
                    "shift_p10": self._safe_round(year_data.get("p10", 0.0)),
                    "shift_p25": self._safe_round(year_data.get("p25", 0.0)),
                    "shift_median": self._safe_round(year_data.get("median", 0.0)),
                    "shift_p75": self._safe_round(year_data.get("p75", 0.0)),
                    "shift_p90": self._safe_round(year_data.get("p90", 0.0)),
                    "velocity": self._safe_round(velocity.get(year, 0.0)),
                }

                # Add force attribution as separate columns for flat structure
                for force in FORCES:
                    attribution_val = force_attribution.get(force, 0.0)
                    row[f"force_{force.lower().replace(' ', '_')}"] = self._safe_round(
                        attribution_val
                    )

                flat_data.append(row)

        # Write JSON
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(flat_data, f, indent=2, default=str)

        logger.info(f"Power BI JSON export: {len(flat_data)} rows written to {output_path}")

        # Auto-push if configured
        if auto_push_path:
            self._push_file(output_path, auto_push_path)

        return str(output_path)

    def export_csv(
        self,
        mc_result: Dict[str, Any],
        output_path: str = None,
        auto_push_path: Optional[str] = None,
    ) -> str:
        """Export shift matrix results to flat CSV format for Power BI.

        Same structure as JSON — flat table with one row per category × year.

        Args:
            mc_result: Monte Carlo simulation result dict with 'shift_matrix' key
            output_path: Path to write CSV file. If None, uses default naming.
            auto_push_path: Optional path to copy file to (e.g., SharePoint sync folder)

        Returns:
            Path to the exported CSV file
        """
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = f"shift_matrix_powerbi_{timestamp}.csv"

        output_path = Path(output_path)

        # Extract shift matrix
        shift_matrix = mc_result.get("shift_matrix", {})

        # Build flat table (same as JSON export)
        flat_data = []

        for category in self.config.category_names:
            cat_data = shift_matrix.get(category, {})
            path = cat_data.get("path", {})
            velocity = cat_data.get("velocity", {})
            force_attribution = cat_data.get("force_attribution", {})

            for year in self.config.path_years:
                year_data = path.get(year, {})

                # Build row
                row = {
                    "category": category,
                    "time_horizon": year,
                    "shift_p10": self._safe_round(year_data.get("p10", 0.0)),
                    "shift_p25": self._safe_round(year_data.get("p25", 0.0)),
                    "shift_median": self._safe_round(year_data.get("median", 0.0)),
                    "shift_p75": self._safe_round(year_data.get("p75", 0.0)),
                    "shift_p90": self._safe_round(year_data.get("p90", 0.0)),
                    "velocity": self._safe_round(velocity.get(year, 0.0)),
                }

                # Add force attribution columns
                for force in FORCES:
                    attribution_val = force_attribution.get(force, 0.0)
                    row[f"force_{force.lower().replace(' ', '_')}"] = self._safe_round(
                        attribution_val
                    )

                flat_data.append(row)

        # Write CSV
        if flat_data:
            fieldnames = list(flat_data[0].keys())
            with open(output_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(flat_data)

        logger.info(f"Power BI CSV export: {len(flat_data)} rows written to {output_path}")

        # Auto-push if configured
        if auto_push_path:
            self._push_file(output_path, auto_push_path)

        return str(output_path)

    def validate_export(self, filepath: str) -> bool:
        """Validate that exported file contains no financial data.

        Scans the exported JSON or CSV for suspicious values that indicate
        financial data may have leaked into the export.

        Args:
            filepath: Path to the exported file

        Returns:
            True if file passes validation, False if firewall violations detected
        """
        filepath = Path(filepath)

        if not filepath.exists():
            logger.error(f"Export validation: File not found {filepath}")
            return False

        # Fields that should contain years (not percentages)
        year_fields = {"time_horizon", "year"}
        # Fields that are percentages and should be -1.0 to 1.0
        percentage_fields = {
            "shift_p10", "shift_p25", "shift_median", "shift_p75", "shift_p90",
            "velocity"
        }

        try:
            if filepath.suffix.lower() == ".json":
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)

                # Validate structure
                if not isinstance(data, list):
                    logger.error("Export validation: JSON must be an array of objects")
                    return False

                # Check each row
                for idx, row in enumerate(data):
                    for key, value in row.items():
                        if isinstance(value, (int, float)):
                            # Skip year/ID fields
                            if key in year_fields:
                                continue
                            # Check force attribution and percentages
                            if key.startswith("force_") or key in percentage_fields:
                                if abs(value) > 1.0:
                                    logger.warning(
                                        f"Export validation: Row {idx}, field '{key}' = {value} "
                                        f"(exceeds ±100%)"
                                    )
                                    return False

            elif filepath.suffix.lower() == ".csv":
                with open(filepath, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for idx, row in enumerate(reader):
                        for key, value in row.items():
                            # Skip year/ID fields
                            if key in year_fields:
                                continue
                            try:
                                numeric_val = float(value)
                                # Check force attribution and percentages
                                if key.startswith("force_") or key in percentage_fields:
                                    if abs(numeric_val) > 1.0:
                                        logger.warning(
                                            f"Export validation: Row {idx}, field '{key}' = {numeric_val} "
                                            f"(exceeds ±100%)"
                                        )
                                        return False
                            except (ValueError, TypeError):
                                # Non-numeric values are fine (category, scenario names)
                                pass

            logger.info(f"Export validation: {filepath} PASSED — no financial data detected")
            return True

        except Exception as e:
            logger.error(f"Export validation error: {e}")
            return False


    def _safe_round(self, value: Any, decimals: int = 6) -> float:
        """Safely round a numeric value to specified decimal places.

        Args:
            value: Value to round (may be None, string, etc.)
            decimals: Number of decimal places

        Returns:
            Rounded float, or 0.0 if value cannot be converted
        """
        try:
            return round(float(value), decimals)
        except (TypeError, ValueError):
            return 0.0

    def _push_file(self, source_path: str, target_dir: str) -> bool:
        """Copy exported file to configured directory (e.g., SharePoint sync folder).

        Args:
            source_path: Path to the exported file
            target_dir: Target directory path to copy to

        Returns:
            True if push successful, False otherwise
        """
        import shutil

        try:
            source = Path(source_path)
            target_dir = Path(target_dir)

            if not source.exists():
                logger.error(f"Auto-push: Source file not found: {source}")
                return False

            if not target_dir.exists():
                logger.error(f"Auto-push: Target directory not found: {target_dir}")
                return False

            if not target_dir.is_dir():
                logger.error(f"Auto-push: Target is not a directory: {target_dir}")
                return False

            # Copy with original filename
            target_file = target_dir / source.name
            shutil.copy2(source, target_file)

            logger.info(f"Auto-push: File copied to {target_file}")
            return True

        except Exception as e:
            logger.error(f"Auto-push error: {e}")
            return False

    def get_metadata_header(self, mc_result: Dict[str, Any]) -> Dict[str, Any]:
        """Generate metadata header for export files.

        Args:
            mc_result: Monte Carlo simulation result dict

        Returns:
            Dictionary with metadata information
        """
        return {
            "export_type": "Power BI Flat Table",
            "generated": self.export_timestamp,
            "model_version": "2.0 — Bayesian Copula + Causal DAG",
            "iterations": mc_result.get("iterations", "N/A"),
            "model_type": mc_result.get("model_type", "N/A"),
            "attenuation": f"{self.config.attenuation:.3f}",
            "attenuation_source": self.config.attenuation_source,
            "path_years": self.config.path_years,
            "categories": len(self.config.category_names),
            "security_note": "This file contains ONLY percentage shifts. "
            "No company financial data (NES, GP1, GP2) is present.",
        }
