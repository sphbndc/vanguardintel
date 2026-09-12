"""Asynchronous OSINT ingestion with normalized, non-throwing source results."""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable
from urllib.parse import urlparse

import httpx

from app.services.intelligence import enrich_threat

LOGGER = logging.getLogger(__name__)

CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
OTX_PULSES_URL = "https://otx.alienvault.com/api/v1/pulses/subscribed"
GITHUB_ADVISORIES_URL = "https://api.github.com/advisories"


@dataclass(slots=True)
class SourceResult:
    source: str
    status: str
    threats: list[dict[str, Any]]
    fetched_at: str
    message: str | None = None

    def public_metadata(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("threats")
        data["count"] = len(self.threats)
        return data


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_text(value: Any, fallback: str = "") -> str:
    return " ".join(str(value or fallback).split())


def _trusted_otx_media(pulse: dict[str, Any]) -> str | None:
    """Return source-supplied OTX media only from AlienVault-controlled HTTPS hosts."""
    for field in ("image_url", "cover_image", "cover_img", "image"):
        candidate = pulse.get(field)
        if not isinstance(candidate, str) or not candidate:
            continue
        parsed = urlparse(candidate)
        hostname = (parsed.hostname or "").lower()
        if parsed.scheme == "https" and (hostname == "alienvault.com" or hostname.endswith(".alienvault.com")):
            return candidate
    return None


def _source_failure(source: str, exc: Exception) -> SourceResult:
    LOGGER.warning("OSINT source %s unavailable: %s", source, exc)
    return SourceResult(source, "degraded", [], _now(), f"Upstream unavailable: {type(exc).__name__}")


async def fetch_cisa_kev(client: httpx.AsyncClient, limit: int = 40) -> SourceResult:
    try:
        response = await client.get(CISA_KEV_URL)
        response.raise_for_status()
        records = response.json().get("vulnerabilities", [])
        records = sorted(records, key=lambda item: item.get("dateAdded", ""), reverse=True)[:limit]
        threats = [
            {
                "external_id": item.get("cveID"),
                "cve_id": item.get("cveID"),
                "source": "CISA KEV",
                "kind": "Known Exploited Vulnerability",
                "title": _clean_text(item.get("vulnerabilityName"), item.get("cveID", "CISA KEV entry")),
                "severity": "critical",
                "date_added": item.get("dateAdded"),
                "description": _clean_text(item.get("shortDescription"), "No description supplied."),
                "vendor": _clean_text(item.get("vendorProject"), "Unknown vendor"),
                "product": _clean_text(item.get("product"), "Unknown product"),
                "remediation": _clean_text(item.get("requiredAction"), "Apply CISA-required remediation."),
                "patch_url": f"https://nvd.nist.gov/vuln/detail/{item.get('cveID')}",
                "source_url": "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
                "targeted_industries": [],
                "media_url": None,
                "iocs": [],
            }
            for item in records
            if item.get("cveID")
        ]
        return SourceResult("CISA KEV", "operational", threats, _now())
    # Keep one malformed upstream payload from taking down the other collectors.
    # asyncio.CancelledError is not an Exception, so shutdown cancellation still propagates.
    except Exception as exc:
        return _source_failure("CISA KEV", exc)


async def fetch_otx_pulses(client: httpx.AsyncClient, limit: int = 12) -> SourceResult:
    api_key = os.getenv("OTX_API_KEY", "").strip()
    if not api_key:
        return SourceResult("AlienVault OTX", "unconfigured", [], _now(), "Set OTX_API_KEY to enable subscribed pulses.")

    try:
        response = await client.get(
            OTX_PULSES_URL,
            params={"limit": limit},
            headers={"X-OTX-API-KEY": api_key},
        )
        response.raise_for_status()
        pulses = response.json().get("results", [])[:limit]
        threats: list[dict[str, Any]] = []
        allowed_types = {"IPv4", "IPv6", "domain", "hostname", "FileHash-MD5", "FileHash-SHA1", "FileHash-SHA256"}
        for pulse in pulses:
            indicators = [
                {"type": item.get("type", "indicator"), "value": item.get("indicator", "")}
                for item in pulse.get("indicators", [])
                if item.get("type") in allowed_types and item.get("indicator")
            ][:5]
            pulse_id = pulse.get("id")
            industries = pulse.get("industries") or []
            threats.append(
                {
                    "external_id": pulse_id,
                    "cve_id": None,
                    "source": "AlienVault OTX",
                    "kind": "Threat Pulse",
                    "title": _clean_text(pulse.get("name"), "OTX threat pulse"),
                    "severity": "high",
                    "date_added": pulse.get("modified") or pulse.get("created"),
                    "description": _clean_text(pulse.get("description"), "Community threat intelligence pulse."),
                    "vendor": "Community OSINT",
                    "product": ", ".join(industries[:3]) if industries else "Monitored environment",
                    "remediation": "Block validated indicators, hunt for historical matches, and scope any affected assets.",
                    "patch_url": f"https://otx.alienvault.com/pulse/{pulse_id}" if pulse_id else "https://otx.alienvault.com/",
                    "source_url": f"https://otx.alienvault.com/pulse/{pulse_id}" if pulse_id else "https://otx.alienvault.com/",
                    "targeted_industries": industries,
                    "media_url": _trusted_otx_media(pulse),
                    "iocs": indicators,
                }
            )
        return SourceResult("AlienVault OTX", "operational", threats, _now())
    except Exception as exc:
        return _source_failure("AlienVault OTX", exc)


def _github_package(advisory: dict[str, Any]) -> tuple[str, str]:
    vulnerabilities = advisory.get("vulnerabilities") or []
    package = (vulnerabilities[0].get("package") or {}) if vulnerabilities else {}
    return _clean_text(package.get("ecosystem"), "Software"), _clean_text(package.get("name"), "Affected package")


async def fetch_github_advisories(client: httpx.AsyncClient, limit: int = 20) -> SourceResult:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        response = await client.get(
            GITHUB_ADVISORIES_URL,
            params={"per_page": limit, "severity": "critical", "sort": "published", "direction": "desc"},
            headers=headers,
        )
        response.raise_for_status()
        advisories = response.json()[:limit]
        threats: list[dict[str, Any]] = []
        for advisory in advisories:
            ecosystem, package_name = _github_package(advisory)
            cve = advisory.get("cve_id")
            advisory_url = advisory.get("html_url") or f"https://github.com/advisories/{advisory.get('ghsa_id')}"
            threats.append(
                {
                    "external_id": advisory.get("ghsa_id") or cve,
                    "cve_id": cve,
                    "source": "GitHub Advisory",
                    "kind": "Software Advisory",
                    "title": _clean_text(advisory.get("summary"), advisory.get("ghsa_id", "GitHub advisory")),
                    "severity": advisory.get("severity", "critical").lower(),
                    "date_added": advisory.get("published_at"),
                    "description": _clean_text(advisory.get("description"), "No advisory detail supplied."),
                    "vendor": ecosystem,
                    "product": package_name,
                    "remediation": f"Review affected versions and upgrade {package_name} to the first patched release listed in the advisory.",
                    "patch_url": advisory_url,
                    "source_url": advisory_url,
                    "targeted_industries": [],
                    "media_url": None,
                    "iocs": [],
                }
            )
        return SourceResult("GitHub Advisory", "operational", threats, _now())
    except Exception as exc:
        return _source_failure("GitHub Advisory", exc)


async def fetch_all_sources() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Fetch all sources concurrently and return enriched threats plus source health."""
    timeout = httpx.Timeout(float(os.getenv("HTTP_TIMEOUT_SECONDS", "12")), connect=5.0)
    limits = httpx.Limits(max_connections=10, max_keepalive_connections=5)
    headers = {"User-Agent": "vanguardintel/1.0 (+security-research-dashboard)"}
    async with httpx.AsyncClient(timeout=timeout, limits=limits, follow_redirects=True, headers=headers) as client:
        fetches: tuple[Callable[[httpx.AsyncClient], Awaitable[SourceResult]], ...] = (
            fetch_cisa_kev,
            fetch_otx_pulses,
            fetch_github_advisories,
        )
        results = await asyncio.gather(*(fetch(client) for fetch in fetches))

    unique: dict[str, dict[str, Any]] = {}
    for result in results:
        for threat in result.threats:
            key = str(threat.get("external_id") or f"{threat.get('source')}:{threat.get('title')}")
            unique.setdefault(key, enrich_threat(threat))

    threats = sorted(unique.values(), key=lambda item: item.get("date_added") or "", reverse=True)
    return threats, [result.public_metadata() for result in results]
