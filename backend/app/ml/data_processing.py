import numpy as np
import pandas as pd

FEATURE_NAMES = [
    # Demographics & Location
    "lat", "lng", "pop_total", "households", "age_20_30_ratio", "age_40_50_ratio",
    "workplace_pop", "resident_pop",
    # Foot Traffic & Dynamics
    "foot_traffic_daily", "foot_traffic_lunch", "foot_traffic_dinner", "dwell_time_avg",
    "foot_traffic_3yr_growth",
    # Expenditure & Consumption
    "card_sales_avg", "industry_spend_ratio", "avg_ticket_size",
    # Competition & Real Estate
    "competitor_count_100m", "competitor_count_500m", "openings_1yr", "closures_1yr",
    "competitor_density", "avg_operating_months", "rent_per_m2", "vacancy_rate",
    "building_age", "transit_passengers_daily",
    # Quality & Time
    "data_quality_score"
]

def generate_synthetic_commercial_dataset(n_samples: int = 1500, seed: int = 42) -> pd.DataFrame:
    """
    Generates realistic commercial district dataset based on Seoul Commercial District statistical distributions.
    Target monthly revenue varies naturally in 10,000 KRW (e.g. 1500 = 15M KRW, 8500 = 85M KRW).
    """
    np.random.seed(seed)
    
    lats = np.random.uniform(37.45, 37.65, n_samples)
    lngs = np.random.uniform(126.85, 127.15, n_samples)
    
    pop_total = np.random.randint(5000, 45000, n_samples).astype(float)
    households = (pop_total / np.random.uniform(2.1, 2.5, n_samples)).astype(float)
    age_20_30_ratio = np.random.uniform(0.18, 0.48, n_samples)
    age_40_50_ratio = np.random.uniform(0.20, 0.40, n_samples)
    
    resident_pop = (pop_total * np.random.uniform(0.7, 0.9, n_samples)).astype(float)
    workplace_pop = np.random.randint(2000, 50000, n_samples).astype(float)
    
    foot_traffic_daily = (workplace_pop * np.random.uniform(0.8, 2.5, n_samples) + resident_pop * 0.5).astype(float)
    foot_traffic_lunch = (foot_traffic_daily * np.random.uniform(0.25, 0.40, n_samples)).astype(float)
    foot_traffic_dinner = (foot_traffic_daily * np.random.uniform(0.30, 0.45, n_samples)).astype(float)
    dwell_time_avg = np.random.uniform(25, 90, n_samples)
    foot_traffic_3yr_growth = np.random.uniform(-0.15, 0.35, n_samples)
    
    card_sales_avg = np.random.uniform(12000, 65000, n_samples) # in KRW
    industry_spend_ratio = np.random.uniform(0.12, 0.45, n_samples)
    avg_ticket_size = np.random.uniform(8000, 45000, n_samples)
    
    competitor_count_100m = np.random.randint(1, 25, n_samples).astype(float)
    competitor_count_500m = (competitor_count_100m * np.random.randint(3, 12, n_samples)).astype(float)
    openings_1yr = np.random.randint(0, 10, n_samples).astype(float)
    closures_1yr = np.random.randint(0, 8, n_samples).astype(float)
    competitor_density = competitor_count_500m / 50.0
    avg_operating_months = np.random.uniform(14, 72, n_samples)
    
    rent_per_m2 = np.random.uniform(25000, 180000, n_samples) # KRW / m2
    vacancy_rate = np.random.uniform(0.02, 0.18, n_samples)
    building_age = np.random.uniform(2, 35, n_samples)
    transit_passengers_daily = np.random.randint(5000, 120000, n_samples).astype(float)
    data_quality_score = np.random.uniform(0.82, 0.99, n_samples)
    
    # Ground Truth Target physics with realistic variance
    base_revenue = (
        (foot_traffic_daily * 0.04) +
        (workplace_pop * 0.05) +
        (age_20_30_ratio * 3500.0) +
        (rent_per_m2 * 0.015) -
        (competitor_count_100m * 45.0) +
        np.random.normal(0, 300, n_samples)
    )
    target_monthly_revenue = np.clip(base_revenue, 1200.0, 9500.0) # 12M to 95M KRW
    
    success_score = (
        (target_monthly_revenue * 0.4) +
        (foot_traffic_3yr_growth * 2000.0) -
        (competitor_density * 400.0) -
        (vacancy_rate * 3000.0) +
        (avg_operating_months * 30.0)
    )
    target_success_label = (success_score > np.median(success_score)).astype(int)
    
    risk_score = (
        (closures_1yr * 2.5) +
        (competitor_density * 3.0) +
        (vacancy_rate * 50.0) -
        (foot_traffic_3yr_growth * 20.0) -
        (target_monthly_revenue / 1000.0)
    )
    risk_quantiles = np.quantile(risk_score, [0.4, 0.75])
    target_closure_risk = np.digitize(risk_score, risk_quantiles) # 0, 1, 2
    
    df = pd.DataFrame({
        "lat": lats, "lng": lngs, "pop_total": pop_total, "households": households,
        "age_20_30_ratio": age_20_30_ratio, "age_40_50_ratio": age_40_50_ratio,
        "workplace_pop": workplace_pop, "resident_pop": resident_pop,
        "foot_traffic_daily": foot_traffic_daily, "foot_traffic_lunch": foot_traffic_lunch,
        "foot_traffic_dinner": foot_traffic_dinner, "dwell_time_avg": dwell_time_avg,
        "foot_traffic_3yr_growth": foot_traffic_3yr_growth,
        "card_sales_avg": card_sales_avg, "industry_spend_ratio": industry_spend_ratio,
        "avg_ticket_size": avg_ticket_size, "competitor_count_100m": competitor_count_100m,
        "competitor_count_500m": competitor_count_500m, "openings_1yr": openings_1yr,
        "closures_1yr": closures_1yr, "competitor_density": competitor_density,
        "avg_operating_months": avg_operating_months, "rent_per_m2": rent_per_m2,
        "vacancy_rate": vacancy_rate, "building_age": building_age,
        "transit_passengers_daily": transit_passengers_daily,
        "data_quality_score": data_quality_score,
        "target_monthly_revenue": target_monthly_revenue,
        "target_success_label": target_success_label,
        "target_closure_risk": target_closure_risk
    })
    
    return df
