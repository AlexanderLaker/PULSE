"""Shift Matrix Excel writer — exports PRISM results to Excel.

Writes continuous path shift matrices with percentile distributions,
causal decomposition, velocity data, and allocation recommendations.
All values are percentages — no financial data.
"""

import logging
from pathlib import Path
from datetime import datetime

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from pulse.config import ModelConfig, FORCES

logger = logging.getLogger(__name__)

# Styling
HEADER_FILL = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
HEADER_FONT = Font(name="Inter", color="F8FAFC", bold=True, size=10)
DATA_FONT = Font(name="Inter", color="1E293B", size=10)
EXPANSION_FILL = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
CONTRACTION_FILL = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
NEUTRAL_FILL = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
BORDER = Border(
    left=Side(style="thin", color="CBD5E1"),
    right=Side(style="thin", color="CBD5E1"),
    top=Side(style="thin", color="CBD5E1"),
    bottom=Side(style="thin", color="CBD5E1"),
)


class ShiftMatrixWriter:
    """Writes PRISM simulation results to Excel."""

    def __init__(self, config: ModelConfig):
        self.config = config

    def write(self, output_path: str, mc_result: dict,
              allocation: dict = None,
              metadata: dict = None):
        """
        Write complete PRISM output to Excel.

        Creates sheets:
        1. Shift Matrix — continuous paths with percentiles
        2. Velocity & Triggers — path dynamics
        3. Allocation — resource allocation recommendations
        4. Metadata — run configuration and diagnostics
        """
        wb = openpyxl.Workbook()

        # Sheet 1: Shift Matrix
        self._write_shift_matrix(wb, mc_result)

        # Sheet 2: Velocity & Triggers
        self._write_velocity(wb, mc_result)

        # Sheet 3: Allocation (if available)
        if allocation:
            self._write_allocation(wb, allocation)

        # Sheet 4: Metadata
        self._write_metadata(wb, mc_result, metadata)

        # Remove default sheet if extra sheets were created
        if "Sheet" in wb.sheetnames and len(wb.sheetnames) > 1:
            del wb["Sheet"]


        wb.save(output_path)
        logger.info(f"Shift Matrix written to {output_path}")

    def _write_shift_matrix(self, wb, mc_result):
        """Write main shift matrix with continuous paths."""
        ws = wb.active
        ws.title = "Shift Matrix"

        shift_matrix = mc_result.get("shift_matrix", {})
        percentiles = ["p10", "p25", "median", "p75", "p90"]

        # Header
        ws.merge_cells("A1:A2")
        ws["A1"] = "Category"
        ws["A1"].font = HEADER_FONT
        ws["A1"].fill = HEADER_FILL
        ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

        col = 2
        for year in self.config.path_years:
            start_col = col
            for p in percentiles:
                cell = ws.cell(row=2, column=col, value=p)
                cell.font = HEADER_FONT
                cell.fill = HEADER_FILL
                cell.alignment = Alignment(horizontal="center")
                col += 1
            # Merge year header
            ws.merge_cells(start_row=1, start_column=start_col,
                           end_row=1, end_column=col - 1)
            ws.cell(row=1, column=start_col, value=str(year))
            ws.cell(row=1, column=start_col).font = HEADER_FONT
            ws.cell(row=1, column=start_col).fill = HEADER_FILL
            ws.cell(row=1, column=start_col).alignment = Alignment(horizontal="center")

        # Data rows
        row = 3
        for cat in self.config.category_names:
            cat_data = shift_matrix.get(cat, {})
            path = cat_data.get("path", {})

            ws.cell(row=row, column=1, value=cat).font = Font(name="Inter", bold=True, size=10)

            col = 2
            for year in self.config.path_years:
                year_data = path.get(year, {})
                for p in percentiles:
                    val = year_data.get(p, 0.0)
                    cell = ws.cell(row=row, column=col, value=round(val, 6))
                    cell.number_format = "0.00%"
                    cell.font = DATA_FONT
                    cell.alignment = Alignment(horizontal="center")
                    cell.border = BORDER

                    # Color coding
                    if val > 0.005:
                        cell.fill = EXPANSION_FILL
                    elif val < -0.005:
                        cell.fill = CONTRACTION_FILL
                    else:
                        cell.fill = NEUTRAL_FILL

                    col += 1
            row += 1

        # Auto-fit columns
        for c in range(1, col):
            ws.column_dimensions[get_column_letter(c)].width = 12
        ws.column_dimensions["A"].width = 18

    def _write_velocity(self, wb, mc_result):
        """Write velocity and trigger analysis."""
        ws = wb.create_sheet("Velocity & Triggers")
        shift_matrix = mc_result.get("shift_matrix", {})

        # Header
        headers = ["Category", "Path Shape"] + [f"Velocity {y}" for y in self.config.path_years[1:]]
        for j, h in enumerate(headers, 1):
            cell = ws.cell(row=1, column=j, value=h)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL

        from pulse.common.shape_compat import velocity_median as _vel_median

        row = 2
        for cat in self.config.category_names:
            cat_data = shift_matrix.get(cat, {})
            velocity = cat_data.get("velocity", {})

            ws.cell(row=row, column=1, value=cat).font = Font(name="Inter", bold=True)

            # Path shape classification (simplified)
            vel_vals = [_vel_median(v) for v in velocity.values()]
            if vel_vals:
                if all(abs(v) < 0.001 for v in vel_vals):
                    shape = "flat"
                elif abs(vel_vals[-1]) > abs(vel_vals[0]) * 1.5:
                    shape = "accelerating"
                elif abs(vel_vals[0]) > abs(vel_vals[-1]) * 1.5:
                    shape = "decelerating"
                else:
                    shape = "gradual"
            else:
                shape = "n/a"
            ws.cell(row=row, column=2, value=shape)

            for j, year in enumerate(self.config.path_years[1:], 3):
                val = _vel_median(velocity.get(year, 0.0))
                cell = ws.cell(row=row, column=j, value=round(val, 6))
                cell.number_format = "0.00%"
            row += 1

    def _write_allocation(self, wb, allocation):
        """Write resource allocation recommendations."""
        ws = wb.create_sheet("Allocation")

        headers = ["Category", "Recommended Weight", "Signal"]
        for j, h in enumerate(headers, 1):
            cell = ws.cell(row=1, column=j, value=h)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL

        weights = allocation.get("weights", {})
        equal_w = 1.0 / max(len(weights), 1)

        row = 2
        for cat, weight in sorted(weights.items(), key=lambda x: x[1], reverse=True):
            ws.cell(row=row, column=1, value=cat)
            cell = ws.cell(row=row, column=2, value=round(weight, 4))
            cell.number_format = "0.00%"

            signal = "INVEST MORE" if weight > equal_w + 0.02 else \
                     "REDUCE" if weight < equal_w - 0.02 else "MAINTAIN"
            ws.cell(row=row, column=3, value=signal)
            row += 1

        # Summary
        row += 1
        ws.cell(row=row, column=1, value="Risk Aversion Used").font = Font(bold=True)
        ws.cell(row=row, column=2, value=allocation.get("risk_aversion_used", 1.0))
        row += 1
        ws.cell(row=row, column=1, value="Expected Pool Shift").font = Font(bold=True)
        ws.cell(row=row, column=2, value=allocation.get("expected_pool_shift", 0))
        ws.cell(row=row, column=2).number_format = "0.00%"

    def _write_metadata(self, wb, mc_result, extra_metadata=None):
        """Write run metadata and configuration."""
        ws = wb.create_sheet("Metadata")

        data = [
            ("PRISM Shift Matrix", ""),
            ("Generated", datetime.now().isoformat()),
            ("Model Version", "2.0 — Bayesian Copula + Causal DAG"),
            ("Iterations", mc_result.get("iterations", "N/A")),
            ("Model Type", mc_result.get("model_type", "N/A")),
            ("Attenuation", f"{self.config.attenuation:.3f} ({self.config.attenuation_source})"),
            ("Path Years", str(self.config.path_years)),
            ("", ""),
            ("SECURITY NOTE", "This file contains ONLY percentage shifts."),
            ("", "No company financial data (NES, GP1, GP2) is present."),
            ("", "Apply shifts to your financials in your own Excel."),
        ]

        if extra_metadata:
            data.append(("", ""))
            for k, v in extra_metadata.items():
                data.append((str(k), str(v)))

        for row_idx, (key, val) in enumerate(data, 1):
            ws.cell(row=row_idx, column=1, value=key).font = Font(bold=True) if key else DATA_FONT
            ws.cell(row=row_idx, column=2, value=val)

        ws.column_dimensions["A"].width = 25
        ws.column_dimensions["B"].width = 60
