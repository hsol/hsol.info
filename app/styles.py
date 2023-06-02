from app.constants import GlobalStyle


def background_white_pattern():
    return dict(
        background_image="url(/bg/white_pattern.jpg)",
        background_blend_mode="soft-light",
        background_color=GlobalStyle.Palette.WHITE + "90",
    )


def background_darken(percent: float):
    return dict(
        background_color=f"rgba(0, 0, 0, {percent / 100})",
        background_blend_mode="darken",
    )


def background_cover():
    return dict(
        background_attachment="fixed",
        background_position="center",
        background_repeat="no-repeat",
        background_size="cover",
    )


def card_shadow():
    return dict(
        box_shadow="0 2px 3px rgba(10, 10, 10, 0.1), 0 0 0 1px rgba(10, 10, 10, 0.1)",
    )
