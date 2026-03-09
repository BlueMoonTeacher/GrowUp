Write-Host "Starting Cloud Run Deployment for GrowUp..." -ForegroundColor Cyan

$SERVICE_NAME = "v1-01"
$PROJECT = "gen-lang-client-0151365128"
$REGION = "us-west1"
$PORT = 8080

Write-Host "Deploying service '$SERVICE_NAME' to project '$PROJECT' in region '$REGION'..."
gcloud run deploy $SERVICE_NAME --source . --region $REGION --project $PROJECT --allow-unauthenticated --port $PORT

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment process finished successfully!" -ForegroundColor Green
}
else {
    Write-Host "Deployment failed. Please check the error messages above." -ForegroundColor Red
}
