// Source of truth: linkedin.com/in/hsolim + Profile.pdf
window.HSOL_DATA = {
  identity: {
    name: "임한솔",
    nameEn: "Hansol Lim",
    handle: "hsolim",
    tagline: "온라인의 기술 — 오프라인의 운영",
    taglineSub: "End-to-End 프로세스 설계 및 최적화",
    location: "서울, 대한민국",
    email: "molmoty@gmail.com",
    linkedin: "https://www.linkedin.com/in/hsolim/",
    portfolio: "https://hsol.info",
    company: "https://proofer.tech",
    calendly: "https://calendly.com/contact-hsol/coffee-chat",
    gravatar: "https://gravatar.com/hsolim",
  },

  // 대표 보유 기술 (LinkedIn에 직접 명시)
  pillars: [
    {
      key: "strategic",
      label: "Strategic Thinking",
      labelKo: "전략적 사고",
      blurb: "흩어진 부분을 하나의 시스템으로 연결합니다. 부서·채널·역할을 가로지르는 구조를 설계해 비즈니스가 확장 가능한 형태로 작동하게 만듭니다.",
    },
    {
      key: "customer",
      label: "Customer Centricity",
      labelKo: "고객 중심 사고",
      blurb: "기능보다 경험을, 산출물보다 사용 맥락을 먼저 봅니다. 사내 제품도 결국 사람이 쓰는 도구라는 관점에서 설계해왔습니다.",
    },
    {
      key: "design",
      label: "Design Thinking",
      labelKo: "디자인적 사고",
      blurb: "엔지니어로 시작했지만 코드는 도구일 뿐입니다. 문제를 다시 정의하고, 작은 가설로 검증한 뒤, 합리적인 형태로 깎아냅니다.",
    },
  ],

  // 페르소나 분기
  personas: [
    {
      key: "hire",
      mark: "01",
      title: "채용·영입을 검토 중이에요",
      titleEn: "Considering hiring or onboarding",
      hint: "역량 · 경력 흐름 · 강점 위주로 보여드릴게요.",
    },
    {
      key: "collab",
      mark: "02",
      title: "창업·협업·자문이 필요해요",
      titleEn: "Looking for a collaborator or advisor",
      hint: "프루퍼 · 라이트형제 · PPB의 일하는 방식을 소개합니다.",
    },
    {
      key: "builder",
      mark: "03",
      title: "비슷한 일을 하는 빌더예요",
      titleEn: "Fellow builder / engineer",
      hint: "기술 스택, AI Native 워크플로우, 개발자 생산성 관점.",
    },
    {
      key: "curious",
      mark: "04",
      title: "그냥 한솔이라는 사람이 궁금해요",
      titleEn: "Just curious about Hansol",
      hint: "커리어 궤적과 사고방식을 시간순/주제순으로.",
    },
  ],

  // 경력 (역순 — 최신이 위)
  career: [
    {
      org: "프루퍼 ㈜",
      orgEn: "Proofer Inc.",
      role: "대표 (CEO)",
      period: "2025.04 — 현재",
      tags: ["창업", "AX", "B2B"],
      points: [
        "전통산업의 DX → AX 를 통한 기업가치 향상",
        "업무 효율화 & 자동화",
        "웹/모바일 애플리케이션 소프트웨어 외주",
      ],
      tier: 1,
    },
    {
      org: "PPB Studios Co.",
      orgEn: "PPB Studios",
      role: "팀장",
      period: "2025.06 — 현재",
      tags: ["옴니채널", "DT", "리테일"],
      points: [
        "물류 — 가맹 — MD — 브랜드를 잇는 옴니채널 생태계 구축",
        "Operations: 물류 프로세스와 가맹점 오프라인 경험을 디지털로 전환",
        "Service: 온-오프라인을 아우르는 옴니 플랫폼으로 확장성 확보",
        "Integration: MD/브랜드 등 부서별 목표를 하나의 플랫폼으로 조율",
        "AI Native 팀 문화 구축 · Claude Code + Linear 기반 바이브 코딩 프로토콜 설계/도입",
      ],
      tier: 1,
    },
    {
      org: "프루퍼 ㈜",
      orgEn: "Proofer Inc.",
      role: "CTO",
      period: "2024.01 — 2025.04",
      tags: ["창업", "개발자 생산성"],
      points: [
        "스타트업 창업 — 개발자 생산성 영역",
        "뉴스레터 \"Measurable Developer\" 발행",
        "개발자 성과관리 대시보드 \"프루퍼 인사이트\"",
        "지속적 개발자 평가 솔루션 \"프루퍼 데브엠\"",
      ],
      tier: 1,
    },
    {
      org: "(주) 라이트형제",
      orgEn: "Light Brothers",
      role: "Non Executive Director",
      period: "2023.02 — 2025.04",
      tags: ["자문", "초기기업"],
      points: [
        "예비창업기업·초기기업 대상 서비스 기획 및 개발 기술 자문",
        "비즈니스 모델 설계, 제품 전략, 확장 가능한 기술 아키텍처 구축 지원",
      ],
      tier: 2,
    },
    {
      org: "Antler",
      orgEn: "Antler",
      role: "Entrepreneur in Residence",
      period: "2023.10 — 2023.12",
      tags: ["VC", "EIR"],
      points: [
        "글로벌 초기단계 VC 프로그램 참여",
      ],
      tier: 2,
    },
    {
      org: "토스 (Viva Republica)",
      orgEn: "Viva Republica",
      role: "Internal Product Developer",
      period: "2018.11 — 2023.08 (4년 10개월)",
      tags: ["인터널 제품", "토스"],
      points: [
        "사내 웹/앱 포털 \"토스인터널\" 개발",
        "근태관리 애플리케이션 \"티티(time-tracker)\"",
        "수습평가시스템 \"3 month review\"",
        "사내 매거진 \"비바뉴스\", 슬랙봇, 다수 인터널 제품",
        "데이터 기반으로 문제단계부터 디벨롭 → 설계 → 개발 → 배포",
      ],
      tier: 1,
    },
    {
      org: "리디북스 (Ridibooks)",
      orgEn: "Ridibooks",
      role: "Software Engineer",
      period: "2016.11 — 2018.11",
      tags: ["CMS", "B2B 도구"],
      points: [
        "리디북스 CMS 유지관리 및 기능개발",
        "CP(Contents Provider) 사이트 — 작가/매니저 업무 플랫폼",
        "도서메타정보관리시스템 운영 및 기능개발",
      ],
      tier: 2,
    },
    {
      org: "씨엔티테크 (CNT Tech)",
      orgEn: "CNT Tech",
      role: "Software Engineer",
      period: "2014.08 — 2016.11",
      tags: ["풀스택", "외주개발"],
      points: [
        "여러 프랜차이즈 홈페이지 / 주문시스템 / 모바일 앱 개발",
        "Java/Spring · ASP.NET · PHP · JSP — 다양한 스택 경험",
      ],
      tier: 3,
    },
  ],

  education: [
    { school: "건국대학교", degree: "경영공학사 — Advanced Industry Fusion", period: "2018 — 2022" },
    { school: "선린인터넷고등학교", degree: "정보통신과", period: "2012 — 2014" },
  ],

  certifications: ["웹디자인기능사", "정보처리기능사"],
  languages: [
    { name: "한국어", level: "Native or Bilingual" },
    { name: "English", level: "Limited Working" },
  ],
  publications: [
    {
      title: "메이커와 엔지니어 — 개발자가 됐습니다. 그 다음은요?",
      desc: "엔지니어 그 이후의 커리어에 대한 글",
    },
  ],

  // FAQ — Claude 보조 답변용 시드 + 기본 답변
  faq: [
    {
      q: "지금은 무슨 일을 하고 있나요?",
      a: "프루퍼 ㈜ 대표로 전통산업의 DX → AX 전환을 돕고, 동시에 PPB Studios에서 물류·가맹·브랜드를 잇는 옴니채널 플랫폼 팀을 이끌고 있습니다.",
    },
    {
      q: "어떤 사람과 어떤 회사에 잘 맞나요?",
      a: "기술과 운영 사이에 다리가 필요한 곳, 부서가 분절돼 있어 \"하나의 시스템\"으로 묶는 일이 필요한 곳에 잘 맞습니다. 토스에서는 인터널 제품을, PPB에서는 옴니채널을, 프루퍼에서는 개발자 생산성을 — 모두 \"흩어진 것을 잇는 일\"이었습니다.",
    },
    {
      q: "AI를 어떻게 쓰고 있나요?",
      a: "Claude Code + Linear 기반의 바이브 코딩 프로토콜을 설계해 PPB 팀에 도입했고, 도메인별 반복 업무의 AI 전환을 코칭합니다. AI는 도구가 아니라 팀 문화로 가져가야 효과가 납니다.",
    },
    {
      q: "코드를 직접 짜나요?",
      a: "10년 차 엔지니어 출신이고 지금도 짭니다. 다만 \"코드를 쓰는 사람\"보다 \"무엇을 만들지 결정하는 사람\"으로서의 비중이 더 큽니다.",
    },
    {
      q: "커피챗 가능한가요?",
      a: "네, calendly.com/contact-hsol/coffee-chat 에서 시간을 잡아주세요. 채용/창업/협업/그냥 궁금함 — 어떤 주제든 환영합니다.",
    },
    {
      q: "연락처는?",
      a: "molmoty@gmail.com 또는 LinkedIn(/in/hsolim) 메시지. 빠른 응답을 원하시면 커피챗 링크가 가장 좋습니다.",
    },
    {
      q: "강점은 무엇인가요?",
      a: "전략적 사고 · 고객 중심 사고 · 디자인적 사고 — 세 가지를 본인이 직접 꼽고 있습니다. 엔지니어로 출발해 인터널 제품, 창업, 옴니채널까지 \"문제의 형태를 다시 그리는 일\"을 반복해왔습니다.",
    },
  ],
};
