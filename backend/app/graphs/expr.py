"""A safe parser and evaluator for y = f(x) expressions read from a graph image.

The text comes from a vision model, so it is untrusted. There is NO eval/exec and no attribute
access: a recursive-descent parser builds a tiny immutable AST that only knows numbers, the
variable ``x``, a few constants, + - * / ^ and a whitelist of one-argument functions. Length,
nesting depth and node count are capped so hostile input cannot hang or exhaust memory.

Accepted spellings (case-insensitive): ``y = 2x^2 - 3``, ``sin(x)``, ``f(x)=e^(-x)``,
``2sin(3x)``, ``|x|``-free (use ``abs(x)``), ``**`` for powers, ``pi``/``π``, ``√``-free
(use ``sqrt(x)``), ``ln``/``log`` (natural log), ``log10``, implicit multiplication (``2x``,
``3(x+1)``, ``x sin(x)``).
"""

from __future__ import annotations

import math
import re
from collections.abc import Callable
from dataclasses import dataclass

MAX_LENGTH = 200
MAX_DEPTH = 24
MAX_NODES = 200
MAX_EXPONENT = 12.0  # |exponent| cap keeps x**p finite and cheap

FUNCTIONS: dict[str, Callable[[float], float]] = {
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "asin": math.asin,
    "acos": math.acos,
    "atan": math.atan,
    "sinh": math.sinh,
    "cosh": math.cosh,
    "tanh": math.tanh,
    "exp": math.exp,
    "ln": math.log,
    "log": math.log,
    "log10": math.log10,
    "log2": math.log2,
    "sqrt": math.sqrt,
    "abs": abs,
}
CONSTANTS: dict[str, float] = {"pi": math.pi, "e": math.e}

_TOKEN = re.compile(r"\s*(?:(\d+\.?\d*|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|[-+*/^()]))")


class ExpressionError(ValueError):
    """The text is not a safe, supported function of x."""


@dataclass(frozen=True)
class Node:
    """One AST node: kind is num, var, neg, bin or call."""

    kind: str
    value: float | str = 0.0
    args: tuple[Node, ...] = ()


def _normalize(text: str) -> str:
    """Strip an ``y =`` / ``f(x) =`` prefix and unify unicode math characters."""
    cleaned = text.strip().lower()
    cleaned = (
        cleaned.replace("π", "pi")
        .replace("−", "-")
        .replace("×", "*")
        .replace("·", "*")
        .replace("÷", "/")
        .replace("²", "^2")
        .replace("³", "^3")
    )
    return re.sub(r"^\s*(?:y|f\s*\(\s*x\s*\)|f)\s*=\s*", "", cleaned)


def _tokenize(text: str) -> list[tuple[str, str]]:
    tokens: list[tuple[str, str]] = []
    pos = 0
    while pos < len(text):
        if text[pos:].strip() == "":
            break
        match = _TOKEN.match(text, pos)
        if match is None:
            raise ExpressionError(f"unsupported character near {text[pos : pos + 8]!r}")
        number, name, symbol = match.groups()
        if number is not None:
            tokens.append(("num", number))
        elif name is not None:
            tokens.append(("name", name))
        else:
            tokens.append(("op", "^" if symbol == "**" else str(symbol)))
        pos = match.end()
    return tokens


