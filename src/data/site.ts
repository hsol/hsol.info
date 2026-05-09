import { siteDataSchema } from "@/content/schema";

/** Generated from vault/object-views/site-data.json */
export const HSOL_DATA = siteDataSchema.parse({
  "identity": {
    "name": "임한솔",
    "nameEn": "Hansol Lim",
    "handle": "hsolim",
    "tagline": "온라인의 기술 — 오프라인의 운영",
    "taglineSub": "End-to-End 프로세스 설계 및 최적화",
    "location": "서울, 대한민국",
    "email": "molmoty@gmail.com",
    "linkedin": "https://www.linkedin.com/in/hsolim/",
    "portfolio": "https://hsol.info",
    "company": "https://proofer.tech",
    "calendly": "https://calendly.com/contact-hsol/coffee-chat",
    "gravatar": "https://gravatar.com/hsolim"
  },
  "pillars": [
    {
      "key": "strategic",
      "label": "Strategic Thinking",
      "labelKo": "전략적 사고",
      "blurb": "흩어진 부분을 하나의 시스템으로 연결합니다. 부서·채널·역할을 가로지르는 구조를 설계해 비즈니스가 확장 가능한 형태로 작동하게 만듭니다."
    },
    {
      "key": "customer",
      "label": "Customer Centricity",
      "labelKo": "고객 중심 사고",
      "blurb": "기능보다 경험을, 산출물보다 사용 맥락을 먼저 봅니다. 사내 제품도 결국 사람이 쓰는 도구라는 관점에서 설계해왔습니다."
    },
    {
      "key": "design",
      "label": "Design Thinking",
      "labelKo": "디자인적 사고",
      "blurb": "엔지니어로 시작했지만 코드는 도구일 뿐입니다. 문제를 다시 정의하고, 작은 가설로 검증한 뒤, 합리적인 형태로 깎아냅니다."
    }
  ],
  "personas": [
    {
      "key": "hire",
      "mark": "01",
      "title": "채용·영입을 검토 중이에요",
      "titleEn": "Considering hiring or onboarding",
      "hint": "역량 · 경력 흐름 · 강점 위주로 보여드릴게요."
    },
    {
      "key": "collab",
      "mark": "02",
      "title": "창업·협업·자문이 필요해요",
      "titleEn": "Looking for a collaborator or advisor",
      "hint": "함께 일할 때의 모습과 일하는 방식을 보여드릴게요."
    },
    {
      "key": "builder",
      "mark": "03",
      "title": "비슷한 일을 하는 빌더예요",
      "titleEn": "Fellow builder / engineer",
      "hint": "기술 스택, AI Native 워크플로우, 개발자 생산성 관점."
    },
    {
      "key": "curious",
      "mark": "04",
      "title": "그냥 한솔이라는 사람이 궁금해요",
      "titleEn": "Just curious about Hansol",
      "hint": "커리어 궤적과 사고방식을 시간순/주제순으로."
    }
  ],
  "viewHeaders": {
    "hire": {
      "titleLines": [
        "10년 차 엔지니어,",
        "제품·운영·창업을 거친 사람."
      ],
      "lede": "엔지니어로 시작해 토스 인터널 제품 4년 10개월, 두 번의 창업, 옴니채널 플랫폼 리드까지 — \"기능을 잘 만드는 사람\"보다 \"무엇을 만들지 정하고 끝까지 가져가는 사람\"으로 자랐습니다."
    },
    "collab": {
      "titleLines": [
        "기술과 운영 사이,",
        "다리를 놓는 일을 합니다."
      ],
      "lede": "지금 두 곳에서 — 프루퍼(대표), PPB Studios(팀장) 으로 동시에 움직이고 있습니다. 공통점은 모두 “흩어진 부서·채널·역할을 하나의 시스템으로 묶는 일”이라는 점입니다."
    },
    "builder": {
      "titleLines": [
        "코드도 짜고,",
        "무엇을 만들지도 정합니다."
      ],
      "lede": "2014년 외주개발사 풀스택부터, 리디·토스 인터널 제품, 그리고 지금은 AI Native 워크플로우와 개발자 생산성 — 10년 동안 “제품을 만든다는 것”의 정의를 계속 갱신해 왔습니다."
    },
    "curious": {
      "titleLines": [
        "한 사람의 10년치",
        "궤적을 펼쳐놓으면."
      ],
      "lede": "엔지니어 → 인터널 제품 메이커 → 자문가 → 창업가 → 옴니채널 리드 — 한 줄로 적으면 점프처럼 보이지만 사이사이는 이어져 있습니다. 시간순으로 천천히 따라가보셔도 좋습니다."
    }
  },
  "portfolioCopy": {
    "home": {
      "heroEyebrow": "hsol.info — a portfolio in plan view",
      "heroTitleLines": [
        "온라인의 기술과",
        "오프라인의 운영을 잇는",
        "임한솔입니다."
      ],
      "heroSubLead": "10년이상 경력의 엔지니어이자 스타트업을 창업한 메이커. 씨엔티테크 → 리디북스 → 토스 인터널 제품팀을 거쳐, 지금은",
      "heroSubEmphasis": "프루퍼 ㈜ 대표이자 PPB Studios 팀장",
      "heroSubTail": "으로 일하고 있습니다. 아래에서 가장 가까운 항목을 골라주세요. 그에 맞춰 이야기를 정리해 드릴게요.",
      "doorsTitle": "어떤 이유로 오셨어요?",
      "doorsMeta": "Why are you here today",
      "builtTitle": "이 홈페이지는 어떻게 만든거에요?",
      "builtMeta": "How this site was made",
      "builtBody": "Next.js(App Router)와 TypeScript로 만들었고 Vercel에 배포해 두었어요. 프로필·카피는 vault에서 관리하는 데이터를 생성·갱신해 반영합니다. 아래 Ask Hansol은 같은 문서 맥락을 참고해 답하도록 묶여 있어요.",
      "builtCards": [
        {
          "title": "목표",
          "body": "마크다운 한 파일을 추가하면 이력서·포트폴리오·자기소개·챗봇 답변까지 같이 갱신되는 개인 표현 인프라를 만드는 것이 목표입니다."
        },
        {
          "title": "데이터 흐름",
          "body": "knowledge base를 단일 소스로 두고, CI에서 LLM이 정규화한 뒤 zod 검증과 빌드 타임 스냅샷을 거쳐 SSR 화면과 Ask Hansol까지 같은 사실을 공유합니다."
        },
        {
          "title": "신뢰성 패턴",
          "body": "원격 캐시 → 로컬 → 빌드 스냅샷의 다단 폴백, 토큰 폴백, 캐시 TTL, 실패 아티팩트 보존으로 운영 안정성을 확보합니다."
        },
        {
          "title": "경험 설계",
          "body": "홈의 4개 페르소나(Hire/Collab/Builder/Curious)는 동일한 사실을 다른 우선순위로 보여주고, Ask Hansol은 화면 컨텍스트를 참고해 답변 흐름을 맞춥니다."
        }
      ],
      "builtMermaid": "flowchart LR; KB[Knowledge Base] --> NORM[LLM Normalization]; NORM --> ZOD[Zod Validation]; ZOD --> SNAP[Site Data Snapshot]; SNAP --> SSR[SSR Portfolio Views]; SNAP --> ASK[Ask Hansol Chat];",
      "builtFlow": [
        {
          "label": "Knowledge Base"
        },
        {
          "label": "LLM Normalization (CI)"
        },
        {
          "label": "Zod Validation"
        },
        {
          "label": "SSR + Ask Hansol"
        }
      ],
      "builtPerspectiveTitle": "홈페이지를 바라보는 관점",
      "builtPerspectiveMeta": "Perspectives from introduction backdata",
      "builtPerspectives": [
        {
          "title": "구직자 관점 — 갱신할 일이 없게 만드는 포트폴리오",
          "summary": "source of truth를 knowledge base 한 곳으로 두고, CI가 사이트 데이터와 자기소개 표현을 자동 재생성해 갱신 비용을 최소화합니다."
        },
        {
          "title": "채용 담당자 관점 — 미팅 전에 의문을 해소하는 인터페이스",
          "summary": "4개 페르소나 뷰와 Ask Hansol이 질문 맥락을 받아 비동기 인터뷰처럼 작동해, 후보자 이해를 미팅 전에 빠르게 돕습니다."
        },
        {
          "title": "AI/LLM 엔지니어 관점 — 개인형 RAG 레퍼런스 구현",
          "summary": "retrieval 라우팅, 메모리 롤업, 다단 폴백을 결합해 한 사람을 모델링하는 production-grade personal RAG 패턴을 구현합니다."
        },
        {
          "title": "자가 운영 사이트 관점 — 스스로 갱신되는 운영 체계",
          "summary": "마크다운 업데이트 이후 빌드·검증·배포가 자동으로 이어지는 self-refreshing 파이프라인으로 사이트 노화를 방지합니다."
        }
      ],
      "coffeeEyebrow": "— Coffee chat",
      "coffeeTitle": "시간 괜찮으시면 30분만 같이 이야기해요.",
      "coffeeBody": "여기까지 읽어주셨다면, 그것만으로도 감사합니다. 더 궁금한 얘기가 있다면 직접 만나서 나누고 싶어요.",
      "coffeeButtonLabel": "30분 커피챗 예약하기",
      "heroMetaSinceLabel": "SINCE",
      "heroMetaSinceValue": "2014",
      "heroMetaNowLabel": "NOW",
      "heroMetaNowValue": "Proofer · PPB",
      "heroMetaBaseLabel": "BASE",
      "heroMetaBaseValue": "서울"
    },
    "hire": {
      "factsYearsLabel": "Years",
      "factsYearsValue": "10년+ (since 2014)",
      "factsBaseLabel": "Base",
      "factsEducationLabel": "Education",
      "factsLanguagesLabel": "Languages",
      "coffee": {
        "title": "이력서 한 장으로는 다 담기지 않는 이야기가 있습니다.",
        "sub": "30분 커피챗으로, 어떤 자리에 어떤 기여가 가능할지 직접 이야기 나눠요."
      }
    },
    "collab": {
      "methods": [
        {
          "no": "METHOD · 01",
          "name": "문제부터 다시 그린다",
          "en": "Reframe before build",
          "blurb": "의뢰가 들어와도 “그게 정말 그 문제냐“부터 묻습니다. 토스 인터널도, PPB의 옴니채널도 의뢰받은 명세 그대로가 아니라 한 단계 위에서 다시 정의한 결과였습니다."
        },
        {
          "no": "METHOD · 02",
          "name": "가설을 가장 작게 잘라낸다",
          "en": "Smallest viable test",
          "blurb": "한 번에 큰 시스템을 만들지 않습니다. 가장 작고 가장 빨리 검증 가능한 형태로 잘라낸 뒤, 진짜 사용 데이터를 보고 다음 한 걸음을 정합니다."
        },
        {
          "no": "METHOD · 03",
          "name": "AI를 도구가 아닌 문화로",
          "en": "AI as culture",
          "blurb": "PPB에서는 Claude Code + Linear 기반 바이브 코딩 프로토콜을 설계해 도입했습니다. 도메인별 반복 업무의 AI 전환을 코칭하며, 팀이 AI Native하게 일하게 만드는 일을 합니다."
        }
      ],
      "coffee": {
        "title": "협업의 형태는 자유입니다.",
        "sub": "자문 · 공동 창업 · 기술 파트너십 · 단발성 컨설팅 — 무엇이든 30분 통화부터 시작해요."
      }
    },
    "builder": {
      "facts": [
        {
          "label": "언어 / 런타임",
          "value": "TypeScript · Python · Java · PHP · ASP.NET (legacy)"
        },
        {
          "label": "관심 도메인",
          "value": "Internal tools · Developer productivity · Omni-channel · AX"
        },
        {
          "label": "AI workflow",
          "value": "Claude Code · Linear · Vibe coding protocol"
        }
      ],
      "certificationLabel": "자격",
      "extraWritings": [
        {
          "no": "PIECE · 02",
          "name": "Measurable Developer",
          "en": "Newsletter",
          "blurb": "개발자 생산성을 측정 가능한 형태로 다루는 뉴스레터. 프루퍼 CTO 시절부터 발행해 왔습니다."
        },
        {
          "no": "PIECE · 03",
          "name": "Claude Code + Linear 프로토콜",
          "en": "Internal playbook",
          "blurb": "PPB에 도입한 바이브 코딩 프로토콜 — 요구사항 분석부터 태스크 관리·구현까지의 워크플로우를 재정의합니다."
        }
      ],
      "coffee": {
        "title": "비슷한 문제를 풀고 있다면, 이야기해봐요.",
        "sub": "개발자 생산성, 인터널 툴, AI 도입, 옴니채널 — 한쪽이 일방적으로 가르치는 자리가 아니라 서로의 지도를 나누는 자리로."
      }
    },
    "curious": {
      "timeline": [
        {
          "year": "2012 — 2014",
          "title": "선린인터넷고등학교 정보통신과",
          "desc": "한국 IT업계의 인재 양성소로 알려진 특성화고. 일반 인문계와 달리 고등학교 시절부터 실무에 가까운 프로그래밍·시스템·네트워크를 다뤘습니다. 어릴 적부터 취미로 해 온 코딩을 본격적인 진로로 가져간 시기. 웹디자인기능사·정보처리기능사를 땄습니다."
        },
        {
          "year": "2014 — 2016",
          "title": "씨엔티테크",
          "desc": "프랜차이즈 도메인의 풀스택 외주 개발자로 사회생활 시작. ASP.NET, JSP, PHP — 가리지 않고 썼습니다."
        },
        {
          "year": "2016 — 2018",
          "title": "리디북스",
          "desc": "B2B 도구 — CMS와 작가/매니저 플랫폼을 만들며 “내부 사용자“라는 관점을 처음 익혔습니다."
        },
        {
          "year": "2018 — 2023",
          "title": "토스 인터널 제품팀, 4년 10개월",
          "desc": "토스인터널, 티티(time-tracker), 3 month review, 비바뉴스 — 동료들이 매일 쓰는 제품을 만드는 일이 가장 즐거웠습니다."
        },
        {
          "year": "2018 — 2022",
          "title": "건국대학교 경영공학사",
          "desc": "Advanced Industry Fusion 전공. 일하면서 학교를 다녔습니다."
        },
        {
          "year": "2023.10 — 2023.12",
          "title": "Antler EIR",
          "desc": "글로벌 초기 VC 프로그램. 창업의 형태에 대해 본격적으로 고민한 시기."
        },
        {
          "year": "2024.01 — 2024.11",
          "title": "프루퍼 CTO — 첫 창업",
          "desc": "개발자 생산성을 측정 가능한 형태로 다루는 일. 'Measurable Developer'와 '프루퍼 인사이트'를 만들었습니다."
        },
        {
          "year": "2025.04 — 현재",
          "title": "프루퍼 대표(CEO) 전환",
          "desc": "프루퍼 ㈜를 운영하며, 회사의 방향을 DX → AX 전환을 돕는 쪽으로 다시 그렸습니다. 지금도 운영 중입니다."
        },
        {
          "year": "2025.06 — 현재",
          "title": "PPB Studios 팀장 겸직",
          "desc": "프루퍼 운영과 병행하여, 물류 — 가맹 — MD — 브랜드를 잇는 옴니채널 플랫폼 리드를 맡고 있습니다. AI Native 팀 문화를 함께 구축 중."
        }
      ],
      "notes": [
        {
          "no": "NOTE · 01",
          "name": "메이커와 엔지니어 사이",
          "en": "Maker × Engineer",
          "blurb": "“메이커와 엔지니어 — 개발자가 됐습니다. 그 다음은요?“라는 글을 썼습니다. 코드 그 자체보다, 코드로 만들어진 것이 누군가의 하루를 어떻게 바꾸는지가 더 흥미로워요."
        },
        {
          "no": "NOTE · 02",
          "name": "선린 → 토스 → 창업",
          "en": "A non-linear path",
          "blurb": "실업계 고등학교에서 시작해 외주개발사 → 사용자 제품 회사 → 사내 제품팀 → 자문 → VC 프로그램 → 창업으로 이어진 길은 처음부터 계획된 게 아니었습니다. 매 시점 가장 흥미로운 다음 한 걸음을 골랐을 뿐입니다."
        },
        {
          "no": "NOTE · 03",
          "name": "기술과 운영의 접점",
          "en": "Where tech meets ops",
          "blurb": "관심사는 점점 “코드로 무엇을 짓는가“에서 “코드와 운영이 만나는 지점에서 무엇이 작동하는가“로 옮겨가고 있습니다. 옴니채널, 개발자 생산성, AX — 모두 그 접점의 다른 이름입니다."
        }
      ],
      "coffee": {
        "title": "시간 괜찮으시면 30분만 같이 이야기해요.",
        "sub": "여기까지 읽어주셨다면, 그것만으로도 감사합니다. 더 궁금한 얘기가 있다면 직접 만나서 나누고 싶어요."
      }
    },
    "ask": {
      "dockTitle": "ASK HANSOL",
      "dockSub": "한솔에게 직접 물어보세요",
      "dockEmptyLine": "— Hansol",
      "dockEmptyIntro": "안녕하세요. 이력서에 적기 어려운 것들도 물어보셔도 좋아요. 프로필 데이터를 바탕으로 답합니다.",
      "dockInputPlaceholder": "질문을 입력하세요",
      "askHeaderLeft": "§ 02 · ASK",
      "askHeaderRight": "위 항목 외의 질문은 — 직접 물어보세요",
      "askInputPlaceholder": "한솔에게 직접 물어보세요",
      "askSendLabel": "Send",
      "askMetaLabel": "— Hansol responds"
    }
  },
  "career": [
    {
      "org": "프루퍼 ㈜",
      "orgEn": "Proofer Inc.",
      "role": "대표 (CEO)",
      "period": "2025.04 — 현재",
      "tags": [
        "창업",
        "AX",
        "B2B"
      ],
      "points": [
        "전통산업의 DX → AX 를 통한 기업가치 향상",
        "업무 효율화 & 자동화",
        "웹/모바일 애플리케이션 소프트웨어 외주"
      ],
      "tier": 1
    },
    {
      "org": "PPB Studios Co.",
      "orgEn": "PPB Studios",
      "role": "팀장",
      "period": "2025.06 — 현재",
      "tags": [
        "옴니채널",
        "DT",
        "리테일"
      ],
      "points": [
        "물류 — 가맹 — MD — 브랜드를 잇는 옴니채널 생태계 구축",
        "Operations: 물류 프로세스와 가맹점 오프라인 경험을 디지털로 전환",
        "Service: 온-오프라인을 아우르는 옴니 플랫폼으로 확장성 확보",
        "Integration: MD/브랜드 등 부서별 목표를 하나의 플랫폼으로 조율",
        "AI Native 팀 문화 구축 · Claude Code + Linear 기반 바이브 코딩 프로토콜 설계/도입"
      ],
      "tier": 1
    },
    {
      "org": "프루퍼 ㈜",
      "orgEn": "Proofer Inc.",
      "role": "CTO",
      "period": "2024.01 — 2025.04",
      "tags": [
        "창업",
        "개발자 생산성"
      ],
      "points": [
        "스타트업 창업 — 개발자 생산성 영역",
        "뉴스레터 \"Measurable Developer\" 발행",
        "개발자 성과관리 대시보드 \"프루퍼 인사이트\"",
        "지속적 개발자 평가 솔루션 \"프루퍼 데브엠\""
      ],
      "tier": 1
    },
    {
      "org": "(주) 라이트형제",
      "orgEn": "Light Brothers",
      "role": "Non Executive Director",
      "period": "2023.02 — 2025.04",
      "tags": [
        "자문",
        "초기기업"
      ],
      "points": [
        "예비창업기업·초기기업 대상 서비스 기획 및 개발 기술 자문",
        "비즈니스 모델 설계, 제품 전략, 확장 가능한 기술 아키텍처 구축 지원"
      ],
      "tier": 2
    },
    {
      "org": "Antler",
      "orgEn": "Antler",
      "role": "Entrepreneur in Residence",
      "period": "2023.10 — 2023.12",
      "tags": [
        "VC",
        "EIR"
      ],
      "points": [
        "글로벌 초기단계 VC 프로그램 참여"
      ],
      "tier": 2
    },
    {
      "org": "토스 (Viva Republica)",
      "orgEn": "Viva Republica",
      "role": "Internal Product Developer",
      "period": "2018.11 — 2023.08 (4년 10개월)",
      "tags": [
        "인터널 제품",
        "토스"
      ],
      "points": [
        "사내 웹/앱 포털 \"토스인터널\" 개발",
        "근태관리 애플리케이션 \"티티(time-tracker)\"",
        "수습평가시스템 \"3 month review\"",
        "사내 매거진 \"비바뉴스\", 슬랙봇, 다수 인터널 제품",
        "데이터 기반으로 문제단계부터 디벨롭 → 설계 → 개발 → 배포"
      ],
      "tier": 1
    },
    {
      "org": "리디북스 (Ridibooks)",
      "orgEn": "Ridibooks",
      "role": "Software Engineer",
      "period": "2016.11 — 2018.11",
      "tags": [
        "CMS",
        "B2B 도구"
      ],
      "points": [
        "리디북스 CMS 유지관리 및 기능개발",
        "CP(Contents Provider) 사이트 — 작가/매니저 업무 플랫폼",
        "도서메타정보관리시스템 운영 및 기능개발"
      ],
      "tier": 2
    },
    {
      "org": "씨엔티테크 (CNT Tech)",
      "orgEn": "CNT Tech",
      "role": "Software Engineer",
      "period": "2014.08 — 2016.11",
      "tags": [
        "풀스택",
        "외주개발"
      ],
      "points": [
        "여러 프랜차이즈 홈페이지 / 주문시스템 / 모바일 앱 개발",
        "Java/Spring · ASP.NET · PHP · JSP — 다양한 스택 경험"
      ],
      "tier": 3
    }
  ],
  "education": [
    {
      "school": "건국대학교",
      "degree": "경영공학사 — Advanced Industry Fusion",
      "period": "2018 — 2022"
    },
    {
      "school": "선린인터넷고등학교",
      "degree": "정보통신과",
      "period": "2012 — 2014"
    }
  ],
  "certifications": [
    "웹디자인기능사",
    "정보처리기능사"
  ],
  "languages": [
    {
      "name": "한국어",
      "level": "Native or Bilingual"
    },
    {
      "name": "English",
      "level": "Limited Working"
    }
  ],
  "publications": [
    {
      "title": "메이커와 엔지니어 — 개발자가 됐습니다. 그 다음은요?",
      "desc": "엔지니어 그 이후의 커리어에 대한 글"
    }
  ],
  "faq": [
    {
      "q": "지금은 무슨 일을 하고 있나요?",
      "a": "프루퍼 ㈜ 대표로 전통산업의 DX → AX 전환을 돕고, 동시에 PPB Studios에서 물류·가맹·브랜드를 잇는 옴니채널 플랫폼 팀을 이끌고 있습니다."
    },
    {
      "q": "어떤 사람과 어떤 회사에 잘 맞나요?",
      "a": "기술과 운영 사이에 다리가 필요한 곳, 부서가 분절돼 있어 \"하나의 시스템\"으로 묶는 일이 필요한 곳에 잘 맞습니다. 토스에서는 인터널 제품을, PPB에서는 옴니채널을, 프루퍼에서는 개발자 생산성을 — 모두 \"흩어진 것을 잇는 일\"이었습니다."
    },
    {
      "q": "AI를 어떻게 쓰고 있나요?",
      "a": "Claude Code + Linear 기반의 바이브 코딩 프로토콜을 설계해 PPB 팀에 도입했고, 도메인별 반복 업무의 AI 전환을 코칭합니다. AI는 도구가 아니라 팀 문화로 가져가야 효과가 납니다."
    },
    {
      "q": "코드를 직접 짜나요?",
      "a": "10년 차 엔지니어 출신이고 지금도 짭니다. 다만 \"코드를 쓰는 사람\"보다 \"무엇을 만들지 결정하는 사람\"으로서의 비중이 더 큽니다."
    },
    {
      "q": "커피챗 가능한가요?",
      "a": "네, calendly.com/contact-hsol/coffee-chat 에서 시간을 잡아주세요. 채용/창업/협업/그냥 궁금함 — 어떤 주제든 환영합니다."
    },
    {
      "q": "연락처는?",
      "a": "molmoty@gmail.com 또는 LinkedIn(/in/hsolim) 메시지. 빠른 응답을 원하시면 커피챗 링크가 가장 좋습니다."
    },
    {
      "q": "강점은 무엇인가요?",
      "a": "전략적 사고 · 고객 중심 사고 · 디자인적 사고 — 세 가지를 본인이 직접 꼽고 있습니다. 엔지니어로 출발해 인터널 제품, 창업, 옴니채널까지 \"문제의 형태를 다시 그리는 일\"을 반복해왔습니다."
    }
  ]
} as const);

export type SiteData = typeof HSOL_DATA;
