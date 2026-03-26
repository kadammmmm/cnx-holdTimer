# b+s Hold Timer — LWC for Service Cloud Voice

Custom Utility Bar Component for Service Cloud Voice + Cisco Webex Contact Center via Bucher + Suter Connects.

This Lightning Web Component tracks customer hold time during voice calls, displays a real-time timer in the Service Console utility bar, alerts agents with tiered warnings (30s / 60s / 90s), and syncs total hold seconds to the `CustomerHoldDuration` field on the VoiceCall record via the b+s Connects Integration Library (v2.10+).

## Features

- **Current Hold Timer** — resets each time the customer is placed on hold
- **Total Hold Time** — cumulative across all hold segments for the call
- **Hold Count** — tracks how many times the customer was placed on hold
- **Tiered Warnings** — escalating alerts at 30s (caution), 60s (alert), 90s (critical)
- **Auto-Open / Auto-Close** — utility bar panel opens automatically on hold, minimizes on resume
- **Live Utility Bar Label** — real-time countdown displayed in the utility bar tab (visible even when panel is collapsed)
- **Utility Bar Highlight** — tab highlights when hold threshold is exceeded
- **b+s Sync** — scaffolding for `updateWorkitemData` to write hold duration (not active by default)

## Prerequisites

Before you begin, make sure you have the following installed:

