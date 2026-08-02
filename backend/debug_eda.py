from app.ml.data_processing import generate_synthetic_commercial_dataset, FEATURE_NAMES

df = generate_synthetic_commercial_dataset(n_samples=500, seed=42)

print("Null counts per column:")
print(df.isnull().sum()[df.isnull().sum() > 0])

print("\nDirect Correlation test:")
for col in FEATURE_NAMES:
    s_col = df[col]
    s_target = df["target_monthly_revenue"]
    c = s_col.corr(s_target)
    print(f"  {col}: {c}")
