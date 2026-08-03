@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0backend"

echo ============================================
echo   서울 상권분석 데이터 수집기
echo ============================================
echo.

REM 파이썬 설치 확인
python --version >nul 2>&1
if errorlevel 1 (
  echo [오류] 파이썬이 설치돼 있지 않습니다.
  echo   https://www.python.org/downloads/ 에서 설치 후
  echo   설치 화면에서 "Add Python to PATH" 를 꼭 체크하세요.
  echo.
  pause
  exit /b 1
)

echo [1/3] 필요한 패키지 설치 중... (처음 한 번만 시간이 걸려요)
pip install -r requirements.txt >nul 2>&1

echo.
set /p KEY="[2/3] 서울 열린데이터광장 인증키를 붙여넣고 Enter: "
set SEOUL_OPENDATA_API_KEY=%KEY%

echo.
echo [3/3] 서비스 점검 후 데이터 수집을 시작합니다...
echo.
python build_seoul_dataset.py --test
echo.
echo --- 위에 [ERROR] 가 있으면 캡처해서 Claude 에게 보내세요 (없으면 그대로 진행) ---
echo.
pause
python build_seoul_dataset.py --build

echo.
echo ============================================
echo   [4/4] 실제 데이터로 모델 학습 중...
echo ============================================
set USE_REAL_DATA=true
python -m app.ml.train

echo.
echo ============================================
echo   전부 완료!
echo   - 데이터: backend\app\data\real_data\seoul_trdar_dataset.csv
echo   - 학습된 모델: backend\app\ml\registry\v1\ 에 갱신됨
echo ============================================
echo.
echo 이 CSV 는 수백 MB 라 GitHub 에 올리지 않습니다 (로컬 보관).
echo 위 화면에 나온 [행 수 / 열 수 / R2 지표] 를 캡처해서 Claude 에게 보내주세요.
echo.
pause
