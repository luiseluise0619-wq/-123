from app.ml.predict import inference_service

res = inference_service.analyze_district({
    "address": "서울시 성동구 성수동2가",
    "industry": "카페/디저트"
})

print("Backend Inference Test Success!")
print(f"Address: {res['address']}")
print(f"Decision Score: {res['decision_score']}")
print(f"Confidence Score: {res['confidence_score']}%")
print(f"Expected Revenue: ₩{res['expected_monthly_revenue']:,}원")
print(f"Success Probability: {res['success_probability_pct']}%")
print(f"Closure Risk: {res['closure_risk']}")
print(f"Opportunity Zone: {res['opportunity']['zone_label']}")
