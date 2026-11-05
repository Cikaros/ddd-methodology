---
name: lang-python
description: Python 语言技能，只承载 ruff 与 mypy 判不了或判不全的语义条目，可机械判定的条目落 assets 配置基线。当节点为 detail-design、implement 或 defect-fix 且涉及 .py 源码，需要决定私有边界、文档字符串风格、空值测试写法、异常处理质量、模块导入结构与抽象载体选型时读本技能。
---

# Python 语义约束与配置资产

本技能只收不可机械判定或仅部分可判定的条目：私有边界、文档字符串风格、空值测试写法、异常处理质量与返回值一致性、类型变量与异常命名、模块导入结构、惰性求值取舍、数据载体与抽象载体选型。导入排序、行长、通配导入、未使用符号、裸 except、可变默认参数与类型严格度等可机械判定的条目一律落入 `assets/ruff.toml` 与 `assets/mypy.ini`，本正文不重述，避免重复定义。

## 何时用

1. 在 detail-design、implement、defect-fix 节点撰写或修改 `.py` 文件，需要决定成员可见性、文档字符串风格或模块依赖结构时。
2. 判断一个 Python 条目该由 lint 机械拦还是只能靠人判断时。
3. 需要落地 Python 配置基线，或核对某条目是否已被基线覆盖时。

## 做什么

1. **私有边界择一**：非公开成员用单下划线 `_name` 作约定式标记；双下划线 `__name` 触发名称改写，只在需阻断子类意外覆盖时使用。二者都不改变真实可见性，选哪一个取决于是否刻意阻断继承。（官方出处：PEP 8 命名约定，https://peps.python.org/pep-0008/#descriptive-naming-styles ）
2. **文档字符串风格择一**：PEP 257 只规定摘要行规范，具体风格（reST、Google、NumPy）并存，须在项目内择一，不得逐文件混用。摘要行以第三人称祈使式开头、以句号结尾，空行后接正文。（官方出处：PEP 257，https://peps.python.org/pep-0257/ ）
3. **空值测试按真值语义写**：判断序列、映射、字符串是否为空用 `if not seq`，判断非空用 `if seq`，不用 `if len(seq) == 0` 这类等长比较。此条无 lint 覆盖，属模型高频偏离项。（官方出处：PEP 8 编程建议，https://peps.python.org/pep-0008/#programming-recommendations ）
4. **惰性与内存择一**：小规模、需反复遍历或需下标访问的数据用列表；大数据集或流式处理用生成器表达式，避免提前物化。此取舍无 lint 判定。（官方出处：Python 教程「生成器」，https://docs.python.org/3/tutorial/classes.html#generators ）
5. **模块导入结构先于局部导入**：出现循环导入时优先重排模块边界，或对仅用于注解的引用用 `typing.TYPE_CHECKING` 前置导入；运行时局部导入只在无法解耦时保留，并须在文件内说明原因。（官方出处：typing 文档 `TYPE_CHECKING`，https://docs.python.org/3/library/typing.html#typing.TYPE_CHECKING ）
6. **数据载体选型**：纯数据聚合且需相等语义用 `dataclasses.dataclass`；需不可变且可解构用 `typing.NamedTuple`；含行为或不变式用普通类。三者语义不同，不得因省事互替。（官方出处：dataclasses 文档，https://docs.python.org/3/library/dataclasses.html ）
7. **抽象载体择一**：需显式继承与运行时校验用 `abc.ABC`；需结构化（鸭子类型）静态检查用 `typing.Protocol`。二者不并存于同一契约，择一后全项目一致。（官方出处：typing 文档「协议」，https://docs.python.org/3/library/typing.html#typing.Protocol ）
8. **异常处理不留静默吞没**：捕获异常后不得静默 `pass`、不得仅打印后吞掉；须传递、包装重抛或记录到可观测通道。为「让测试通过」而吞异常属高频缺陷，检查器只覆盖 `pass` 形态、判别仍需人判断。（官方出处：Google Python Style Guide 异常节，https://google.github.io/styleguide/pyguide.html#24-exceptions ）
9. **函数返回路径一致**：同一函数内的 `return` 须一致——要么各路径都返回表达式，要么都不返回；早返回分支漏少返回值不触发语法或 lint 错误，属无检查器覆盖的语义缺陷。（官方出处：PEP 8 编程建议，https://peps.python.org/pep-0008/#programming-recommendations ）
10. **类型变量命名带协变信息**：类型变量用 CapWords 短名；声明协变加 `_co` 后缀、逆变加 `_contra` 后缀，使协变/逆变方向内建于命名。属冷门约定，模型易忽略后缀含义。（官方出处：PEP 484 类型变量，https://peps.python.org/pep-0484/ ）
11. **异常类名以 `Error` 结尾**：自定义异常名以 `Error` 结尾，使「这是异常」内建于命名；非强制语法，模型易用随意名。（官方出处：PEP 8 异常命名，https://peps.python.org/pep-0008/#exception-names ）

## 不做什么

1. 不写导入排序、行长、通配导入、未使用符号、裸 except、可变默认参数与类型严格度，那些是机械可判定条目，只在 `assets/ruff.toml` 与 `assets/mypy.ini` 定义一次。
2. 不定义文档字符串是否被检查的机械规则，那属工具配置；本技能只给风格取向。
3. 不承载测试用例设计与缺陷定级，分属 spec-test-case 与 spec-defect-routing。
4. 不收录模型已下意识遵守的通用写法。
5. 不以本技能替代派发任务文本。
