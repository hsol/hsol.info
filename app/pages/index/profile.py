import pynecone

from app import components


def profile_card(profile_image_path: str, items: list[tuple]):
    return components.fullfill_card(
        "프로필",
        pynecone.box(
            pynecone.box(
                flex_basis="20em",
                width="20em",
                height="20em",
                background_image=f"url({profile_image_path})",
                background_size="cover",
                margin_right=[0, 0, "32px"],
                margin_bottom=["32px", "32px", 0],
            ),
            pynecone.vstack(
                *(
                    pynecone.hstack(
                        pynecone.text(f"{item[0]}.", as_="b"),
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
