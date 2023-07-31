import typing

import reflex


class BasePage:
    title: str | None = None
    description: str | None = None
    route: str | None = None

    state: typing.Type[reflex.State]

    def __init__(self, *args, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def get_additional_vanilla(self) -> str:
        return """
        <!-- Calendly badge widget begin -->
        <link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet">
        <script src="https://assets.calendly.com/assets/external/widget.js" type="text/javascript" async></script>
        <script type="text/javascript">window.onload = function() { Calendly.initBadgeWidget({ url: 'https://calendly.com/contact-hsol', text: '커피챗 하실래요?', color: '#1abc9c', textColor: '#ffffff', branding: true }); }</script>
        <!-- Calendly badge widget end -->
        """

    def get_component(self, *args, **kwargs) -> reflex.Component:
        raise NotImplementedError

    def get_add_page_options(self) -> dict:
        return {}

    def get_on_load_event_handler(self) -> typing.Callable[[], None] | None:
        return None
