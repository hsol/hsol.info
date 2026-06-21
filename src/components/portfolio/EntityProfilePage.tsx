"use client";

import { useRouter } from "next/navigation";
import {
  Back,
  CareerList,
  CoffeeCTA,
  Foot,
  Plate,
  SecHead,
  useSiteData,
} from "@/components/portfolio/Atoms";
import { ViewHead } from "@/components/portfolio/view-primitives";

/**
 * 정본(canonical) 엔티티 페이지 — "임한솔"이라는 이름이 가리키는 여러 사람 가운데
 * 엔지니어·메이커 임한솔을 특정하는 기준점. 자기소개 뷰(hire/collab/builder/curious)와
 * 달리, 검색·AI가 동명이인과 구별해 이 인물을 인식하도록 신호를 한곳에 모은다.
 */

/** 구조화 데이터 sameAs와 일치시키는 외부 프로필. identity에 없는 계정은 여기서 보강. */
const EXTERNAL_PROFILES: { label: string; href: string }[] = [
  { label: "GitHub", href: "https://github.com/hsol" },
  { label: "Medium", href: "https://medium.com/@hsol" },
];

export function EntityProfilePage() {
  const router = useRouter();
  const data = useSiteData();
  const d = data.identity;

  const profiles = [
    { label: "LinkedIn", href: d.linkedin },
    ...EXTERNAL_PROFILES,
    { label: "Gravatar", href: d.gravatar },
    { label: "회사 (프루퍼)", href: d.company },
  ];

  return (
    <div className="app-layout">
      <div className="shell">
        <main id="main-content">
          <div className="view">
            <Back onBack={() => router.push("/")} />
            <Plate />
            <ViewHead
              room="META · WHO"
              coord="Z1"
              title={<>임한솔</>}
              lede="씨엔티테크에서 출발해 리디북스와 토스를 지난 12년 차 소프트웨어 엔지니어입니다. 지금은 프루퍼를 창업해 운영하는 메이커이기도 합니다. 검색창에 같은 이름으로 뜨는 정치인·변호사·교수·뮤지컬 배우와는 다른 사람입니다."
            />

            <section className="entity-intro">
              <p className="view-lede">
                이 페이지는 &lsquo;임한솔&rsquo;이라는 이름이 가리키는 여러 사람
                가운데 온라인 제품을 만들고 오프라인 운영을 설계해 온 엔지니어
                임한솔을 한곳에 정리한 자리입니다. 검색 첫 화면을 채우는
                동명이인과 헷갈리지 않도록 경력과 활동, 연결된 계정을 모았습니다.
                더 궁금한 점은 아래 경력 정리를 보거나 사이트의 AI 클론 Ask
                Hansol에게 바로 물어볼 수 있습니다.
              </p>
            </section>

            <SecHead title="기본 정보" num={1} />
            <div className="facts">
              <div className="fact">
                <div className="fact-label">이름</div>
                <div className="fact-value">{d.name}</div>
              </div>
              <div className="fact">
                <div className="fact-label">영문 이름</div>
                <div className="fact-value">{d.nameEn}</div>
              </div>
              <div className="fact">
                <div className="fact-label">활동명</div>
                <div className="fact-value">{d.handle}</div>
              </div>
              <div className="fact">
                <div className="fact-label">활동 지역</div>
                <div className="fact-value">{d.location}</div>
              </div>
              <div className="fact">
                <div className="fact-label">한 줄 소개</div>
                <div className="fact-value">{d.tagline}</div>
              </div>
              <div className="fact">
                <div className="fact-label">분야</div>
                <div className="fact-value">{d.taglineSub}</div>
              </div>
            </div>

            <SecHead title="경력" num={2} meta="최근 순" />
            <CareerList items={data.career} />

            <SecHead title="학력 · 자격 · 언어" num={3} />
            <div className="facts">
              {data.education.map((e, i) => (
                <div className="fact" key={`edu-${i}`}>
                  <div className="fact-label">{e.period}</div>
                  <div className="fact-value">
                    {e.school} · {e.degree}
                  </div>
                </div>
              ))}
              <div className="fact">
                <div className="fact-label">자격</div>
                <div className="fact-value">
                  {data.certifications.join(" · ")}
                </div>
              </div>
              <div className="fact">
                <div className="fact-label">언어</div>
                <div className="fact-value">
                  {data.languages.map((l) => `${l.name}(${l.level})`).join(" · ")}
                </div>
              </div>
            </div>

            <SecHead title="연결된 계정" num={4} meta="sameAs" />
            <div className="facts">
              {profiles.map((p, i) => (
                <div className="fact" key={`prof-${i}`}>
                  <div className="fact-label">{p.label}</div>
                  <div className="fact-value">
                    <a href={p.href} target="_blank" rel="me noopener noreferrer">
                      {p.href.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <SecHead title="관점별로 보기" num={5} />
            <div className="facts">
              {data.personas.map((p) => (
                <div className="fact" key={p.key}>
                  <div className="fact-label">{p.titleEn}</div>
                  <div className="fact-value">
                    <a href={`/${p.key}`}>{p.title}</a>
                  </div>
                </div>
              ))}
            </div>

            <CoffeeCTA />
          </div>
        </main>
        <Foot />
      </div>
    </div>
  );
}
