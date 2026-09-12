"""Deterministic threat enrichment for analyst-ready context and actions."""

from __future__ import annotations

import re
from typing import Any


TECHNIQUE_PATTERNS: tuple[tuple[re.Pattern[str], dict[str, str]], ...] = (
    (re.compile(r"\bphishing\b", re.I), {"id": "T1566", "name": "Phishing"}),
    (
        re.compile(r"\bransomware\b|\bencrypt(?:ed|ion|ing)?\s+(?:files?|data)\b", re.I),
        {"id": "T1486", "name": "Data Encrypted for Impact"},
    ),
    (
        re.compile(r"\bcredential(?:s)?\b|\bdump(?:ed|ing)?\b", re.I),
        {"id": "T1003", "name": "OS Credential Dumping"},
    ),
    (
        re.compile(r"\bprivilege\s+escalation\b|\bescalat(?:e|es|ed|ing)\b", re.I),
        {"id": "T1068", "name": "Exploitation for Privilege Escalation"},
    ),
    (
        re.compile(r"\bremote\s+code\s+execution\b|\brce\b", re.I),
        {"id": "T1210", "name": "Exploitation of Remote Services"},
    ),
    (
        re.compile(r"\bcommand\s+execution\b|\b(?:web\s*)?shell\b", re.I),
        {"id": "T1059", "name": "Command and Scripting Interpreter"},
    ),
)


def map_mitre_techniques(*values: Any) -> list[dict[str, str]]:
    """Return de-duplicated ATT&CK techniques found in arbitrary text values."""
    searchable = " ".join(str(value) for value in values if value)
    return [technique for pattern, technique in TECHNIQUE_PATTERNS if pattern.search(searchable)]


def _escape_siem_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _siem_query(threat: dict[str, Any]) -> str:
    cve = threat.get("cve_id")
    if cve:
        return f'index=security cve_id="{cve}" | stats count by host, user, src_ip'

    iocs = [str(ioc.get("value", "")) for ioc in threat.get("iocs", []) if ioc.get("value")]
    if iocs:
        values = ", ".join(f'"{_escape_siem_value(value)}"' for value in iocs[:5])
        return f"index=security (src IN ({values}) OR dest IN ({values})) | stats count by host, src, dest"

    external_id = str(threat.get("external_id", "unknown"))
    return f'index=security threat_reference="{external_id}" | stats count by host, source, action'


def build_triage_playbook(threat: dict[str, Any]) -> list[dict[str, str]]:
    """Build a predictable three-step Tier 1 investigation checklist."""
    product = threat.get("product") or threat.get("vendor") or "the affected technology"
    remediation = threat.get("remediation") or "Review vendor guidance and apply the validated mitigation."
    patch_url = threat.get("patch_url") or threat.get("source_url") or ""

    return [
        {
            "phase": "Containment",
            "title": "Limit exposure",
            "action": f"Isolate or restrict network access for hosts running {product}; preserve volatile evidence before making changes.",
        },
        {
            "phase": "Investigation",
            "title": "Scope the activity",
            "action": "Run the prepared SIEM query, validate hits against asset criticality, and preserve the relevant event timeline.",
            "query": _siem_query(threat),
        },
        {
            "phase": "Remediation",
            "title": "Remove the exposure",
            "action": remediation,
            "link": patch_url,
        },
    ]


def build_detection_starter(threat: dict[str, Any]) -> str:
    """Create a safe, review-required Sigma-style starting point for the UI."""
    reference = threat.get("cve_id") or threat.get("external_id") or "threat-reference"
    title = re.sub(r"[^A-Za-z0-9 _.-]", "", str(threat.get("title", "Threat activity")))[:80]
    return (
        f"title: Potential {title}\n"
        f"status: experimental\n"
        f"references:\n  - {reference}\n"
        "logsource:\n  category: process_creation\n"
        "detection:\n  selection:\n    CommandLine|contains: '<add validated artifact>'\n"
        "  condition: selection\nfalsepositives:\n  - Administrative activity\nlevel: high"
    )


def enrich_threat(threat: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of a normalized threat with intelligence context attached."""
    enriched = dict(threat)
    enriched["mitre_techniques"] = map_mitre_techniques(
        threat.get("title"), threat.get("description"), threat.get("remediation")
    )
    enriched["playbook"] = build_triage_playbook(enriched)
    enriched["detection_starter"] = build_detection_starter(enriched)
    return enriched
