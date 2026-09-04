Write-Host "Starting Cloud Run Deployment for GrowUp..." -ForegroundColor Cyan

$PROJECT = "gen-lang-client-0151365128"

Write-Host "Building and deploying service 'v1-01' to project '$PROJECT'..."
gcloud builds submit --config cloudbuild.yaml --project $PROJECT .

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment Successful: https://v1-01-30846565412.us-west1.run.app" -ForegroundColor Green
}
else {
    Write-Host "Deployment failed. Please check the error messages above." -ForegroundColor Red
}
