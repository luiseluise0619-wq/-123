from app.ml.data_processing import generate_synthetic_commercial_dataset

df = generate_synthetic_commercial_dataset(n_samples=500, seed=42)

print("Target stats:")
print(df["target_monthly_revenue"].describe())

for col in df.columns:
    has_nan = df[col].isnull().any()
    has_inf = np.isinf(df[col]).any()
    print(f"Col {col}: std={df[col].std()}, has_nan={has_nan}, has_inf={has_inf}")