1. **Git** — [Install](https://git-scm.com/downloads) and verify:
   ```bash
   git --version
   ```

2. **Visual Studio Code** — [Install](https://code.visualstudio.com/)

3. **Salesforce Extension Pack for VS Code** — Open VS Code → Extensions (`Ctrl+Shift+X`) → search **"Salesforce Extension Pack"** → Install

4. **Salesforce CLI (sf)** — [Install](https://developer.salesforce.com/tools/sfcli) and verify:
   ```bash
   sf --version
   ```

5. **Bucher + Suter Connects Package** — managed package must be installed in the target Salesforce org (namespace `cnxscv`), Integration Library v2.10+

## Getting Started

### Step 1: Clone the Repository

Open a terminal (or the VS Code integrated terminal) and run:

```bash
git clone https://github.com/kadammmmm/cnx-holdTimer.git
```

### Step 2: Open in VS Code

```bash
cd cnx-holdTimer
code .
```

This opens the project in VS Code. You should see the `force-app` folder in the Explorer sidebar.

### Step 3: Authorize Your Salesforce Org

You need to connect VS Code to the Salesforce org where you want to deploy the component.

**Option A — Command Palette (recommended):**
1. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
2. Type **"SFDX: Authorize an Org"** and select it
3. Choose **Production** or **Sandbox**
4. Enter an alias (e.g., `my-org`)
5. A browser window opens — log in to your Salesforce org and authorize

**Option B — Terminal:**
```bash
# For production
sf org login web --alias my-org --instance-url https://login.salesforce.com

# For sandbox
sf org login web --alias my-sandbox --instance-url https://test.salesforce.com
```

Then set it as your default org:
```bash
sf config set target-org my-org
```

### Step 4: Verify Authorization

Run this to confirm the org is connected:
```bash
sf org list
```

You should see your org listed with the alias you chose.

### Step 5: Deploy to Salesforce

**Option A — Command Palette:**
1. Press `Ctrl+Shift+P`
2. Type **"SFDX: Deploy This Source to Org"**
3. This deploys whatever file or folder you have selected

**Option B — Right-click:**
1. In the Explorer sidebar, right-click the `force-app` folder
2. Select **"SFDX: Deploy Source to Org"**

**Option C — Terminal (most reliable):**
```bash
sf project deploy start -m LightningComponentBundle:holdTimer
```

Wait for the success message:
```
Deploy Succeeded.
```

### Step 6: Add to Utility Bar

1. In Salesforce, go to **Setup** → **App Manager**
2. Find your Service Console app (e.g., "Service Console") → click the dropdown → **Edit**
3. In the left sidebar, click **Utility Items (Desktop Only)**
4. Click **Add Utility Item**
5. Search for **"b+s Hold Timer"** and select it
6. Configure:
   - **Label:** Hold Timer
   - **Icon:** utility:clock
   - **Panel Width:** 280
   - **Panel Height:** 220
   - **Start Automatically:** Enabled (required — keeps the component loaded so b+s events fire)
7. Click **Save**

### Step 7: Verify

1. Open the Service Console app
2. You should see **"Hold Timer"** in the utility bar at the bottom
3. Click it to expand — it should show "Monitoring Calls" in idle state

## Configuration

### Tiered Hold Thresholds

The hold timer uses three escalating warning tiers, defined as constants in `holdTimer.js`:

```
force-app/main/default/lwc/holdTimer/holdTimer.js
```

```js
const TIER_CAUTION  = 30;  // Orange toast, amber border
const TIER_ALERT    = 60;  // Red toast, red border + pulse
const TIER_CRITICAL = 90;  // Red sticky toast, fast pulse, full red panel
```

| Tier | Default | Toast Color | Toast Mode | Panel Visual |
|---|---|---|---|---|
| **Caution** | 30s | Orange (`warning`) | Dismissible | Amber border, slow pulse |
| **Alert** | 60s | Red (`error`) | Dismissible | Red border, medium pulse |
| **Critical** | 90s | Red (`error`) | Sticky | Full red background, fast pulse, red header |

Thresholds apply **per hold segment** — each time the customer is placed on hold, the counter and tier reset. Tiers only escalate (never de-escalate within a segment).

After changing any threshold, redeploy:

```bash
sf project deploy start -m LightningComponentBundle:holdTimer
```

### Other Hardcoded Settings

| Setting | Value | File Location |
|---|---|---|
| Channel ID | `'telephony'` | `holdTimer.js` — `channelId` property |
| b+s field name | `'CustomerHoldDuration'` | `holdTimer.js` — `attemptBsUpdate()` |
| Timer format | `MM:SS` | `holdTimer.js` — `formatDuration()` |

These are not currently admin-configurable and require a code change + redeploy.

## Testing

1. Open the Service Console app
2. Accept an inbound/outbound voice call via Omni-Channel
3. Place the caller on hold:
   - The utility bar panel **opens automatically** and displays "Customer on Hold"
   - The utility bar tab label shows a live countdown: `Hold Timer  ⏱ 00:05`
   - The tab icon changes to a pause icon
4. Observe the current hold timer counting up
5. At **30s**: amber border, orange toast ("Hold Approaching Limit")
6. At **60s**: red border + pulse, red toast ("Customer Waiting Too Long!")
7. At **90s**: full red panel, sticky red toast ("HOLD TIME CRITICAL")
8. Resume the call:
   - The utility bar panel **minimizes automatically**
   - The tab label shows the total: `Hold Timer  ✓ Total: 00:34`
   - The tab icon returns to clock
   - Current hold resets, total hold time persists, tier resets
9. Place on hold again — panel re-opens, current hold restarts from 00:00, total continues accumulating
10. End the call (or enter Wrapup) — timer resets to idle, panel minimizes

## Troubleshooting

| Issue | Solution |
|---|---|
| `sf` command not found | Install the [Salesforce CLI](https://developer.salesforce.com/tools/sfcli) and restart your terminal |
| "No default org set" error | Run `sf config set target-org my-org` with your alias |
| Deploy fails with auth error | Re-authorize: `sf org login web --alias my-org` |
| Component not visible in Utility Items | Ensure the deploy succeeded and search for "b+s Hold Timer" (not "holdTimer") |
| Timer doesn't start on hold | Verify **Start Automatically** is enabled in the Utility Item config |
| Panel doesn't auto-open | Check console for `[holdTimer] Utility panel opened` — if missing, the `EnclosingUtilityId` wire may not have resolved |
| No b+s events firing | Confirm the `cnxscv` managed package is installed and the agent is using Omni-Channel with a voice channel |

## Component Files

```
force-app/main/default/lwc/holdTimer/
├── holdTimer.js            # Component logic
├── holdTimer.html          # Template
├── holdTimer.css           # b+s branded styles
└── holdTimer.js-meta.xml   # Metadata (targets: lightning__UtilityBar)
```
