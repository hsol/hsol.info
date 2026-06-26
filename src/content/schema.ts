import { z } from "zod";
import { layoutSchema } from "@/content/layout-types";
import { siteCompositionSchema } from "@/content/compose/schema";

const IdentitySchema = z.object({
  name: z.string().min(1),
  nameEn: z.string().min(1),
  handle: z.string().min(1),
  tagline: z.string().min(1),
  taglineSub: z.string().min(1),
  location: z.string().min(1),
  email: z.string().email(),
  linkedin: z.string().url(),
  portfolio: z.string().url(),
  company: z.string().url(),
  calendly: z.string().url(),
  gravatar: z.string().url(),
});

const PillarSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  labelKo: z.string().min(1),
  blurb: z.string().min(1),
});

const PersonaSchema = z.object({
  key: z.string().min(1),
  mark: z.string().min(1),
  title: z.string().min(1),
  titleEn: z.string().min(1),
  hint: z.string().min(1),
});

/** 페르소나 키 → 타임라인 큐레이션 tier(1이면 기본 펼침, 2 이상이면 접힌 채로 시작). */
const CareerPersonaTierSchema = z.record(z.string(), z.number().int().positive());

const CareerItemSchema = z.object({
  org: z.string().min(1),
  orgEn: z.string().min(1),
  role: z.string().min(1),
  period: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  points: z.array(z.string().min(1)).min(3).max(5),
  tier: CareerPersonaTierSchema,
});

const EducationSchema = z.object({
  school: z.string().min(1),
  degree: z.string().min(1),
  period: z.string().min(1),
});

const LanguageSchema = z.object({
  name: z.string().min(1),
  level: z.string().min(1),
});

const PublicationSchema = z.object({
  title: z.string().min(1),
  desc: z.string().min(1),
  /** 있으면 Writing 카드가 새 탭 링크로 렌더된다. */
  href: z.string().url().optional(),
});

const FaqItemSchema = z.object({
  q: z.string().min(1),
  a: z.string().min(1),
});

const ViewHeaderCopySchema = z.object({
  titleLines: z.array(z.string().min(1)).min(1),
  lede: z.string().min(1),
});

const CoffeeCopySchema = z.object({
  title: z.string().min(1),
  sub: z.string().min(1),
});

const MethodItemSchema = z.object({
  no: z.string().min(1),
  name: z.string().min(1),
  en: z.string().min(1),
  blurb: z.string().min(1),
  /** 있으면 카드가 새 탭 링크로 렌더된다(Writing 등). */
  href: z.string().url().optional(),
});

const FactItemSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

const TimelineItemSchema = z.object({
  year: z.string().min(1),
  title: z.string().min(1),
  desc: z.string().min(1),
});

const HomeBuiltCardSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

const HomeBuiltFlowStepSchema = z.object({
  label: z.string().min(1),
});

const HomeBuiltPerspectiveSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
});

/**
 * 빌드/리프레시 메타(가벼움). footer 에 버전을 띄워 "이번에 실제로 돌았는지"를 알게 한다.
 * 상세 개선 로그(개선 의도 내역)는 site-data 가 아니라 DB(build_log 테이블)에 누적한다.
 */
const BuildInfoSchema = z.object({
  version: z.string().min(1),
  refreshedAt: z.string().min(1),
});

