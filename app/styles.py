def background_darken(percent: float):
    return dict(
        background_color=f"rgba(0, 0, 0, {percent / 100})",
        background_blend_mode="darken",
    )


def background_image(file_name: str):
    return dict(background_image=f"url(/bg/{file_name})")
