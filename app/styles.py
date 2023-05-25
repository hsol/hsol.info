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
