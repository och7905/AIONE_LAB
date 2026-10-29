# AIONE LAB - Official Branding & 2026 Recruitment Website
> **대전대학교 컴퓨터공학 인공지능 연구실 (AIONE LAB)**  
> **Artificial Intelligence Operation for Network and Energy · SINCE 2023**  
> 공식 브랜딩 및 2026학년도 신규 연구원 모집 웹사이트

<p align="center">
  <img src="assets/logo.png" alt="AIONE LAB 공식 로고" width="140" style="border-radius: 50%;" />
</p>

![AIONE LAB Preview](https://img.shields.io/badge/AIONE_LAB-2026_Recruitment-0284c7?style=for-the-badge&logo=openai&logoColor=white)
![Tech](https://img.shields.io/badge/HTML5-CSS3-JavaScript_SPA-38bdf8?style=for-the-badge&logo=javascript&logoColor=white)
![GPU Cluster](https://img.shields.io/badge/GPU_Cluster-RTX_Blackwell_96GB-f59e0b?style=for-the-badge&logo=nvidia&logoColor=white)

---

## 🔬 3대 핵심 연구 분야 (Core Research Areas)
1. **AI 예지 보전 (AI Predictive Maintenance)**: 산업 설비·에너지 고장 사전 예측, 시계열 센서 이상 탐지(Anomaly Detection) 및 잔여 수명(RUL) 예측
2. **의료 AI (Medical AI)**: 의료 영상(X-ray, CT, MRI) 컴퓨터 비전 판독 및 병변 분할, 생체 신호(ECG/PPG) 분석, 임상 의사결정 보조(CDSS)
3. **자율주행 (Autonomous Driving)**: 센서 퓨전(LiDAR, Radar, Camera), 3D 객체 인식, 주행 경로 예측(Path Planning), 실시간 엣지 제어 최적화

---

## 🌟 주요 특징 (Key Features)

### 1. Futuristic Tech & AI Aesthetic
- **신경망 입자 인터랙션 (`canvas.js`)**: 마우스 커서에 반응하며 유기적으로 연결되는 노드-에지 신경망 시뮬레이션
- **글래스모피즘 & 사이버 랙 UI**: 고해상도 글래스모피즘(Backdrop Blur) 및 실시간 작동 램프(Online Pulse)가 적용된 서버 스펙 카드
- **다크 / 라이트 모드 완벽 지원**: 사용자 OS 환경 감지 및 수동 토글 지원, 로컬 스토리지에 테마 상태 저장

### 2. 연구실 공식 링크 및 대외 연동
- **연구실 공식 Google Site**: [https://sites.google.com/view/aionelab/education?authuser=0](https://sites.google.com/view/aionelab/education?authuser=0)
- **논문/특허 실적 확인**: [https://sites.google.com/view/aionelab/publications?authuser=0](https://sites.google.com/view/aionelab/publications?authuser=0)
- **랩장 개인 포트폴리오**: [https://och7905.github.io/Personal_Website_Deployment/](https://och7905.github.io/Personal_Website_Deployment/)

### 3. 연구진 (학부연구생 트랙)
- **전승현 지도교수**: 융합과학관 330호 (creemur@dju.kr / 042-280-2544)
- **오창현**: 랩장 (학부연구생 3기, 22학번)
- **권관우**: 학부연구생 3기 (22학번)
- **김지은**: 학부연구생 4기 (25학번)
- **장윤민**: 학부연구생 5기 (26학번)

### 3. 연구 인프라 & 하드웨어 스펙 시각화
- 연구원 전원에게 **독립 GPU 클러스터 계정** 발급
- **Windows 연구 워크스테이션 서버**: Intel Xeon w5-3433 | 64GB ECC | NVIDIA RTX PRO 6000 Blackwell Max-Q 96GB | Dell 006CX9
- **Linux 고성능 클러스터 서버**: AMD EPYC 9124 16-Core | 128GB ECC | NVIDIA RTX A4000 × 2 | ASUS K14PG-D24 Series

### 4. 2026 연구원 지원서 입력 폼 (#apply) & 백엔드 연동
- **11개 필수/선택 필드 완비**:
  1. 기본 인적사항 (성명, 학번, 학년, 연락처, 병역 구분)
  2. 단어 소개 (나를 표현하는 단어 및 이유)
  3. 지원동기 (실시간 글자 수 카운터, 최대 500자)
  4. 문제해결 경험 (실시간 글자 수 카운터, 최대 500자)
  5. 학업 계획 (실시간 글자 수 카운터, 최대 200자)
  6. 얻고자 하는 것 (실시간 글자 수 카운터, 최대 200자)
  7. 졸업 후 진로 계획 (실시간 글자 수 카운터, 최대 200자)
  8. 기술 스택 & 경험 (빠른 태그 선택 버튼 + 세부 입력)
  9. 희망 연구 및 활동
  10. 면접 가능 시간대
  11. 포트폴리오 URL 및 복수 파일 첨부 UI (다중 파일 드래그 앤 드롭 및 개별 파일 삭제 지원)
- **Formspree 실시간 비동기(AJAX) 메일 전송**:
  - 엔드포인트: `https://formspree.io/f/mzeevple`
  - 메일 제목 형식: `[AIONE LAB 신규 지원서] {이름} ({학번} / {학년})`
  - 전송 중 로딩 스피너 및 중복 제출 방지
- **제출 성공 시 UX**:
  - 성공 팝업 모달 (`och7905@naver.com` 발송 안내)
  - 지원자 백업 보관용 JSON 파일(`AIONE_지원서_{학번}_{이름}.json`) 자동 다운로드 트리거
  - 폼 초기화 및 로컬스토리지 임시 저장 데이터 자동 정리
- **로컬스토리지 자동 임시 저장**:
  - 작성 중 브라우저에 자동 임시 저장(`aione_application_draft`)되어 새로고침 시에도 즉시 복원
  - "임시 저장 비우기" 기능 제공
- **전송 실패 시 Fallback**:
  - 네트워크 오류 발생 시 작성 내용이 안전하게 담긴 `mailto:och7905@naver.com` 메일 클라이언트 자동 연동 및 백업 JSON 다운로드

---

## 📂 프로젝트 구조 (Directory Structure)

```
AIONE LAB/
├── index.html          # 메인 SPA 웹페이지 (반응형, 접근성, SEO 최적화)
├── css/
│   └── style.css       # 테마 토큰, 글래스모피즘, 반응형 애니메이션 스타일
├── js/
│   ├── canvas.js       # 인터랙티브 신경망 입자 캔버스 (60fps)
│   ├── main.js         # 테마 토글, 모바일 네비게이션, 토스트, 모달 제어
│   └── form.js         # 지원서 로직, 글자수 카운터, Formspree AJAX, JSON 백업
└── README.md           # 프로젝트 문서
```

---

## 🚀 실행 및 배포 방법 (How to Run & Deploy)

### 1. 로컬 환경에서 실행
외부 빌드 도구 설치 없이 `index.html` 파일을 크롬, 엣지, 웨일 등 브라우저로 더블 클릭하여 즉시 실행할 수 있습니다.

### 2. GitHub Pages 배포
1. 저장소(GitHub Repository)에 본 프로젝트 파일들을 푸시합니다.
2. `Settings` > `Pages` 이동
3. Branch를 `main` 또는 `master`의 `/(root)`로 지정 후 `Save`를 클릭하면 1분 이내에 전 세계 어디서나 접근 가능한 URL로 자동 배포됩니다.

### 3. Vercel 또는 Netlify 배포
- 별도의 빌드 커맨드 없이 프로젝트 루트를 지정하면 즉시 글로벌 CDN에 배포됩니다.

---

## 📞 문의처 (Contact)

- **연구실 위치**:
  - **AIONE LAB 학생 연구실**: 대전광역시 동구 대학로 62 (대전대학교 서문 방면 융합과학관 217호)
  - **전승현 지도교수 연구실**: 대전대학교 서문 방면 융합과학관 330호
- **지도교수**: 전승현 교수 (대전대학교 컴퓨터공학 학회장 / 사물인터넷(IoT))
  - 연구실: 융합과학관 330호
  - 전화: 042-280-2544 (구내 2544)
  - 이메일: [creemur@dju.kr](mailto:creemur@dju.kr)
- **랩장**: 오창현 (3기)
  - 연구실: 융합과학관 217호
  - 이메일: [och7905@naver.com](mailto:och7905@naver.com)
  - 연락처: 010-9347-7906
  - 개인 웹사이트: [https://och7905.github.io/Personal_Website_Deployment/](https://och7905.github.io/Personal_Website_Deployment/)
