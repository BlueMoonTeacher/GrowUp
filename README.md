<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b162ce2d-c429-4ae9-9e43-06a9b56ec795

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

Gemini 기능은 로그인 후 설정 화면에 등록한 교사 개인 API 키를 사용합니다.
학생자료를 처리할 때에는 결제 수단이 연결된 Google Cloud 프로젝트에서 발급한 유료 서비스 키를 사용하세요.

- 기본 모델: `gemini-3.8-flash` (GA)
- 교사 API 키는 Cloud Run API가 Firebase ID 토큰을 확인한 뒤 Cloud KMS로 암호화합니다.
- 암호문은 `_privateGeminiCredentials/{uid}`에 저장되며 클라이언트의 Firestore 규칙에서는 접근할 수 없습니다.
- AI 호출 시에만 서버 메모리에서 키를 복호화하며 프롬프트·응답·키를 서버 로그에 기록하지 않습니다.

## Deployment projects

- Cloud Run 운영 프로젝트: `gen-lang-client-0151365128` (`https://v1-01-30846565412.us-west1.run.app`)
- Firebase Auth·Firestore·Storage 프로젝트: `forstudents-e1117`
- 배포: `./deploy.ps1` 또는 `gcloud builds submit --config cloudbuild.yaml --project gen-lang-client-0151365128 .`

### 개인 API 키 저장에 필요한 Cloud KMS 설정

KMS 키가 있는 Firebase 프로젝트뿐 아니라 **호출하는 Cloud Run 프로젝트**에서도
Cloud KMS API가 활성화되어 있어야 합니다. 런타임 계정에 암호화 권한이 있어도
호출 프로젝트의 API가 비활성화되어 있으면 키 저장과 AI 호출이 실패합니다.

```sh
gcloud services enable cloudkms.googleapis.com --project=gen-lang-client-0151365128
gcloud services enable cloudkms.googleapis.com --project=forstudents-e1117
```

런타임 계정은 `cloudrun.service.yaml`에 지정하며, Firebase 프로젝트의
`roles/datastore.user`와 해당 KMS 키의 `roles/cloudkms.cryptoKeyEncrypterDecrypter`가 필요합니다.
키 저장 실패 로그는 `gemini-key-save-failure`의 `phase` (`encrypt` / `store`)와
상태 코드만 기록합니다. 실제 키나 요청 본문은 기록하지 않습니다.
