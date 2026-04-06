/*!
 * Nexus Network Health Widget
 * Drop-in embeddable widget for any Nexus ecosystem product.
 *
 * Usage:
 *   <div id="nexus-network-widget"></div>
 *   <script src="https://your-nexus-network-node/widget.js"
 *           data-target="nexus-network-widget"
 *           data-api="https://your-nexus-network-node/api/stats"
 *           data-compact="false">
 *   </script>
 *
 * Attributes:
 *   data-target   — ID of the container element (default: nexus-network-widget)
 *   data-api      — URL of the Nexus-Network /api/stats endpoint
 *   data-compact  — "true" for single-line bar, "false" for full card (default: false)
 *   data-theme    — "dark" | "light" | "auto" (default: auto)
 */
(function () {
  'use strict'

  const script = document.currentScript
  const targetId = script?.getAttribute('data-target') || 'nexus-network-widget'
  const apiUrl = script?.getAttribute('data-api') || '/api/stats'
  const compact = script?.getAttribute('data-compact') === 'true'
  const theme = script?.getAttribute('data-theme') || 'auto'

  const isDark = theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const colors = {
    bg: isDark ? '#161618' : '#ffffff',
    bg2: isDark ? '#1e1e21' : '#f5f5f5',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text: isDark ? '#e8e8e8' : '#111111',
    muted: isDark ? '#888888' : '#666666',
    green: '#1D9E75',
    amber: '#BA7517',
  }

  function fmt(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return String(n)
  }

  function fmtRam(gb) {
    if (gb >= 1024) return (gb / 1024).toFixed(1) + ' TB'
    return Math.round(gb) + ' GB'
  }

  function renderCompact(stats, container) {
    container.innerHTML = `
      <div style="
        display:flex;align-items:center;gap:12px;padding:8px 14px;
        background:${colors.bg};border:1px solid ${colors.border};
        border-radius:8px;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;
        font-size:12px;flex-wrap:wrap;
      ">
        <div style="display:flex;align-items:center;gap:5px;">
          <div style="width:6px;height:6px;border-radius:50%;background:${colors.green};
            animation:nxpulse 2s infinite;flex-shrink:0"></div>
          <span style="font-weight:600;color:${colors.green}">Nexus Network</span>
        </div>
        <div style="color:${colors.muted}">
          <span style="color:${colors.text};font-weight:500">${fmt(stats.nodes_online)}</span> nodes
        </div>
        <div style="color:${colors.muted}">
          <span style="color:${colors.text};font-weight:500">${fmtRam(stats.total_ram_gb)}</span> collective RAM
        </div>
        <div style="color:${colors.muted}">
          <span style="color:${colors.text};font-weight:500">${fmt(stats.total_cpu_cores)}</span> cores
        </div>
        <div style="color:${colors.muted}">
          <span style="color:${colors.text};font-weight:500">${stats.countries}</span> countries
        </div>
      </div>
      <style>@keyframes nxpulse{0%,100%{opacity:1}50%{opacity:0.3}}</style>
    `
  }

  function renderFull(stats, container) {
    const products = [
      { key: 'nexus', label: 'Nexus' },
      { key: 'nexus-hosting', label: 'Hosting' },
      { key: 'nexus-cloud', label: 'Cloud' },
      { key: 'nexus-deploy', label: 'Deploy' },
      { key: 'nexus-computer', label: '.computer' },
      { key: 'nexus-vault', label: 'Vault' },
    ]

    const maxCount = Math.max(...products.map(p => stats.product_counts?.[p.key] ?? 0), 1)

    const productBars = products.map(p => {
      const count = stats.product_counts?.[p.key] ?? 0
      const pct = Math.round((count / maxCount) * 100)
      return `
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span style="font-size:11px;color:${colors.muted}">${p.label}</span>
            <span style="font-size:11px;color:${colors.text};font-weight:500">${fmt(count)}</span>
          </div>
          <div style="background:${colors.bg2};border-radius:3px;height:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${colors.green};border-radius:3px;
              transition:width 0.8s ease"></div>
          </div>
        </div>`
    }).join('')

    container.innerHTML = `
      <style>@keyframes nxpulse{0%,100%{opacity:1}50%{opacity:0.3}}</style>
      <div style="
        background:${colors.bg};border:1px solid ${colors.border};border-radius:12px;
        padding:16px 18px;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;
        color:${colors.text};
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:7px;height:7px;border-radius:50%;background:${colors.green};
              animation:nxpulse 2s infinite"></div>
            <span style="font-size:13px;font-weight:600;color:${colors.green}">Nexus Network</span>
          </div>
          <span style="font-size:11px;color:${colors.muted}" id="nx-updated-${targetId}">live</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
          ${[
            { label: 'Nodes', value: fmt(stats.nodes_online), color: colors.green },
            { label: 'Collective RAM', value: fmtRam(stats.total_ram_gb), color: colors.text },
            { label: 'CPU Cores', value: fmt(stats.total_cpu_cores), color: colors.text },
            { label: 'Storage', value: fmtRam(stats.total_storage_gb), color: colors.text },
            { label: 'Compute Jobs', value: fmt(stats.compute_jobs_hour), color: colors.amber },
            { label: 'Countries', value: String(stats.countries), color: colors.text },
          ].map(m => `
            <div style="background:${colors.bg2};border-radius:8px;padding:10px 12px">
              <div style="font-size:10px;color:${colors.muted};text-transform:uppercase;
                letter-spacing:0.5px;margin-bottom:4px">${m.label}</div>
              <div style="font-size:18px;font-weight:600;color:${m.color};line-height:1">${m.value}</div>
            </div>
          `).join('')}
        </div>

        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;
          color:${colors.muted};margin-bottom:8px">Product adoption</div>
        ${productBars}

        <div style="margin-top:12px;padding-top:10px;border-top:1px solid ${colors.border};
          font-size:11px;color:${colors.muted};text-align:center">
          <a href="https://github.com/The-No-Hands-company/Nexus-Network"
            style="color:${colors.muted};text-decoration:none" target="_blank">
            Nexus Network · Open Source · No personal data
          </a>
        </div>
      </div>
    `
  }

  function fetchAndRender() {
    const container = document.getElementById(targetId)
    if (!container) return

    fetch(apiUrl)
      .then(r => r.json())
      .then(stats => {
        if (compact) {
          renderCompact(stats, container)
        } else {
          renderFull(stats, container)
        }
        const el = document.getElementById(`nx-updated-${targetId}`)
        if (el) el.textContent = new Date().toLocaleTimeString()
      })
      .catch(() => {
        const container = document.getElementById(targetId)
        if (container) container.innerHTML = `
          <div style="padding:10px 14px;border-radius:8px;border:1px solid ${colors.border};
            font-size:12px;color:${colors.muted};font-family:system-ui,sans-serif">
            Nexus Network · Unable to reach stats endpoint
          </div>`
      })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchAndRender)
  } else {
    fetchAndRender()
  }

  setInterval(fetchAndRender, 30_000)
})()
