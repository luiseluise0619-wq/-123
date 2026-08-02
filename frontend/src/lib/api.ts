import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const MOCK_ANALYSIS_RESULT = {
  address: "서울시 성동구 성수동2가",
  industry: "카페/디저트",
  budget_krw: 100000000,
  floor_area_m2: 50,
  district_name: "성수동2가",
  expected_monthly_revenue: 38500000,
  success_probability_pct: 86.4,
  closure_risk: "LOW",
  decision_score: 88.5,
  confidence_score: 91.2,
  confidence_breakdown: {
    completeness_pct: 95.0,
    recency_pct: 92.0,
    model_stability_pct: 86.6
  },
  sub_scores: {
    success_prob_score: 86.4,
    revenue_score: 96.25,
    rent_efficiency_score: 75.0,
    competition_safety_score: 90.0,
    growth_score: 82.5
  },
  opportunity: {
    opportunity_score: 88.5,
    zone_type: "GREEN",
    zone_label: "기회 지역 (수요 성장 대비 공급 부족)",
    badge_color: "#10b981",
    components: {
      demand_growth_norm: 85.0,
      competition_growth_norm: 35.0,
      rent_efficiency_norm: 70.0
    }
  },
  shap_explanation: {
    positive_drivers: [
      { feature_kr: "20~30대 젊은 유동인구 비율", shap_value: 0.38, impact: "positive" },
      { feature_kr: "점심시간 직장인 인구 밀집", shap_value: 0.28, impact: "positive" },
      { feature_kr: "지하철 성수역 도보 5분 접근성", shap_value: 0.21, impact: "positive" },
      { feature_kr: "유동인구 3년 성장세", shap_value: 0.15, impact: "positive" }
    ],
    risk_factors: [
      { feature_kr: "반경 100m 주변 카페 밀집", shap_value: -0.19, impact: "negative" },
      { feature_kr: "상가 평당 임대료 수준", shap_value: -0.14, impact: "negative" }
    ],
    top_feature_importance: [
      { feature_kr: "20~30대 유동인구", importance_percent: 36.5 },
      { feature_kr: "직장인 점심 유동량", importance_percent: 24.2 },
      { feature_kr: "경쟁업체 밀집도", importance_percent: 18.3 },
      { feature_kr: "평당 임대료", importance_percent: 12.8 },
      { feature_kr: "유동인구 성장률", importance_percent: 8.2 }
    ]
  },
  what_if_simulation: {
    original_decision_score: 88.5,
    simulated_decision_score: 93.2,
    score_delta: 4.7,
    original_monthly_revenue: 38500000,
    simulated_monthly_revenue: 42000000,
    revenue_delta_krw: 3500000,
    applied_adjustments: {
      rent_change_pct: -20,
      floor_area_change_pct: 20
    },
    driver_explanations: [
      "임대료 20% 감면으로 고정비용 감축 ➔ 손익분기점 개선 (+4.7점)",
      "매장 면적 20% 확장으로 피크타임 회전율 향상 (예상 월매출 +350만원)"
    ]
  },
  raw_features_summary: {
    foot_traffic_daily: 34500,
    rent_per_m2: 55000,
    competitor_count_100m: 4,
    data_quality_score: 0.95
  }
};
