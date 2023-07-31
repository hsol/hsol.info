from functools import partial

import reflex

page_container = partial(
    reflex.box,
    class_name="article",
    min_width="375px",
    height="100vh",
    overflow_y="scroll",
)
