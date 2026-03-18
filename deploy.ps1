Write-Host "Starting Cloud Run Deployment for GrowUp..." -ForegroundColor Cyan

$SERVICE_NAME = "v1-01"
$PROJECT = "gen-lang-client-0151365128"
$REGION = "us-west1"
$PORT = 8080

Write-Host "Deploying service '$SERVICE_NAME' to project '$PROJECT' in region '$REGION'..."
# 요청 기반 청구: 요청 처리 중에만 CPU 과금 (--no-cpu-throttling이면 인스턴스 전체 수명 주기 과금)
# min-instances 0: 유휴 시 인스턴스 유지 비용 방지
gcloud run deploy $SERVICE_NAME --source . --region $REGION --project $PROJECT `
  --allow-unauthenticated --port $PORT `
  --cpu-throttling `
  --min-instances=0

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment process finished successfully!" -ForegroundColor Green
}
else {
    Write-Host "Deployment failed. Please check the error messages above." -ForegroundColor Red
}
