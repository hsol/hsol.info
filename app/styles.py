def background_darken(percent: float):
    return dict(
        background_color=f"rgba(0, 0, 0, {percent / 100})",
        background_blend_mode="darken",
    )