class _Parser:
    """expr := term (('+'|'-') term)* ; term := unary (('*'|'/'|implicit) unary)* ; ..."""

    def __init__(self, tokens: list[tuple[str, str]]) -> None:
        self.tokens = tokens
        self.pos = 0
        self.nodes = 0

    def _peek(self) -> tuple[str, str] | None:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def _take(self) -> tuple[str, str]:
        token = self._peek()
        if token is None:
            raise ExpressionError("unexpected end of expression")
        self.pos += 1
        return token

    def _node(self, node: Node) -> Node:
        self.nodes += 1
        if self.nodes > MAX_NODES:
            raise ExpressionError("expression is too large")
        return node

    def parse(self) -> Node:
        if not self.tokens:
            raise ExpressionError("empty expression")
        tree = self._expr(0)
        if self._peek() is not None:
            raise ExpressionError(f"unexpected {self._peek()[1]!r}")  # type: ignore[index]
        return tree

    def _expr(self, depth: int) -> Node:
        self._guard(depth)
        left = self._term(depth + 1)
        while (token := self._peek()) is not None and token in (("op", "+"), ("op", "-")):
            self._take()
            right = self._term(depth + 1)
            left = self._node(Node("bin", token[1], (left, right)))
        return left

    def _term(self, depth: int) -> Node:
        self._guard(depth)
        left = self._unary(depth + 1)
        while True:
            token = self._peek()
            if token in (("op", "*"), ("op", "/")):
                self._take()
                right = self._unary(depth + 1)
                left = self._node(Node("bin", token[1], (left, right)))  # type: ignore[index]
            elif self._starts_operand(token):  # implicit multiplication: 2x, 3(x+1), x sin(x)
                right = self._unary(depth + 1)
                left = self._node(Node("bin", "*", (left, right)))
            else:
                return left

    @staticmethod
    def _starts_operand(token: tuple[str, str] | None) -> bool:
        return token is not None and (token[0] in ("num", "name") or token == ("op", "("))

    def _unary(self, depth: int) -> Node:
        self._guard(depth)
        token = self._peek()
        if token in (("op", "-"), ("op", "+")):
            self._take()
            operand = self._unary(depth + 1)
            return self._node(Node("neg", "-", (operand,))) if token[1] == "-" else operand  # type: ignore[index]
        return self._power(depth + 1)

    def _power(self, depth: int) -> Node:
        self._guard(depth)
        base = self._atom(depth + 1)
        if self._peek() == ("op", "^"):
            self._take()
            exponent = self._unary(depth + 1)  # right-associative, allows 2^-x
            return self._node(Node("bin", "^", (base, exponent)))
        return base

    def _atom(self, depth: int) -> Node:
        self._guard(depth)
        kind, text = self._take()
        if kind == "num":
            return self._node(Node("num", float(text)))
        if kind == "name":
            if text == "x":
                return self._node(Node("var", "x"))
            if text in CONSTANTS:
                return self._node(Node("num", CONSTANTS[text]))
            if text in FUNCTIONS and self._peek() == ("op", "("):
                self._take()
                argument = self._expr(depth + 1)
                if self._take() != ("op", ")"):
                    raise ExpressionError("missing closing parenthesis")
                return self._node(Node("call", text, (argument,)))
            raise ExpressionError(f"unknown name {text!r}")
        if (kind, text) == ("op", "("):
            inner = self._expr(depth + 1)
            if self._take() != ("op", ")"):
                raise ExpressionError("missing closing parenthesis")
            return inner
        raise ExpressionError(f"unexpected {text!r}")

    @staticmethod
    def _guard(depth: int) -> None:
        if depth > MAX_DEPTH:
            raise ExpressionError("expression is nested too deeply")


def parse_expression(text: str) -> Node:
    """Parse model-supplied text into an AST, or raise ExpressionError. Never evaluates code."""
    if not isinstance(text, str) or not text.strip():
        raise ExpressionError("empty expression")
    if len(text) > MAX_LENGTH:
        raise ExpressionError("expression is too long")
    return _Parser(_tokenize(_normalize(text))).parse()


def evaluate(node: Node, x: float) -> float:
    """Evaluate an AST at x. Returns NaN where the function is undefined (division by zero,
    log of a non-positive number, overflow...), so callers can break the curve there."""
    try:
        return _eval(node, x)
    except (ValueError, ZeroDivisionError, OverflowError):
        return math.nan


def _eval(node: Node, x: float) -> float:
    if node.kind == "num":
        return float(node.value)
    if node.kind == "var":
        return x
    if node.kind == "neg":
        return -_eval(node.args[0], x)
    if node.kind == "call":
        return FUNCTIONS[str(node.value)](_eval(node.args[0], x))
    left, right = _eval(node.args[0], x), _eval(node.args[1], x)
    op = node.value
    if op == "+":
        return left + right
    if op == "-":
        return left - right
    if op == "*":
        return left * right
    if op == "/":
        return left / right
    if abs(right) > MAX_EXPONENT:
        raise OverflowError("exponent too large")
    result = left**right
    if isinstance(result, complex):  # negative base with a fractional exponent
        raise ValueError("complex result")
    return result
