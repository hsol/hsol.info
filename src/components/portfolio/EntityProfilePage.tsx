"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeferredChatDock } from "@/components/DeferredChatDock";
import {
  Back,
  CoffeeCTA,
  Foot,
  Plate,
  SecHead,
  useSiteData,
} from "@/components/portfolio/Atoms";
import { ViewHead } from "@/components/portfolio/view-primitives";

/**
 * /about — "임한솔이라는 사람" 자체를 줄글로 기록하는 페이지.
 * hire/collab/builder/curious 4개 뷰가 경력을 청중별로 재배치한 자기소개라면,
 * 여기는 이력서에 안 적는 성격·일하는 방식·겪은 일을 1인칭 줄글로 담백하게 적는다.
 * 본문은 한솔님 본인의 에세이·블로그·vault 자기 객체에서 합성했고, 발행 범위는 본인이 정했다.
 * 톤 원칙: 자신을 멋있게 포장하는 선언조·풀쿼트·비장한 마무리를 쓰지 않고,
 * '만들다·메이커·직관' 같은 특정 어휘 반복을 피한다.
 */

const BODY: string[] = [
  "컴퓨터와 친해진 건 초등학생 때부터입니다. 거실에 있던 아버지의 LG 데스크톱이 제 첫 장난감이었고 저는 게임을 하기보다 그게 어떻게 짜였는지 뜯어보는 쪽을 더 좋아했습니다. 스타크래프트 유즈맵을 만들고 친구들이 쓸 카페 채팅 프로그램을 짜고 동생을 위한 학습지 프로그램까지 만들며 자랐습니다. 영재원을 거치며 개발을 본격적으로 익혔고 그 관심이 그대로 진로가 되어서 특성화고인 선린인터넷고 정보통신과에 진학했습니다. 학교에서는 전문 동아리 네퓨즈(NEFUS) 10기로 활동했고 C#으로 단어 학습 프로그램을, 자바로 용돈 저축 게임을, 페이스북을 흉내 낸 블로그 스킨 'Fakebook'을 만들어 블로그에 거의 매일 올렸습니다. 그렇게 일찍 시작한 덕분에 열아홉부터 개발자로 취업해 일했습니다. 일하는 동안 대학생·사회인 연합동아리 넥스터즈에서 활동했고 선취업 후진학으로 건국대학교 경영공학과를 졸업했습니다.",
  "토스에서 5년을 일하고 나와 창업을 시작했습니다. 당당하던 직장인에서 다시 아쉬운 소리를 해야 하는 초심자로 돌아갔지만 이상하게도 그때가 더 재밌었습니다. 외주를 적당히 맡겼다가 중간에 일이 틀어지는 바람에 3주를 밤새워 혼자 마무리한 적도 있습니다. 코드를 남에게 맡길 때는 작정하고 챙겨야 한다는 것을 그 일로 배웠습니다. 사업 방향도 여러 번 틀었고 함께 시작한 동업자와도 결국 갈라섰습니다. 고객이 진짜로 원하지 않는 제품을 억지로 영업해 보기도 했는데 필요하지 않은 건 결국 팔리지 않더군요. 저보다 더 잘할 팀을 만났을 때는 제 아이템을 미련 없이 접었습니다. 저에게는 아이템에 대한 집착보다 문제를 푸는 일이 늘 먼저였습니다. 그러면서도 매번 다시 깨닫는 사실이 하나 있습니다. 제품보다 고객이 먼저이고 고객보다 문제가 먼저라는 것입니다.",
  "요즘은 코파운더와 함께 인수창업, 이른바 서치펀드 방식의 사업을 합니다. 회사를 지분 스왑으로 인수해 함께 경영하며 키운 뒤에 매각하는 구조입니다. 지금은 그렇게 맡은 피피비스튜디오스에서 플랫폼팀장으로 일하고 있습니다. 온·오프라인을 잇는 O2O 플랫폼을 책임지면서 개발팀이 일하는 방식을 바꾸고 AI를 실제 업무에 들이고 있습니다. 따로 프루퍼라는 회사의 대표로는 with CTO라는 커뮤니티를 운영합니다. 원래는 데이터 기반 성과평가 SaaS를 팔기 위해 만든 자리였습니다. 사업 아이템을 바꾸면서 영업이라는 목적은 사라졌지만 행사 자체에 그만한 존재 이유가 있다고 느껴서 지금은 제 비용과 시간을 들여 계속 이어 가고 있습니다.",
  "저는 판단이 빠른 대신 그 판단을 꼭 손에 잡히는 형태로 남겨 확인합니다. 회의 때 쓰는 템플릿을 직접 만들어 두고 로드맵을 색으로 칠해 팀과 진척을 맞추고 십 년 넘게 블로그에 쓴 글을 천 편 넘게 모아 둔 것도 그래서입니다. 이 사이트도 같은 습관의 연장입니다. 흩어져 있던 제 기록을 한곳에 모아 두고 제가 없는 자리에서도 AI 클론이 저 대신 사람들의 질문에 답하도록 만들었습니다.",
  "틈틈이 글도 씁니다. 올해 초에는 《메이커와 엔지니어》라는 전자책을 냈습니다. '개발자가 됐는데 그다음에는 무엇이 되어야 하는가'라는 질문을 12년 동안 곱씹은 끝에 제 나름의 답을 정리한 책입니다. 누가 시켜서가 아니라 제 생각을 한 번 매듭짓고 싶어서 쓴 글이라 저에게는 이력서 한 줄보다 의미가 큽니다. 아침마다 같은 순서로 하루를 열고 그날 한 일과 떠오른 생각을 적어 두는 습관도 같은 맥락입니다. 그날의 저만이 그날의 저를 정확히 기록할 수 있다고 믿기 때문입니다.",
  "제가 일할 때 끝까지 붙잡는 것은 말과 행동을 맞추는 일입니다. 그래서 누가 시켜서 하기보다 제가 정한 일을 끝까지 책임지려 합니다. 또 혼자 잘 해내는 것보다 곁에 있는 사람이 함께 잘되는 쪽에서 더 큰 보람을 느낍니다. 후배의 일을 돕거나 커뮤니티에 보탬이 될 때가 특히 그렇습니다. 이런 게 쌓여서 먼 훗날 누군가 저를 두고 무엇이든 믿고 맡길 수 있는 사람이었다고 말해 준다면 그걸로 충분할 것 같습니다.",
];

