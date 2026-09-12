export interface Technique { id: string; name: string }
export interface Indicator { type: string; value: string }
export interface PlaybookStep { phase: string; title: string; action: string; query?: string; link?: string }

export interface Threat {
  external_id: string;
  cve_id?: string | null;
  source: string;
  kind: string;
  title: string;
  severity: string;
  date_added?: string;
  description: string;
  vendor: string;
  product: string;
  remediation: string;
  patch_url: string;
  source_url: string;
  targeted_industries: string[];
  media_url?: string | null;
  iocs: Indicator[];
  mitre_techniques: Technique[];
  playbook: PlaybookStep[];
  detection_starter: string;
}

export interface SourceHealth {
  source: string;
  status: "operational" | "degraded" | "unconfigured";
  count: number;
  fetched_at: string;
  message?: string | null;
}

export interface ThreatResponse {
  status: "operational" | "degraded";
  generated_at: string;
  message?: string | null;
  stats: Record<string, number>;
  sources: SourceHealth[];
  threats: Threat[];
  cache: { state: string; ttl_seconds: number };
  storage?: { engine?: string; retention_days?: number; durability?: string; records_available?: number; records_returned?: number };
}
