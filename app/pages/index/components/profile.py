import reflex

from app import components
from app.models.profile import Profile


def _card(profile_image_path: str, items: list[tuple]):
    return components.fullfill_card(
        "프로필",
        reflex.box(
            reflex.box(
                flex_basis="20em",
                width="20em",
                height="20em",
                background_image=f"url({profile_image_path})",
                background_size="cover",
                margin_right=[0, 0, "32px"],
                margin_bottom=["32px", "32px", 0],
                border_radius="4px",
            ),
            reflex.vstack(
                *(
                    reflex.hstack(
                        reflex.text(f"{item[0]}.", as_="b"),
                        item[1],
                        font_size=["1em", "1em", "1.2em"],
                    )
                    if isinstance(item, tuple)
                    else item
                    for item in items
                ),
                align_items="baseline",
            ),
            display="flex",
            align_items=["center", "center", "start"],
            justify_content="center",
            flex_flow=["column", "column", "row"],
            width="100%",
        ),
    )


def ProfileCard(profile: Profile) -> reflex.Component:
    return _card(
        profile_image_path="/profile/body_profile.jpg",
        items=[
            ("이름", reflex.text(profile.name)),
            ("생일", reflex.text(profile.birthday)),
            (
                "이메일",
                reflex.link(
                    reflex.text(profile.email),
                    href="mailto:" + profile.email,
                ),
            ),
            reflex.box(reflex.divider(), padding="16px 0", width="100%"),
            (
                "Github",
                reflex.link(
                    reflex.text(profile.github),
                    href=profile.github,
                    is_external=True,
                ),
            ),
            (
                "링크드인",
                reflex.link(
                    reflex.text(profile.linkedin),
                    href=profile.linkedin,
                    is_external=True,
                ),
            ),
            (
                "블로그",
                reflex.link(
                    reflex.text(profile.blog),
                    href=profile.blog,
                    is_external=True,
                ),
            ),
        ],
    )