export const siteDataSchema = z
  .object({
  identity: IdentitySchema,
  pillars: z.array(PillarSchema).min(1),
  personas: z.array(PersonaSchema).min(1),
  viewHeaders: z.object({
    hire: ViewHeaderCopySchema,
    collab: ViewHeaderCopySchema,
    builder: ViewHeaderCopySchema,
    curious: ViewHeaderCopySchema,
  }),
  portfolioCopy: z.object({
    home: z.object({
      heroEyebrow: z.string().min(1),
      heroTitleLines: z.array(z.string().min(1)).min(1),
      heroSubLead: z.string().min(1),
      heroSubEmphasis: z.string().min(1),
      heroSubTail: z.string().min(1),
      doorsTitle: z.string().min(1),
      doorsMeta: z.string().min(1),
      builtTitle: z.string().min(1),
      builtMeta: z.string().min(1),
      builtBody: z.string().min(1),
      builtCards: z.array(HomeBuiltCardSchema).min(2),
      builtMermaid: z.string().min(1),
      builtFlow: z.array(HomeBuiltFlowStepSchema).min(3),
      builtPerspectiveTitle: z.string().min(1),
      builtPerspectiveMeta: z.string().min(1),
      builtPerspectives: z.array(HomeBuiltPerspectiveSchema).min(4),
      coffeeEyebrow: z.string().min(1),
      coffeeTitle: z.string().min(1),
      coffeeBody: z.string().min(1),
      coffeeButtonLabel: z.string().min(1),
      heroMetaSinceLabel: z.string().min(1),
      heroMetaSinceValue: z.string().min(1),
      heroMetaNowLabel: z.string().min(1),
      heroMetaNowValue: z.string().min(1),
      heroMetaBaseLabel: z.string().min(1),
      heroMetaBaseValue: z.string().min(1),
    }),
    hire: z.object({
      factsYearsLabel: z.string().min(1),
      factsYearsValue: z.string().min(1),
      factsBaseLabel: z.string().min(1),
      factsEducationLabel: z.string().min(1),
      factsLanguagesLabel: z.string().min(1),
      /** 풀 경력 타임라인 직전, 채용 관점 자기소개 줄글 */
      timelineIntro: z.string().min(1),
      coffee: CoffeeCopySchema,
    }),
    collab: z.object({
      methods: z.array(MethodItemSchema).min(1),
      /** 풀 경력 타임라인 직전, 협업·자문 관점 자기소개 줄글 */
      timelineIntro: z.string().min(1),
      coffee: CoffeeCopySchema,
    }),
    builder: z.object({
      facts: z.array(FactItemSchema).min(1),
      certificationLabel: z.string().min(1),
      /** Writing 섹션 맨 앞 카드(블로그). 나머지 글과 동일하게 데이터로 관리한다. */
      blog: MethodItemSchema,
      extraWritings: z.array(MethodItemSchema).min(1),
      /** 풀 경력 타임라인 직전, 빌더 관점 자기소개 줄글 */
      timelineIntro: z.string().min(1),
      coffee: CoffeeCopySchema,
    }),
    curious: z.object({
      /** 간트 타임라인 직전, 인간적 궤적 소개 줄글 */
      timelineIntro: z.string().min(1),
      timeline: z.array(TimelineItemSchema).min(1),
      notes: z.array(MethodItemSchema).min(1),
      coffee: CoffeeCopySchema,
    }),
    ask: z.object({
      dockTitle: z.string().min(1),
      dockSub: z.string().min(1),
      dockEmptyLine: z.string().min(1),
      dockEmptyIntro: z.string().min(1),
      dockInputPlaceholder: z.string().min(1),
      askHeaderLeft: z.string().min(1),
      askHeaderRight: z.string().min(1),
      askInputPlaceholder: z.string().min(1),
      askSendLabel: z.string().min(1),
      askMetaLabel: z.string().min(1),
    }),
  }),
  career: z.array(CareerItemSchema).min(1),
  education: z.array(EducationSchema).min(1),
  certifications: z.array(z.string().min(1)).min(1),
  languages: z.array(LanguageSchema).min(1),
  publications: z.array(PublicationSchema).min(1),
  faq: z.array(FaqItemSchema).min(1),
  /**
   * 페이지별 블록 조합(레이아웃). 선택 필드 — 없거나 일부만 있으면
   * 코드의 DEFAULT_LAYOUT 으로 폴백한다. 빌더/사람이 여기서 레이아웃을 바꾼다.
   */
  layout: layoutSchema.optional(),
  /**
   * 생성형 컴포넌트-트리(디자인시스템) 레이아웃. 선택 필드 — 페이지에 composition 이 있으면
   * 그걸로 렌더하고, 없으면 layout(blocks) → DEFAULT_LAYOUT 으로 폴백한다(점진 도입).
   */
  composition: siteCompositionSchema.optional(),
  /** 빌드 버전 메타(footer 표시용). 상세 개선 로그는 DB. */
  build: BuildInfoSchema.optional(),
})
  .superRefine((data, ctx) => {
    const personaKeys = data.personas.map((p) => p.key);
    const keySet = new Set(personaKeys);
    data.career.forEach((item, i) => {
      for (const pk of personaKeys) {
        if (typeof item.tier[pk] !== "number") {
          ctx.addIssue({
            code: "custom",
            message: `career[${i}].tier에 personas.key "${pk}" 가 필요합니다.`,
            path: ["career", i, "tier", pk],
          });
        }
      }
      for (const k of Object.keys(item.tier)) {
        if (!keySet.has(k)) {
          ctx.addIssue({
            code: "custom",
            message: `career[${i}].tier에 알 수 없는 페르소나 키 "${k}"가 있습니다.`,
            path: ["career", i, "tier", k],
          });
        }
      }
    });
  });

export type SiteData = z.infer<typeof siteDataSchema>;
