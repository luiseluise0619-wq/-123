# Model Card: AI Local Intelligence v2.0 (4,644 Records Big Data)

- **Data Source**: Seoul Commercial Big Data (4,644 records across 425 administrative dongs in 25 Gus)
- **Model Type**: LightGBM Multi-Model Ensemble (Regressor + Classifiers)
- **Features Used (18)**: foot_traffic_daily, foot_traffic_dinner, workplace_pop, foot_traffic_lunch, age_40_50_ratio, openings_1yr, households, age_20_30_ratio, industry_spend_ratio, building_age, resident_pop, transit_passengers_daily, rent_per_m2, avg_ticket_size, competitor_count_100m, closures_1yr, foot_traffic_3yr_growth, pop_total
- **Revenue Predictor Performance**: RMSE=1238.01 (Baseline=2357.51, R2=0.7242)
- **Success Rate Classifier Accuracy**: 0.8827 (ROC-AUC=0.9155)
- **Closure Risk Classifier Accuracy**: 0.7718 (ROC-AUC=0.85)
