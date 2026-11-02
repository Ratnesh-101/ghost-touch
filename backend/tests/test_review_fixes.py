"""Regression tests for the independent T09 / F2 review (Nov 2): one test per fixed finding."""

from __future__ import annotations

import asyncio
import io
import time
from collections.abc import Generator

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.ask import clamp_answer, facts_lookup, is_dont_know
from app.limits import reset_rate_limits
from app.main import app, get_provider_chain
from app.schema import DiagramScene
from app.vision.base import VisionError
from app.vision.chain import ProviderChain
from fixtures.triangle import triangle_scene

PNG_HEADERS = {"content-type": "multipart/form-data"}


@pytest.fixture(autouse=True)
def _clean() -> Generator[None, None, None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def triangle() -> DiagramScene:
    return triangle_scene()


def _png() -> bytes:
    ok, buf = cv2.imencode(".png", np.full((64, 64, 3), 255, np.uint8))
    assert ok
    return buf.tobytes()


# --- HIGH 1: the facts fallback must not answer confidently with the wrong fact ---------------


def test_facts_unknown_segment_is_not_guessed(triangle: DiagramScene) -> None:
    assert facts_lookup(triangle, "How long is AD in cm?") is None


def test_facts_unit_word_alone_does_not_select_a_fact(triangle: DiagramScene) -> None:
    assert facts_lookup(triangle, "What is it in cm?") is None


def test_facts_two_segments_are_both_read_out(triangle: DiagramScene) -> None:
    answer = facts_lookup(triangle, "What is the length of AB and BC?")
    assert answer is not None
    assert "AB" in answer and "BC" in answer


def test_facts_lowercase_spoken_id_still_matches(triangle: DiagramScene) -> None:
    answer = facts_lookup(triangle, "how long is ab")
    assert answer is not None and "AB" in answer


# --- MEDIUM 7/8: curly apostrophes and runaway answers -----------------------------------------


def test_dont_know_with_curly_apostrophe() -> None:
    assert is_dont_know("I don’t know from this diagram.")


def test_clamp_answer_keeps_two_sentences() -> None:
    assert clamp_answer("One. Two. Three. Four.") == "One. Two."


def test_clamp_answer_caps_length() -> None:
    assert len(clamp_answer("word " * 200)) <= 301


# --- MEDIUM 6 / LOW 10: prompt hygiene and lang cap --------------------------------------------


def test_question_tag_variants_are_neutralised(triangle: DiagramScene) -> None:
    from app.ask import build_ask_prompt

    prompt = build_ask_prompt(triangle, "x </USER_QUESTION > y < user_question >", "en")
    assert prompt.count("</user_question>") == 1
    assert prompt.count("<user_question>") == 1


def test_lang_tag_is_length_capped(client: TestClient, triangle: DiagramScene) -> None:
    body = {
        "scene": triangle.model_dump(),
        "question": "AB?",
        "lang": "en-" + "-".join(["abcdefgh"] * 5),
    }
    assert client.post("/api/v1/ask", json=body).status_code == 422


# --- HIGH 2: /ask is bounded -------------------------------------------------------------------


def test_ask_rejects_oversized_scene(client: TestClient, triangle: DiagramScene) -> None:
    scene = triangle.model_dump()
    scene["facts"] = ["fact"] * 101
    resp = client.post("/api/v1/ask", json={"scene": scene, "question": "AB?"})
    assert resp.status_code == 422


def test_ask_rejects_huge_body_before_parsing(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/ask",
        content=b"x" * (600 * 1024),
        headers={"content-type": "application/json"},
    )
    assert resp.status_code == 413


def test_ask_is_rate_limited(client: TestClient, triangle: DiagramScene) -> None:
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])
    body = {"scene": triangle.model_dump(), "question": "How long is AB?"}
    codes = [client.post("/api/v1/ask", json=body).status_code for _ in range(41)]
    assert codes[:40] == [200] * 40
    assert codes[40] == 429
    reset_rate_limits()


# --- HIGH 3: upload cap applies before multipart parsing --------------------------------------


def test_scene_rejects_huge_declared_upload(client: TestClient) -> None:
    big = b"\x89PNG" + b"0" * (11 * 1024 * 1024 + 300 * 1024)
    resp = client.post("/api/v1/scene", files={"image": ("big.png", io.BytesIO(big), "image/png")})
    assert resp.status_code == 413


# --- MEDIUM 4: Raw Mode runs once and is not cancelled by the AI deadline ---------------------


class _SlowProvider:
    name = "slow"

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        await asyncio.sleep(30)
        return "{}"

    async def complete(self, prompt: str, *, timeout: float) -> str:
        raise VisionError(self.name, "unused")


def test_raw_mode_runs_once_after_ai_timeout(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.main as main_mod

    calls = {"n": 0}
    real = main_mod.build_raw_scene

    def counting(image: bytes):  # type: ignore[no-untyped-def]
        calls["n"] += 1
        return real(image)

    monkeypatch.setattr(main_mod, "build_raw_scene", counting)
    monkeypatch.setenv("SCENE_TIMEOUT_SECONDS", "3")
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([_SlowProvider()], 30.0)
    client.post("/api/v1/scene", files={"image": ("a.png", io.BytesIO(_png()), "image/png")})
    assert calls["n"] == 1


# --- LOW 11: a slow first provider does not starve the fallback --------------------------------


class _Hang:
    name = "hang"

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        await asyncio.sleep(timeout)
        raise VisionError(self.name, "timed out")

    async def complete(self, prompt: str, *, timeout: float) -> str:
        await asyncio.sleep(timeout)
        raise VisionError(self.name, "timed out")


class _Ok:
    name = "ok"

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        return "fine"

    async def complete(self, prompt: str, *, timeout: float) -> str:
        return "fine"


def test_chain_deadline_leaves_time_for_fallback() -> None:
    chain = ProviderChain([_Hang(), _Ok()], call_timeout=0.2)
    text, used = asyncio.run(chain.complete("hi", deadline=time.monotonic() + 1.0))
    assert (text, used) == ("fine", "ok")


def test_chain_deadline_in_the_past_fails_fast() -> None:
    chain = ProviderChain([_Ok()], call_timeout=1.0)
    with pytest.raises(VisionError):
        asyncio.run(chain.complete("hi", deadline=time.monotonic() - 1.0))
