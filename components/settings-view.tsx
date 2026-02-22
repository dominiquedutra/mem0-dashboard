"use client"

import { useEffect, useState } from "react"
import type { DashboardSettings } from "@/types/memory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

function StatusDot({ status }: { status: string }) {
  const color =
    status === "green"
      ? "bg-green-500"
      : status === "yellow"
        ? "bg-yellow-500"
        : "bg-red-500"

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {status}
    </span>
  )
}

function SettingRow({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${muted ? "text-muted-foreground italic" : ""}`}>
        {value}
      </span>
    </div>
  )
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

export default function SettingsView() {
  const [settings, setSettings] = useState<DashboardSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings")
        if (!res.ok) throw new Error("Failed to fetch settings")
        const data: DashboardSettings = await res.json()
        setSettings(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex justify-between py-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !settings) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>{error ?? "Unable to load settings"}</p>
          <p className="text-xs mt-1">Make sure Qdrant is reachable</p>
        </CardContent>
      </Card>
    )
  }

  const isMuted = (val: string) =>
    val === "unknown" || val === "not configured"

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SettingsSection title="mem0 Configuration">
          <SettingRow label="Embedder Model" value={settings.mem0.embedder_model} />
          <SettingRow label="Embedding Dimensions" value={settings.mem0.embedding_dimensions} />
          <SettingRow label="Distance Metric" value={settings.mem0.distance_metric} />
          <SettingRow
            label="LLM Extractor"
            value={settings.mem0.llm_extractor}
            muted={isMuted(settings.mem0.llm_extractor)}
          />
          <SettingRow label="Min Score" value={settings.mem0.min_score} />
          <SettingRow
            label="Sync Window"
            value={settings.mem0.sync_window}
            muted={isMuted(settings.mem0.sync_window)}
          />
        </SettingsSection>

        <SettingsSection title="Qdrant Connection">
          <SettingRow label="URL" value={settings.qdrant.url} />
          <SettingRow label="Collection" value={settings.qdrant.collection} />
          <SettingRow label="Status" value={<StatusDot status={settings.qdrant.status} />} />
          <SettingRow label="Version" value={settings.qdrant.version} />
          <SettingRow
            label="Auth Enabled"
            value={
              <Badge variant={settings.qdrant.auth_enabled ? "default" : "secondary"}>
                {settings.qdrant.auth_enabled ? "Yes" : "No"}
              </Badge>
            }
          />
        </SettingsSection>

        <SettingsSection title="Dashboard">
          <SettingRow label="Refresh Interval" value={`${settings.dashboard.refresh_interval_s}s`} />
          <SettingRow
            label="Agents"
            value={
              <span className="flex gap-1 flex-wrap justify-end">
                {settings.dashboard.agents.map((a) => (
                  <Badge key={a} variant="outline">{a}</Badge>
                ))}
              </span>
            }
          />
          <SettingRow label="Page Size" value={settings.dashboard.page_size} />
          <SettingRow label="Port" value={settings.dashboard.port} />
        </SettingsSection>
      </div>

      <p className="text-xs text-muted-foreground">
        Settings are read-only. Edit .env to change.
      </p>
    </div>
  )
}