/** 구조화 데이터 sameAs와 일치시키는 외부 프로필(좌측). */
const EXTERNAL_PROFILES = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/hsolim/" },
  { label: "GitHub", href: "https://github.com/hsol" },
  { label: "Medium", href: "https://medium.com/@hsol" },
  { label: "Gravatar", href: "https://gravatar.com/hsolim" },
];

export function EntityProfilePage() {
  const router = useRouter();
  const data = useSiteData();

  return (
    <div className="app-layout">
      <div className="shell">
        <main id="main-content">
          <div className="view about-view">
            <Back onBack={() => router.push("/")} />
            <Plate />
            <ViewHead
              room="META · WHO"
              coord="Z1"
              title={
                <>
                  임한솔
                  <span className="name-meta">30세 · 12년차</span>
                </>
              }
              lede="이력서에는 안 적는 이야기를 모은 페이지입니다. 제가 어떻게 자랐고 어떻게 일하며 무엇을 거쳐 왔는지 적었습니다."
            >
              <Image
                src="/hansol.avif"
                alt="임한솔 사진"
                width={189}
                height={172}
                className="about-portrait"
              />
            </ViewHead>

            <section className="entity-prose">
              {BODY.map((p, i) => (
                <p className="entity-p" key={i}>
                  {p}
                </p>
              ))}
            </section>

            <SecHead title="더 알아보기" />
            <div className="about-links">
              {/* 좌측: 외부 프로필 / 우측: 관점별 4개 뷰 */}
              <div className="about-links-col">
                <div className="about-links-head">프로필</div>
                {EXTERNAL_PROFILES.map((p) => (
                  <a
                    className="about-link"
                    key={p.label}
                    href={p.href}
                    target="_blank"
                    rel="me noopener noreferrer"
                  >
                    <span className="about-link-label">{p.label}</span>
                    <span className="about-link-val">
                      {p.href.replace(/^https?:\/\//, "")}
                    </span>
                  </a>
                ))}
              </div>
              <div className="about-links-col">
                <div className="about-links-head">관점별 보기</div>
                {data.personas.map((p) => (
                  <Link className="about-link" key={p.key} href={`/${p.key}`}>
                    <span className="about-link-label">{p.titleEn}</span>
                    <span className="about-link-val">{p.title}</span>
                  </Link>
                ))}
              </div>
            </div>

            <CoffeeCTA />
          </div>
        </main>
        <Foot />
      </div>
      {/* 홈과 동일한 FAB 방식의 Ask Hansol. /about 본문이 "AI 클론이 답한다"고 말하므로 여기서 직접 쓸 수 있게 둔다. */}
      <DeferredChatDock
        inline={false}
        defaultOpen={false}
        pageContext={{ view: "home", section: "about", detail: "about/profile" }}
      />
    </div>
  );
}
