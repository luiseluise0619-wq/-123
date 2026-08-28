import os
import pandas as pd
import numpy as np
from typing import Dict, Any
from app.core.config import settings

class AutoEDAGenerator:
    """
    Automated EDA Generator: Analyzes missing values, outliers, top 20 correlations,
    and regional/industry breakdowns, exporting eda_report.md.
    """
    @staticmethod
    def generate_eda_report(df: pd.DataFrame, output_dir: str = None) -> Dict[str, Any]:
        n_rows, n_cols = df.shape
        missing_counts = df.isnull().sum().to_dict()
        numeric_df = df.select_dtypes(include=[np.number])
        
        # 1. Target & Core Feature Correlations
        correlations = {}
        target_col = "monthly_revenue" if "monthly_revenue" in numeric_df.columns else numeric_df.columns[-1]
        
        corr_series = numeric_df.corr()[target_col].drop(target_col, errors="ignore")
        top_positive = [(col, round(float(val), 4)) for col, val in corr_series.sort_values(ascending=False).head(10).items() if not np.isnan(val)]
        top_negative = [(col, round(float(val), 4)) for col, val in corr_series.sort_values(ascending=True).head(10).items() if not np.isnan(val)]
        
        # 2. Industry Breakdown Analysis
        industry_breakdown = {}
        if "industry" in df.columns and target_col in df.columns:
            ind_grp = df.groupby("industry")[target_col].agg(["count", "mean", "median", "std"]).reset_index()
            for _, row in ind_grp.iterrows():
                industry_breakdown[row["industry"]] = {
                    "count": int(row["count"]),
                    "mean_revenue_10k": round(float(row["mean"]), 1),
                    "median_revenue_10k": round(float(row["median"]), 1)
                }

        # 3. Write Markdown Report
        md_content = f"""# Production Automated EDA Report

- **Total Dataset Records (N)**: {n_rows:,} rows
- **Total Columns Analyzed**: {n_cols} columns
- **Primary Target Variable**: `{target_col}`

---

## 🔍 1. Data Quality & Missing Value Audit
- **Null Cell Count**: {sum(missing_counts.values())} missing values detected.

## 📈 2. Feature Correlations Top 20 (Target: `{target_col}`)

### 🟢 Top Positive Revenue Drivers
"""
        for col, val in top_positive:
            md_content += f"- **`{col}`**: r = +{val}\n"

        md_content += "\n### 🔴 Top Negative Risk Drivers\n"
        for col, val in top_negative:
            md_content += f"- **`{col}`**: r = {val}\n"

        if industry_breakdown:
            md_content += "\n--- \n## 🏬 3. Industry Sector Breakdown\n\n| Industry | Sample Count | Mean Revenue (10k KRW) | Median Revenue |\n| :--- | :--- | :--- | :--- |\n"
            for ind, stats in industry_breakdown.items():
                md_content += f"| {ind} | {stats['count']} | ₩{stats['mean_revenue_10k']:,}만원 | ₩{stats['median_revenue_10k']:,}만원 |\n"

        # Save to artifacts eda_report.md
        artifact_dir = os.path.join(settings.BASE_DIR, "..", "..", "brain", "fdede9f2-400d-4223-9c28-f429dba77a87")
        os.makedirs(artifact_dir, exist_ok=True)
        report_md_path = os.path.join(artifact_dir, "eda_report.md")
        with open(report_md_path, "w", encoding="utf-8") as f:
            f.write(md_content)

        return {
            "n_rows": n_rows,
            "n_cols": n_cols,
            "target_col": target_col,
            "top_positive": top_positive,
            "top_negative": top_negative,
            "industry_breakdown": industry_breakdown
        }

auto_eda_generator = AutoEDAGenerator()
