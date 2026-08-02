# Production Automated EDA Report

- **Total Dataset Records (N)**: 4,644 rows
- **Total Columns Analyzed**: 37 columns
- **Primary Target Variable**: `monthly_revenue`

---

## 🔍 1. Data Quality & Missing Value Audit
- **Null Cell Count**: 0 missing values detected.

## 📈 2. Feature Correlations Top 20 (Target: `monthly_revenue`)

### 🟢 Top Positive Revenue Drivers
- **`foot_traffic_daily`**: r = +0.8133
- **`foot_traffic_dinner`**: r = +0.8008
- **`foot_traffic_lunch`**: r = +0.7914
- **`workplace_pop`**: r = +0.7841
- **`success_label`**: r = +0.7378
- **`rent_per_m2`**: r = +0.1731
- **`avg_ticket_size`**: r = +0.1363
- **`age_20_30_ratio`**: r = +0.0974
- **`card_sales_avg`**: r = +0.0937
- **`resident_pop`**: r = +0.0681

### 🔴 Top Negative Risk Drivers
- **`closure_risk`**: r = -0.4744
- **`lng`**: r = -0.0303
- **`dwell_time_avg`**: r = -0.0251
- **`vacancy_rate`**: r = -0.024
- **`industry_spend_ratio`**: r = -0.0131
- **`data_quality_score`**: r = -0.006
- **`avg_operating_months`**: r = -0.0032
- **`age_40_50_ratio`**: r = -0.0026
- **`foot_traffic_3yr_growth`**: r = -0.0005
- **`building_age`**: r = 0.0076

--- 
## 🏬 3. Industry Sector Breakdown

| Industry | Sample Count | Mean Revenue (10k KRW) | Median Revenue |
| :--- | :--- | :--- | :--- |
| 미용/뷰티 | 927 | ₩2,743.9만원 | ₩2,293.8만원 |
| 병의원/클리닉 | 923 | ₩5,435.7만원 | ₩4,576.5만원 |
| 소매/패션 | 928 | ₩2,980.2만원 | ₩2,399.4만원 |
| 음식점/식당 | 950 | ₩3,379.9만원 | ₩2,894.5만원 |
| 카페/디저트 | 916 | ₩2,644.0만원 | ₩2,153.2만원 |
