import inspect
import itertools
import pkgutil
import typing


def flatten(value: typing.Iterable):
    return list(itertools.chain(*value))


def import_all_sub_classes(dirname: str, base_class: typing.Type):
    return flatten(
        [
            obj
            for name, obj in inspect.getmembers(module)
            if inspect.isclass(obj)
            and obj != base_class
            and issubclass(obj, base_class)
        ]
        for module in [
            module_info.find_module(module_name).load_module(module_name)
            for module_info, module_name, _ in pkgutil.iter_modules([dirname])
        ]
    )
