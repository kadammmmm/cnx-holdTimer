# b+s Hold Timer — LWC for Service Cloud Voice

Custom Utility Bar Component for Service Cloud Voice + Cisco Webex Contact Center via Bucher + Suter Connects.

This Lightning Web Component tracks customer hold time during voice calls, displays a real-time timer in the Service Console utility bar, alerts agents when hold exceeds a configurable threshold (visual highlight + sticky toast), and syncs total hold seconds to the `CustomerHoldDuration` field on the VoiceCall record via the b+s Connects Integration Library (v2.10+).

## Features

- **Current Hold Timer** — resets each time the customer is placed on hold
- **Total Hold Time** — cumulative across all hold segments for the call
- **Hold Count** — tracks how many times the customer was placed on hold
- **Auto-Open** — utility bar panel expands automatically when a hold begins
- **Threshold Alert** — visual warning + sticky toast when a hold segment exceeds the threshold
- **b+s Sync** — attempts to write `CustomerHoldDuration` via `updateWorkitemData` at call end

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

After changing, redeploy the component:

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

## Prerequisites

- **Salesforce CLI (sf)** — [Install](https://developer.salesforce.com/tools/sfcli) and verify: `sf version`
- **Visual Studio Code** — [Install](https://code.visualstudio.com/) with Salesforce Extension Pack
- **Bucher + Suter Connects Package** — managed package installed in target org (namespace `cnxscv`), Integration Library v2.10+

## Deployment

### 1. Authorize Target Org

```bash
sf org login web --alias my-org --instance-url https://login.salesforce.com
sf config set target-org my-org
```

For a sandbox, use `https://test.salesforce.com`.

### 2. Deploy the Component

```bash
sf project deploy start -m LightningComponentBundle:holdTimer
```

### 3. Add to Utility Bar

1. **Setup** → **App Manager** → edit your Service Console app
2. **Utility Items (Desktop Only)** → **Add Utility Item**
3. Search for **"b+s Hold Timer"**
4. Configure:
   - **Label:** Hold Timer
   - **Icon:** utility:clock
   - **Panel Width:** 280 / **Panel Height:** 220
   - **Start Automatically:** Enabled (required — keeps the component in DOM so b+s events fire)
5. **Save**

## Testing

1. Open the Service Console app
2. Accept an inbound/outbound voice call via Omni-Channel
3. Place the caller on hold — the timer starts and the panel displays "Customer on Hold"
4. Observe the current hold timer counting up
5. At **30s**: amber border, orange toast ("Hold Approaching Limit")
6. At **60s**: red border + pulse, red toast ("Customer Waiting Too Long!")
7. At **90s**: full red panel, sticky red toast ("HOLD TIME CRITICAL")
8. Resume the call — current hold resets, total hold time persists, tier resets
9. Place on hold again — current hold restarts from 00:00, total continues accumulating
10. End the call (or enter Wrapup) — timer resets to idle

## Component Files

```
force-app/main/default/lwc/holdTimer/
├── holdTimer.js            # Component logic
├── holdTimer.html          # Template
├── holdTimer.css           # b+s branded styles
└── holdTimer.js-meta.xml   # Metadata (targets: lightning__UtilityBar)
```
