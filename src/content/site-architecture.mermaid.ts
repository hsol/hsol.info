/**
 * `/architecture` 페이지 전용 Mermaid.
 * 아래 템플릿 리터럴 안의 다이어그램만 수정하면 됩니다(줄바꿈·들여쓰기 유지 가능).
 *
 * 노드·서브그래프 색은 사이트 청사진 팔레트와 `MermaidDiagram` themeVariables에 맞춤:
 * bp-deep #0e2a3d, bp-floor #14384f, bp-wall #1d4866, line #2e6889·#3d7a9c,
 * soft #5e93b1, bright #287099, glow #7fb4d0, ink #f2f7fa / ink-2 #d6e3ec / ink-mute #8fb1c4, accent #f4c977.
 */
export const SITE_ARCHITECTURE_MERMAID = `
flowchart TB

  subgraph ONTOLOGY["온톨로지 vault Personal Knowledge Base"]

    subgraph MEGA_EDITORS["EDITORS vault 편집 주체"]
      direction LR
      EDIT_HUMAN[사람 수동 편집<br/>Obsidian 등]
      EDIT_CLAUDE[Claude 세션 편집<br/>Cowork 등]
    end

    subgraph MEGA_VAULT["VAULT Personal Knowledge Base 및 빌드 파이프라인"]

      subgraph L0["L0. 원천 활동"]
        direction LR
        TI[블로그 1008편]
        ME[Medium 49편]
        LI[LinkedIn 댓글 174건+]
        BK[단행본 1권]
        HW[직접 작성 결정 페르소나 정의]
      end

      subgraph L1["L1. 메타-온톨로지 Foundry-style"]
        direction LR
        OT[Object Type]
        LT[Link Type]
        AT[Action Type]
        IFC[Interface]
        SP[Shared Property]
        VT[Value Type]
      end

      subgraph L2["L2. 원천 코퍼스 보존"]
        direction LR
        DS_BLOG[블로그 코퍼스]
        DS_MED[Medium 코퍼스]
        DS_LI[LinkedIn 코퍼스]
        DS_BK[단행본 코퍼스]
      end

      subgraph L3["L3. 객체 인스턴스 그룹 단위"]
        direction LR
        PEO[인물 임한솔]
        ORG[organizations 14곳]
        PRJ[projects 13개]
        ART[artifacts 11종]
        CON[concepts persona writing-style]
        PLA[places]
        EVT[events]
        ALOG[액션 로그]
      end

      subgraph L4A["L4-A. ObjectView 코드 컨텍스트 참조"]
        direction LR
        OV_README[vault README]
        OV_PERSONA[페르소나 운영 매뉴얼]
        OV_WRIT[작문 가이드]
        OV_PORT[포트폴리오 요약]
        OV_TIME[타임라인]
        OV_BACK[프로젝트 소개 백데이터]
      end

      subgraph L4B["L4-B. ObjectView vault 내부 인덱스"]
        direction LR
        OV_NET[관계망]
        OV_BLOG_ARCH[블로그 아카이브]
        OV_MED_ARCH[Medium 아카이브]
      end

      subgraph HUB["L4-C. 정규화 SiteData ObjectView 홈페이지 단일 SSOT"]
        direction TB
        SD_META[identity pillars personas viewHeaders]
        SD_HOME[portfolioCopy.home]
        SD_HIRE_COPY[portfolioCopy.hire]
        SD_COLLAB_COPY[portfolioCopy.collab]
        SD_BUILDER_COPY[portfolioCopy.builder]
        SD_CURIOUS_COPY[portfolioCopy.curious]
        SD_ASK_UI[portfolioCopy.ask]
        SD_RESUME[career education certifications languages publications]
        SD_FAQ[faq 7개]
      end

      subgraph L5["L5. 저장 및 Blob 동기화"]
        direction LR
        BLOB_REPO[vault submodule git<br/>hsol-info-blob origin]
        VBLOB[(원격 Blob 저장소)]
        WF_BLOB_SYNC[hsol-info-blob 자체 CI<br/>Blob 업로드 전담]
      end

      subgraph L6["L6. CI 빌드 - hsol/hsol.info"]
        direction LR
        GH[(메인 repo git 호스팅)]
        WF_REF[빌드 갱신 워크플로]
        WF_SUB[submodule 검증]
        SCRIPT_REF[콘텐츠 갱신 스크립트 LLM ETL]
        SCRIPT_GEN[폴백 스냅샷 생성]
        ZOD[스키마 검증 zod]
        FAIL[실패 덤프]
        SITE_TS[빌드 타임 폴백 스냅샷]
      end
    end
  end

  subgraph MEGA_INFRA["외부 서비스 공유 인프라"]
    direction LR
    ANTHROPIC[(LLM API)]
    VERCEL[(SSR 호스팅)]
    NEON[(Postgres)]
  end

  subgraph APPLICATION["애플리케이션 hsol.info 사이트 런타임"]

    subgraph MEGA_SERVER["SERVER Next.js 서버 런타임"]
      direction LR
      LAYOUT[레이아웃]
      PAGE[페이지 핸들러]
      LOADER[데이터 로더 3단 폴백]
      CACHE[5분 TTL 캐시]
      API_AH[ChatDock API 핸들러]
      FAQ_MATCH{FAQ 매칭}
      RETRIEVAL[키워드 retrieval]
      TOOL_LOOP[tool use 루프]
      LINKIFY[출력 정규화]
      DB_MSG[메시지 로그]
      DB_MEM[메모리 롤업]
    end

    subgraph MEGA_CLIENT["CLIENT 브라우저 런타임"]
      direction LR
      PORT_APP[메인 앱 컴포넌트]
      HOME_PAGE[홈 페이지]
      VH[hire 뷰 A1]
      VL[collab 뷰 B1]
      VB[builder 뷰 B2]
      VC[curious 뷰 A2]
      CHATDOCK[ChatDock UI]
      ATOMS[공유 컴포넌트]
      IO[화면 컨텍스트 추적]
      LS[(브라우저 세션 ID)]
      ASK_CL[ChatDock 클라이언트]
    end

    subgraph MEGA_USERS["USERS 4종 페르소나 방문자"]
      direction LR
      UH((채용 담당자))
      UL((잠재 협업자))
      UB((메이커 엔지니어))
      UC((일반 호기심))
    end
  end

  TI --> DS_BLOG
  ME --> DS_MED
  LI --> DS_LI
  BK --> DS_BK
  HW --> PEO
  HW --> ORG
  HW --> PRJ
  HW --> ART
  HW --> CON
  HW --> PLA
  HW --> EVT
  HW --> ALOG

  DS_BLOG -.코퍼스 분석.-> CON
  DS_MED -.코퍼스 분석.-> CON
  DS_LI -.코퍼스 분석.-> CON
  DS_BK -.코퍼스 분석.-> CON

  CON --> OV_PERSONA
  CON --> OV_WRIT
  PEO --> OV_PORT
  ORG --> OV_PORT
  PRJ --> OV_PORT
  ALOG --> OV_TIME
  PRJ --> OV_BACK
  PEO --> OV_NET
  ORG --> OV_NET
  DS_BLOG --> OV_BLOG_ARCH
  DS_MED --> OV_MED_ARCH

  EDIT_HUMAN -- commit·push --> BLOB_REPO
  EDIT_CLAUDE -- commit·push --> BLOB_REPO

  PEO --> BLOB_REPO
  CON --> BLOB_REPO
  ORG --> BLOB_REPO
  PRJ --> BLOB_REPO
  ART --> BLOB_REPO
  OV_PERSONA --> BLOB_REPO
  OV_WRIT --> BLOB_REPO
  OV_PORT --> BLOB_REPO
  OV_TIME --> BLOB_REPO
  OV_BACK --> BLOB_REPO
  OV_README --> BLOB_REPO
  OV_NET --> BLOB_REPO
  OV_BLOG_ARCH --> BLOB_REPO
  OV_MED_ARCH --> BLOB_REPO
  SD_META --> BLOB_REPO

  BLOB_REPO -- push event --> WF_BLOB_SYNC
  WF_BLOB_SYNC -- Blob 업로드 --> VBLOB

  GH --> WF_REF
  GH --> WF_SUB
  WF_REF --> SCRIPT_REF
  OV_README ==> SCRIPT_REF
  OV_WRIT ==> SCRIPT_REF
  OV_PORT ==> SCRIPT_REF
  OV_TIME ==> SCRIPT_REF
  OV_BACK ==> SCRIPT_REF
  PEO ==> SCRIPT_REF
  SCRIPT_REF --> ANTHROPIC
  ANTHROPIC --> SD_META
  WF_REF -- submodule commit·push<br/>Blob에는 직접 업로드 안 함 --> BLOB_REPO
  WF_REF --> FAIL
  WF_REF --> SCRIPT_GEN
  SD_META --> SCRIPT_GEN
  SCRIPT_GEN --> ZOD
  ZOD --> SITE_TS
  WF_REF --> VERCEL

  VERCEL --> LAYOUT
  LAYOUT --> PAGE
  PAGE --> LOADER
  LOADER --> VBLOB
  LOADER --> BLOB_REPO
  LOADER --> SITE_TS
  LOADER --> CACHE
  CACHE --> LOADER
  LOADER ==> SD_META
  PAGE --> PORT_APP

  SD_META ==> PORT_APP
  SD_HOME ==> HOME_PAGE
  SD_HIRE_COPY ==> VH
  SD_RESUME ==> VH
  SD_COLLAB_COPY ==> VL
  SD_BUILDER_COPY ==> VB
  SD_CURIOUS_COPY ==> VC
  SD_ASK_UI ==> CHATDOCK
  SD_FAQ ==> FAQ_MATCH

  PORT_APP --> HOME_PAGE
  PORT_APP --> VH
  PORT_APP --> VL
  PORT_APP --> VB
  PORT_APP --> VC
  PORT_APP --> CHATDOCK
  PORT_APP --> ATOMS

  CHATDOCK --> ASK_CL
  ASK_CL --> API_AH
  API_AH --> FAQ_MATCH
  FAQ_MATCH -- 매칭 --> LINKIFY
  FAQ_MATCH -- 미매칭 --> RETRIEVAL
  API_AH --> LOADER

  OV_README ==> API_AH
  OV_PERSONA ==> API_AH
  CON -.키워드.-> RETRIEVAL
  PEO -.키워드.-> RETRIEVAL

  RETRIEVAL --> TOOL_LOOP
  TOOL_LOOP --> ANTHROPIC
  TOOL_LOOP --> VBLOB
  TOOL_LOOP --> LINKIFY

  API_AH --> DB_MSG
  DB_MSG --> NEON
  API_AH --> DB_MEM
  DB_MEM --> NEON
  LINKIFY --> ASK_CL

  CHATDOCK --> IO
  IO --> CHATDOCK
  ASK_CL --> LS
  LS --> ASK_CL

  UH --> VH
  UL --> VL
  UB --> VB
  UC --> VC
  UH -.대화.-> CHATDOCK
  UL -.대화.-> CHATDOCK
  UB -.대화.-> CHATDOCK
  UC -.대화.-> CHATDOCK

  classDef mermaid-src fill:#1d4866,stroke:#5e93b1,color:#f2f7fa
  classDef mermaid-ont fill:#183f58,stroke:#3d7a9c,color:#d6e3ec
  classDef mermaid-obj fill:#14384f,stroke:#2e6889,color:#f2f7fa
  classDef mermaid-view fill:#123247,stroke:#287099,color:#f2f7fa
  classDef mermaid-hubInner fill:#0e2a3d,stroke:#f4c977,stroke-width:2px,color:#f2f7fa
  classDef mermaid-store fill:#183f58,stroke:#7fb4d0,color:#f2f7fa
  classDef mermaid-ci fill:#123247,stroke:#2e6889,color:#d6e3ec
  classDef mermaid-ext fill:#1d4866,stroke:#f4c977,color:#f2f7fa
  classDef mermaid-srv fill:#0e2a3d,stroke:#3d7a9c,color:#f2f7fa
  classDef mermaid-cli fill:#14384f,stroke:#3d7a9c,color:#f2f7fa
  classDef mermaid-usr fill:#183f58,stroke:#5e93b1,color:#8fb1c4
  classDef mermaid-editor fill:#1d4866,stroke:#f4c977,color:#f2f7fa

  class TI,ME,LI,BK,HW mermaid-src
  class OT,LT,AT,IFC,SP,VT mermaid-ont
  class PEO,ORG,PRJ,ART,CON,PLA,EVT,ALOG,DS_BLOG,DS_MED,DS_LI,DS_BK mermaid-obj
  class OV_PERSONA,OV_WRIT,OV_PORT,OV_TIME,OV_BACK,OV_NET,OV_BLOG_ARCH,OV_MED_ARCH,OV_README mermaid-view
  class SD_META,SD_HOME,SD_HIRE_COPY,SD_COLLAB_COPY,SD_BUILDER_COPY,SD_CURIOUS_COPY,SD_ASK_UI,SD_RESUME,SD_FAQ mermaid-hubInner
  class BLOB_REPO,VBLOB,WF_BLOB_SYNC mermaid-store
  class GH,WF_REF,WF_SUB,SCRIPT_REF,SCRIPT_GEN,ZOD,FAIL,SITE_TS mermaid-ci
  class ANTHROPIC,VERCEL,NEON mermaid-ext
  class LAYOUT,PAGE,LOADER,CACHE,API_AH,FAQ_MATCH,RETRIEVAL,TOOL_LOOP,DB_MSG,DB_MEM,LINKIFY mermaid-srv
  class PORT_APP,HOME_PAGE,VH,VL,VB,VC,CHATDOCK,ATOMS,IO,LS,ASK_CL mermaid-cli
  class UH,UL,UB,UC mermaid-usr
  class EDIT_HUMAN,EDIT_CLAUDE mermaid-editor

  style ONTOLOGY fill:#14384f,stroke:#287099,stroke-width:4px,color:#f2f7fa
  style APPLICATION fill:#0e2a3d,stroke:#3d7a9c,stroke-width:4px,color:#d6e3ec

  style MEGA_EDITORS fill:#183f58,stroke:#f4c977,stroke-width:2px,color:#f2f7fa
  style MEGA_VAULT fill:#14384f,stroke:#2e6889,stroke-width:2px,color:#f2f7fa
  style MEGA_INFRA fill:#123247,stroke:#5e93b1,stroke-width:2px,color:#d6e3ec
  style MEGA_SERVER fill:#0e2a3d,stroke:#3d7a9c,stroke-width:2px,color:#f2f7fa
  style MEGA_CLIENT fill:#183f58,stroke:#287099,stroke-width:2px,color:#f2f7fa
  style MEGA_USERS fill:#14384f,stroke:#5e93b1,stroke-width:2px,color:#8fb1c4
  style HUB fill:#123247,stroke:#f4c977,stroke-width:2px,color:#f2f7fa
`.trim();
