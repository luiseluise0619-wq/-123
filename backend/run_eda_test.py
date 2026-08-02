from app.ml.data_processing import generate_synthetic_commercial_dataset, FEATURE_NAMES

df = generate_synthetic_commercial_dataset(n_samples=2000, seed=42)
print("Columns in DataFrame:", df.columns.tolist())
corrs = {}
for col in FEATURE_NAMES:
    if col in df.columns:
        val = df[col].corr(df["target_monthly_revenue"])
        corrs[col] = val

sorted_corrs = sorted(corrs.items(), key=lambda x: x[1], reverse=True)
print("Top Positive Correlations with Monthly Revenue Target:")
for col, val in sorted_corrs[:6]:
    print(f"  - {col}: {val:.4f}")

print("\nTop Negative Correlations with Monthly Revenue Target:")
for col, val in sorted_corrs[-5:]:
    print(f"  - {col}: {val:.4f}")
