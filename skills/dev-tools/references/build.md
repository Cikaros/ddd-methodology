# 构建链路约定

## Java 生态

- `javac` 编译；`maven`（`mvn -q verify`）或 `gradle`（`./gradlew build`）驱动。
- 构建脚本与依赖声明入版本控制；不提交 `target/`、`build/`。

## C/C++

- `gcc`/`g++` 编译；`make` 或 `cmake` 驱动；编译警告当错误处理（项目可覆盖）。
- 不提交对象文件与产物目录。

## NASM

- `nasm -f <fmt> -o out.o src.asm`；`ld` 链接；产物目录不入版本控制。

## Android

- `./gradlew assembleDebug`；`adb install` / `adb logcat` 调试。
- 不提交 `build/`、`.gradle/`。

## 判断

- 构建失败先看首个错误，不追末端连锁错误。
- 构建产物是**派生物**：不入权威件，不在其中写事实。
