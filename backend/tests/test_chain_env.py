"""Tests for unified provider retry environment variable parsing (Part 0)."""

from __future__ import annotations

import logging

import pytest

from app.main import get_provider_chain, reset_provider_chain
from app.vision import build_chain_from_env


def test_retry_settings_unset_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PROVIDER_RETRIES", raising=False)
    monkeypatch.delenv("PROVIDER_RETRY_BACKOFF_SECONDS", raising=False)

    chain = build_chain_from_env()
    assert chain.retries == 1
    assert chain.retry_backoff == 0.8


def test_retry_settings_retries_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROVIDER_RETRIES", "0")
    monkeypatch.delenv("PROVIDER_RETRY_BACKOFF_SECONDS", raising=False)

    chain = build_chain_from_env()
    assert chain.retries == 0
    assert chain.retry_backoff == 0.8


def test_retry_settings_retries_invalid_abc(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING)
    monkeypatch.setenv("PROVIDER_RETRIES", "abc")

    chain = build_chain_from_env()
    assert chain.retries == 1

    retry_warnings = [r.message for r in caplog.records if "PROVIDER_RETRIES" in r.message]
    assert len(retry_warnings) == 1
    assert "using default 1" in retry_warnings[0]


def test_retry_settings_retries_negative(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING)
    monkeypatch.setenv("PROVIDER_RETRIES", "-3")

    chain = build_chain_from_env()
    assert chain.retries == 1

    retry_warnings = [r.message for r in caplog.records if "PROVIDER_RETRIES" in r.message]
    assert len(retry_warnings) == 1
    assert "using default 1" in retry_warnings[0]


def test_retry_settings_backoff_invalid_abc(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING)
    monkeypatch.setenv("PROVIDER_RETRY_BACKOFF_SECONDS", "abc")

    chain = build_chain_from_env()
    assert chain.retry_backoff == 0.8

    backoff_warnings = [
        r.message for r in caplog.records if "PROVIDER_RETRY_BACKOFF_SECONDS" in r.message
    ]
    assert len(backoff_warnings) == 1
    assert "using default 0.8s" in backoff_warnings[0]


def test_retry_settings_backoff_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROVIDER_RETRY_BACKOFF_SECONDS", "0")

    chain = build_chain_from_env()
    assert chain.retry_backoff == 0.0


def test_cached_chain_matches_build_chain_from_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PROVIDER_RETRIES", "2")
    monkeypatch.setenv("PROVIDER_RETRY_BACKOFF_SECONDS", "1.5")
    reset_provider_chain()

    try:
        app_chain = get_provider_chain()
        assert app_chain.retries == 2
        assert app_chain.retry_backoff == 1.5
    finally:
        reset_provider_chain()
